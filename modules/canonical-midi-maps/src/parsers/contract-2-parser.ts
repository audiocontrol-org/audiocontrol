import { parse as parseYAML } from 'yaml';
import type { ZodIssue } from 'zod';
import {
  SUPPORTED_CONTRACT,
  type ControllerMap,
  type Message,
  type ParseResult,
  type SurfaceLayout,
  type SurfaceProfile,
} from '../types/contract-2.js';
import {
  ControllerMapSchema,
  SurfaceLayoutSchema,
  SurfaceProfileSchema,
} from '../validators/contract-2-schema.js';

const PLACEHOLDERS: readonly string[] = ['cc', 'channel', 'value', 'state', 'text'];
const HEX_PAIR = /^[0-9A-Fa-f]{2}$/;
const PLACEHOLDER = /^\{([A-Za-z_][A-Za-z0-9_]*)\}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The top-level `contract` of a YAML document, or undefined when it has none. */
export function contractOf(yaml: string): number | undefined {
  const raw: unknown = parseYAML(yaml);
  if (!isRecord(raw)) return undefined;
  const contract = raw['contract'];
  return typeof contract === 'number' ? contract : undefined;
}

function formatPath(path: ReadonlyArray<string | number>): string {
  let out = '';
  for (const part of path) {
    out += typeof part === 'number' ? `[${part}]` : out === '' ? part : `.${part}`;
  }
  return out;
}

function withPath(path: string, message: string): string {
  return path === '' ? message : `${path}: ${message}`;
}

function formatIssue(issue: ZodIssue): string {
  const path = formatPath(issue.path);
  if (issue.code === 'invalid_union') {
    return withPath(path, 'is not a valid message (expected a { sysex } or a { cc } message with fillable placeholders)');
  }
  if (issue.code === 'unrecognized_keys') {
    return withPath(path, `unknown key ${issue.keys.map((k) => `"${k}"`).join(', ')}`);
  }
  return withPath(path, issue.message);
}

/** Parses YAML and checks the contract number; returns the raw document or errors. */
function readDocument(yaml: string): ParseResult<unknown> {
  let raw: unknown;
  try {
    raw = parseYAML(yaml);
  } catch (error) {
    return { ok: false, errors: [`yaml: ${error instanceof Error ? error.message : String(error)}`] };
  }
  const contract = isRecord(raw) ? raw['contract'] : undefined;
  if (typeof contract === 'number' && contract !== SUPPORTED_CONTRACT) {
    return {
      ok: false,
      errors: [`contract ${contract} is not supported (supported: ${SUPPORTED_CONTRACT})`],
    };
  }
  return { ok: true, value: raw };
}

function checkMessage(path: string, message: Message, errors: string[]): void {
  if (!('sysex' in message)) return;
  message.sysex.trim().split(/\s+/).forEach((token) => {
    if (HEX_PAIR.test(token)) return;
    const match = PLACEHOLDER.exec(token);
    if (match === null) {
      errors.push(`${path}.sysex: "${token}" is neither a hex pair nor a placeholder`);
    } else if (!PLACEHOLDERS.includes(match[1] ?? '')) {
      errors.push(`${path}.sysex: unknown placeholder ${token}`);
    }
  });
}

function checkProfile(profile: SurfaceProfile): string[] {
  const errors: string[] = [];
  const { protocol } = profile;
  protocol.claim.forEach((m, i) => checkMessage(`protocol.claim[${i}]`, m, errors));
  protocol.release.forEach((m, i) => checkMessage(`protocol.release[${i}]`, m, errors));
  if (protocol.follow) checkMessage('protocol.follow', protocol.follow, errors);
  protocol.label?.forEach((m, i) => checkMessage(`protocol.label[${i}]`, m, errors));
  protocol.announce?.forEach((m, i) => checkMessage(`protocol.announce[${i}]`, m, errors));
  if (protocol.indicate) checkMessage('protocol.indicate.message', protocol.indicate.message, errors);

  const ids = new Map<string, number>();
  const addresses = new Map<string, string>();
  profile.controls.forEach((control, i) => {
    if (ids.has(control.id)) {
      errors.push(`controls[${i}].id: "${control.id}" is already the id of controls[${ids.get(control.id)}]`);
    }
    ids.set(control.id, i);
    const key = `${control.address.channel}:${control.address.cc}`;
    const owner = addresses.get(key);
    if (owner !== undefined) {
      errors.push(
        `controls[${i}].address: channel ${control.address.channel} cc ${control.address.cc} is already the address of control "${owner}"`,
      );
    } else {
      addresses.set(key, control.id);
    }
    if (control.follows === true && protocol.follow === undefined) {
      errors.push(`controls[${i}].follows: control "${control.id}" follows but protocol.follow is not defined`);
    }
  });
  return errors;
}

function checkLayout(layout: SurfaceLayout, surface: SurfaceProfile): string[] {
  const errors: string[] = [];
  if (layout.surface !== surface.surface) {
    errors.push(`surface: "${layout.surface}" does not match surface "${surface.surface}"`);
  }
  const kinds = new Map(surface.controls.map((c) => [c.id, c.kind]));
  const checkButton = (path: string, id: string): void => {
    const kind = kinds.get(id);
    if (kind === undefined) {
      errors.push(`${path}: "${id}" is not a control of surface "${surface.surface}"`);
    } else if (kind !== 'button') {
      errors.push(`${path}: "${id}" is not a button`);
    }
  };
  const presses = new Map<string, { index: number; role: string }>();
  layout.bindings.forEach((binding, i) => {
    checkButton(`bindings[${i}].press.control`, binding.press.control);
    if (binding.press.with !== undefined) checkButton(`bindings[${i}].press.with`, binding.press.with);
    const key = JSON.stringify([binding.press.control, binding.press.with ?? null]);
    const first = presses.get(key);
    if (first === undefined) {
      presses.set(key, { index: i, role: binding.role });
    } else {
      errors.push(`bindings[${i}].press: same press as bindings[${first.index}] (role "${first.role}")`);
    }
  });
  const roles = new Set(layout.bindings.map((b) => b.role));
  const feedbackRoles = new Set<string>();
  layout.feedback?.forEach((entry, i) => {
    if (!roles.has(entry.role)) errors.push(`feedback[${i}].role: "${entry.role}" has no binding`);
    if (feedbackRoles.has(entry.role)) errors.push(`feedback[${i}].role: "${entry.role}" already has feedback`);
    feedbackRoles.add(entry.role);
  });
  return errors;
}

function boundRoles(layout: SurfaceLayout): Map<string, string[]> {
  const bound = new Map<string, string[]>();
  const add = (control: string, role: string): void => {
    const roles = bound.get(control) ?? [];
    if (!roles.includes(role)) roles.push(role);
    bound.set(control, roles);
  };
  for (const binding of layout.bindings) {
    add(binding.press.control, binding.role);
    if (binding.press.with !== undefined) add(binding.press.with, binding.role);
  }
  return bound;
}

function checkMap(map: ControllerMap, surface: SurfaceProfile, layout: SurfaceLayout): string[] {
  const errors: string[] = [];
  if (map.surface !== surface.surface) {
    errors.push(`surface: "${map.surface}" does not match surface "${surface.surface}"`);
  }
  const kinds = new Map(surface.controls.map((c) => [c.id, c.kind]));
  const bound = boundRoles(layout);
  map.pages.forEach((page, p) => {
    const seen = new Set<string>();
    page.assignments.forEach((assignment, a) => {
      const base = `pages[${p}].assignments[${a}]`;
      const kind = kinds.get(assignment.control);
      if (kind === undefined) {
        errors.push(`${base}.control: "${assignment.control}" is not a control of surface "${surface.surface}"`);
        return;
      }
      const roles = bound.get(assignment.control);
      if (roles !== undefined) {
        errors.push(`${base}.control: "${assignment.control}" is bound by the layout (${roles.join(', ')})`);
      }
      if (seen.has(assignment.control)) {
        errors.push(`${base}.control: "${assignment.control}" is already assigned on this page`);
      }
      seen.add(assignment.control);
      if (assignment.mode !== undefined && kind !== 'button') {
        errors.push(`${base}.mode: mode is only valid on a button ("${assignment.control}" is ${kind === 'encoder' ? 'an' : 'a'} ${kind})`);
      }
    });
  });
  return errors;
}

export function parseSurfaceProfile(yaml: string): ParseResult<SurfaceProfile> {
  const doc = readDocument(yaml);
  if (!doc.ok) return doc;
  const parsed = SurfaceProfileSchema.safeParse(doc.value);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map(formatIssue) };
  const errors = checkProfile(parsed.data);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: parsed.data };
}

export function parseSurfaceLayout(yaml: string, surface: SurfaceProfile): ParseResult<SurfaceLayout> {
  const doc = readDocument(yaml);
  if (!doc.ok) return doc;
  const parsed = SurfaceLayoutSchema.safeParse(doc.value);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map(formatIssue) };
  const errors = checkLayout(parsed.data, surface);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: parsed.data };
}

/** A page assignment may not use a control the layout binds (as `control` or `with`). */
export function parseControllerMap(
  yaml: string,
  surface: SurfaceProfile,
  layout: SurfaceLayout,
): ParseResult<ControllerMap> {
  const doc = readDocument(yaml);
  if (!doc.ok) return doc;
  const parsed = ControllerMapSchema.safeParse(doc.value);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map(formatIssue) };
  const errors = checkMap(parsed.data, surface, layout);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: parsed.data };
}
