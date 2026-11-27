import { z } from 'zod';

// Structural schemas for contract 2. Cross-document checks live in the parser.

const byte = z.number().int().min(0).max(127);

const CcAddressSchema = z
  .object({
    channel: z.number().int().min(1).max(16),
    cc: byte,
  })
  .strict();

const SurfaceControlSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['encoder', 'fader', 'button']),
    address: CcAddressSchema,
    follows: z.boolean().optional(),
  })
  .strict();

const MessageSchema = z.union([
  z.object({ sysex: z.string().min(1) }).strict(),
  z
    .object({
      cc: z
        .object({
          channel: z.union([z.number().int().min(1).max(16), z.literal('{channel}')]),
          number: z.union([byte, z.literal('{cc}')]),
          value: z.union([byte, z.literal('{value}'), z.literal('{state}')]),
        })
        .strict(),
    })
    .strict(),
]);

export const SurfaceProfileSchema = z
  .object({
    contract: z.literal(2),
    surface: z.string().min(1),
    kind: z.literal('surface'),
    device: z.object({ manufacturer: z.string().min(1), model: z.string().min(1) }).strict(),
    ports: z.object({ input: z.string().min(1), output: z.string().min(1) }).strict(),
    controls: z.array(SurfaceControlSchema).min(1),
    protocol: z
      .object({
        claim: z.array(MessageSchema),
        release: z.array(MessageSchema),
        mode: z
          .object({
            address: CcAddressSchema,
            ready: z.array(byte),
            suspended: z.array(z.object({ values: z.array(byte), reason: z.string().min(1) }).strict()),
          })
          .strict()
          .optional(),
        follow: MessageSchema.optional(),
        label: z.array(MessageSchema).optional(),
        announce: z.array(MessageSchema).optional(),
        indicate: z.object({ message: MessageSchema, off: byte }).strict().optional(),
      })
      .strict(),
  })
  .strict();

export const SurfaceLayoutSchema = z
  .object({
    contract: z.literal(2),
    version: z.string().min(1),
    surface: z.string().min(1),
    kind: z.literal('layout'),
    bindings: z.array(
      z
        .object({
          role: z.string().min(1),
          press: z.object({ control: z.string().min(1), with: z.string().min(1).optional() }).strict(),
        })
        .strict(),
    ),
    feedback: z
      .array(z.object({ role: z.string().min(1), active: byte, inactive: byte }).strict())
      .optional(),
  })
  .strict();

const AssignmentSchema = z
  .object({
    control: z.string().min(1),
    parameter: z.object({ id: z.string().min(1), name: z.string().min(1) }).strict(),
    mode: z.enum(['toggle', 'momentary']).optional(),
  })
  .strict();

export const ControllerMapSchema = z
  .object({
    contract: z.literal(2),
    version: z.string().min(1),
    surface: z.string().min(1),
    metadata: z
      .object({
        name: z.string().min(1),
        description: z.string().optional(),
        author: z.string().optional(),
      })
      .strict(),
    plugin: z
      .object({
        manufacturer: z.string().min(1),
        name: z.string().min(1),
        luna_plugin_ids: z.array(z.string().min(1)).min(1, 'at least one plugin id is required'),
      })
      .strict(),
    pages: z
      .array(z.object({ name: z.string().min(1), assignments: z.array(AssignmentSchema) }).strict())
      .min(1),
  })
  .strict();
