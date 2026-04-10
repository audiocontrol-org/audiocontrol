/**
 * Session content extractor — parses Claude Code JSONL session logs and
 * extracts conversation content (user messages, assistant text, tool calls)
 * into per-session files for analysis.
 *
 * Strips tool results and attachments to keep file sizes manageable.
 * Output: data/sessions/content/<date>_<session-id-short>.jsonl.age (encrypted)
 *
 * Encrypted with age (https://age-encryption.org). Decrypt with:
 *   age -d -i ~/.config/age/audiocontrol.key <file>.age
 *
 * Recovery: passphrase-protected key backup at data/sessions/content/recovery-key.age
 *   age -d -o ~/.config/age/audiocontrol.key data/sessions/content/recovery-key.age
 *
 * Usage:
 *   tsx tools/extract-session-content.ts
 *   tsx tools/extract-session-content.ts --data-dir /tmp/m1-data
 */

import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentEntry {
  type: "user" | "assistant";
  timestamp: string;
  content: ExtractedContent[];
}

type ExtractedContent =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "tool_use"; name: string; input: Record<string, unknown> };

interface RawContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  input?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(): { dataDir: string } {
  const args = process.argv.slice(2);
  let dataDir = join(process.env.HOME ?? "~", ".claude", "projects");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--data-dir" && args[i + 1]) {
      dataDir = resolve(args[i + 1]);
      i++;
    }
  }
  return { dataDir };
}

// ---------------------------------------------------------------------------
// Extract content from a single session
// ---------------------------------------------------------------------------

async function extractContent(
  filePath: string
): Promise<{ entries: ContentEntry[]; startDate: string } | null> {
  const entries: ContentEntry[] = [];
  let startDate = "";

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(line);
    } catch {
      continue;
    }

    const entryType = raw.type as string;
    const timestamp = (raw.timestamp as string) ?? "";

    if (timestamp && (!startDate || timestamp < startDate)) {
      startDate = timestamp;
    }

    if (entryType === "user") {
      const extracted = extractUserContent(raw);
      if (extracted.length > 0) {
        entries.push({ type: "user", timestamp, content: extracted });
      }
    } else if (entryType === "assistant") {
      const extracted = extractAssistantContent(raw);
      if (extracted.length > 0) {
        entries.push({ type: "assistant", timestamp, content: extracted });
      }
    }
    // Skip: file-history-snapshot, attachment, system, permission-mode, etc.
  }

  if (entries.length === 0) return null;
  return { entries, startDate };
}

function extractUserContent(raw: Record<string, unknown>): ExtractedContent[] {
  const message = raw.message as Record<string, unknown> | undefined;
  if (!message) return [];

  const content = message.content;

  // String content — the actual user text
  if (typeof content === "string") {
    return content.trim() ? [{ type: "text", text: content }] : [];
  }

  // Array content — extract text blocks, skip tool_result blocks
  if (Array.isArray(content)) {
    const results: ExtractedContent[] = [];
    for (const block of content) {
      if (typeof block === "object" && block !== null) {
        const b = block as RawContentBlock;
        if (b.type === "text" && b.text?.trim()) {
          results.push({ type: "text", text: b.text });
        }
        // Skip tool_result — these are tool output payloads, often large
      }
    }
    return results;
  }

  return [];
}

function extractAssistantContent(
  raw: Record<string, unknown>
): ExtractedContent[] {
  const message = raw.message as Record<string, unknown> | undefined;
  if (!message) return [];

  const content = message.content;
  if (!Array.isArray(content)) return [];

  const results: ExtractedContent[] = [];
  for (const block of content) {
    if (typeof block !== "object" || block === null) continue;
    const b = block as RawContentBlock;

    if (b.type === "text" && b.text?.trim()) {
      results.push({ type: "text", text: b.text });
    } else if (b.type === "thinking" && b.thinking?.trim()) {
      results.push({ type: "thinking", thinking: b.thinking });
    } else if (b.type === "tool_use" && b.name) {
      results.push({
        type: "tool_use",
        name: b.name,
        input: b.input ?? {},
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Discover session JSONL files
// ---------------------------------------------------------------------------

async function discoverSessions(
  dataDir: string
): Promise<Array<{ path: string }>> {
  const results: Array<{ path: string }> = [];

  if (!existsSync(dataDir)) {
    console.error(`Data directory not found: ${dataDir}`);
    process.exit(1);
  }

  const entries = await readdir(dataDir);
  for (const dirName of entries) {
    const dirPath = join(dataDir, dirName);
    const dirStat = await stat(dirPath);
    if (!dirStat.isDirectory()) continue;

    const files = await readdir(dirPath);
    for (const file of files) {
      if (file.endsWith(".jsonl")) {
        results.push({ path: join(dirPath, file) });
      }
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

const AGE_KEY_PATH = join(
  process.env.HOME ?? "~",
  ".config",
  "age",
  "audiocontrol.key"
);

function getPublicKey(): string {
  if (!existsSync(AGE_KEY_PATH)) {
    throw new Error(
      `age key not found at ${AGE_KEY_PATH}\n` +
        "Generate one with: age-keygen -o ~/.config/age/audiocontrol.key"
    );
  }

  // Read public key from the key file (second line, starts with "age1")
  const keyFile = readFileSync(AGE_KEY_PATH, "utf8");
  const pubLine = keyFile
    .split("\n")
    .find((l: string) => l.startsWith("# public key: "));
  if (!pubLine) {
    throw new Error(`Could not find public key in ${AGE_KEY_PATH}`);
  }
  return pubLine.replace("# public key: ", "").trim();
}

function encryptAndWrite(
  data: string,
  outputPath: string,
  publicKey: string
): void {
  execSync(`age -r ${publicKey} -o "${outputPath}"`, {
    input: data,
    encoding: "utf8",
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { dataDir } = parseArgs();

  const publicKey = getPublicKey();

  const contentDir = resolve(
    import.meta.dirname ?? process.cwd(),
    "..",
    "data",
    "sessions",
    "content"
  );
  mkdirSync(contentDir, { recursive: true });

  console.log(`Data dir:  ${dataDir}`);
  console.log(`Output:    ${contentDir}/`);
  console.log(`Key:       ${AGE_KEY_PATH}`);

  const sessions = await discoverSessions(dataDir);
  console.log(`Found ${sessions.length} session files`);

  // Check which sessions already have content extracted (by short ID)
  // Also track full session IDs to deduplicate across project directories
  const existingShortIds = new Set<string>();
  const processedFullIds = new Set<string>();
  if (existsSync(contentDir)) {
    for (const f of await readdir(contentDir)) {
      const match = f.match(/_([a-f0-9]+)\.jsonl\.age$/);
      if (match) existingShortIds.add(match[1]);
    }
  }

  let newCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const session of sessions) {
    const sessionId = basename(session.path, ".jsonl");
    const shortId = sessionId.slice(0, 8);

    if (existingShortIds.has(shortId) || processedFullIds.has(sessionId)) {
      skipCount++;
      continue;
    }
    processedFullIds.add(sessionId);

    try {
      const result = await extractContent(session.path);
      if (!result) {
        skipCount++;
        continue;
      }

      const datePrefix = result.startDate.slice(0, 10);
      const outputFile = join(
        contentDir,
        `${datePrefix}_${shortId}.jsonl.age`
      );

      const plaintext = result.entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
      encryptAndWrite(plaintext, outputFile, publicKey);

      const sizeMB = (statSync(outputFile).size / 1e6).toFixed(1);
      console.log(
        `  + ${datePrefix}_${shortId} (${result.entries.length} entries, ${sizeMB}MB)`
      );
      newCount++;
    } catch (err) {
      errorCount++;
      console.error(`  ! Error: ${session.path}: ${err}`);
    }
  }

  console.log(
    `\nDone: ${newCount} new, ${skipCount} skipped, ${errorCount} errors`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
