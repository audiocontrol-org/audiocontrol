/**
 * LLM-powered session analysis — sends encrypted session content to Claude
 * Haiku for classification. Results are cached as encrypted files in
 * data/sessions/analysis/.
 *
 * Requires ANTHROPIC_API_KEY environment variable.
 * Rate-limited to stay under 50K input tokens/min.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... tsx tools/analyze-session-llm.ts
 *   ANTHROPIC_API_KEY=... tsx tools/analyze-session-llm.ts --since 2026-04-01
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MODEL = "claude-haiku-4-5-20251001";
const MAX_INPUT_TOKENS_PER_MIN = 50_000;
// ~4 chars per token, leave margin
const MAX_CONTENT_BYTES = MAX_INPUT_TOKENS_PER_MIN * 3;

const AGE_KEY_PATH = join(
  process.env.HOME ?? "~",
  ".config",
  "age",
  "audiocontrol.key"
);

const SYSTEM_PROMPT = `You are analyzing a Claude Code session log. The log contains user messages, assistant text responses, assistant thinking blocks, and tool calls (name + input).

Produce a structured analysis in JSON format with these fields:

{
  "arc_type": "feature" | "debug" | "review" | "exploration" | "quick-task" | "mixed",
  "arc_description": "One sentence describing what kind of work this session was",
  "summary": "2-3 sentence summary of what happened in this session",
  "accomplished": ["list of concrete outcomes"],
  "failed": ["list of things that didn't work"],
  "corrections": [
    {
      "category": "COMPLEXITY" | "UX" | "FABRICATION" | "DOCUMENTATION" | "PROCESS",
      "description": "What the agent did wrong and what the user wanted instead",
      "user_quote": "The approximate user message that triggered the correction"
    }
  ],
  "correction_count": <number>,
  "patterns": ["recurring themes or issues observed"],
  "agent_strengths": ["things the agent did well"],
  "improvement_suggestions": ["specific suggestions for CLAUDE.md rules that would prevent the corrections observed"]
}

Be precise about corrections. A correction is when the user redirects the agent's approach — not just asking a question or providing information. Look for:
- User saying no, stop, don't, wrong, why did you, revert, undo
- User providing a simpler approach after agent over-engineered
- User pointing out fabricated claims
- User asking why the agent ignored existing docs or patterns
- User redirecting from one approach to another

Do NOT count normal conversation as corrections. "No, I mean X" when clarifying a requirement is not a correction — it's clarification. "No, stop doing that, do X instead" IS a correction.

CRITICAL: Your entire response must be a single valid JSON object. No prose, no explanation, no markdown fencing, no preamble. Start with { and end with }.`;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): { since: string | null } {
  const args = process.argv.slice(2);
  let since: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--since" && args[i + 1]) {
      since = args[i + 1];
      i++;
    }
  }
  return { since };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function callHaiku(
  content: string
): Promise<{ response: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `Here is the session log to analyze:\n\n${content}` },
        { role: "assistant", content: "{" },
      ],
    }),
  });

  const data = (await resp.json()) as Record<string, unknown>;
  if (!resp.ok) {
    const msg = (data.error as Record<string, unknown>)?.message ?? JSON.stringify(data);
    throw new Error(`API ${resp.status}: ${msg}`);
  }

  const blocks = data.content as Array<{ type: string; text?: string }>;
  const usage = data.usage as { input_tokens: number; output_tokens: number };
  const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("");

  return {
    response: text,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
  };
}

function parseResponse(raw: string): Record<string, unknown> {
  let text = raw.trim();

  // Strip markdown fencing
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  // The assistant prefill starts with "{", so prepend it
  // But if the model repeated the "{", don't double it
  if (!text.startsWith("{")) {
    text = "{" + text;
  }

  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // continue to recovery
  }

  // Recovery strategy 1: fix common LLM JSON issues
  let fixed = text
    .replace(/,\s*([}\]])/g, "$1")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f]/g, (ch) =>
      ch === "\n" ? "\\n" : ch === "\t" ? "\\t" : ch === "\r" ? "\\r" : ""
    );

  // Close unclosed braces/brackets
  let braces = 0;
  let brackets = 0;
  let inString = false;
  for (let i = 0; i < fixed.length; i++) {
    const ch = fixed[i];
    if (ch === '"' && (i === 0 || fixed[i - 1] !== "\\")) inString = !inString;
    if (inString) continue;
    if (ch === "{") braces++;
    else if (ch === "}") braces--;
    else if (ch === "[") brackets++;
    else if (ch === "]") brackets--;
  }
  for (let i = 0; i < brackets; i++) fixed += "]";
  for (let i = 0; i < braces; i++) fixed += "}";

  try {
    return JSON.parse(fixed);
  } catch {
    // continue to next strategy
  }

  // Recovery strategy 2: extract first balanced JSON object from the text
  // Handles cases where model returns valid JSON followed by extra content
  const start = text.indexOf("{");
  if (start >= 0) {
    let depth = 0;
    let inStr = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"' && (i === 0 || text[i - 1] !== "\\")) inStr = !inStr;
      if (inStr) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          return JSON.parse(text.slice(start, i + 1));
        }
      }
    }
  }

  throw new Error(`Could not parse LLM response: ${text.slice(0, 200)}`);
}

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

function getPublicKey(): string {
  const keyFile = readFileSync(AGE_KEY_PATH, "utf8");
  const pubLine = keyFile.split("\n").find((l: string) => l.startsWith("# public key: "));
  if (!pubLine) throw new Error(`No public key in ${AGE_KEY_PATH}`);
  return pubLine.replace("# public key: ", "").trim();
}

function decrypt(filePath: string): string {
  return execSync(`age -d -i "${AGE_KEY_PATH}" "${filePath}"`, {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
}

function encryptAndWrite(data: string, outputPath: string, publicKey: string): void {
  execSync(`age -r ${publicKey} -o "${outputPath}"`, { input: data, encoding: "utf8" });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { since } = parseArgs();

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set");
    process.exit(1);
  }

  if (!existsSync(AGE_KEY_PATH)) {
    console.error(`age key not found: ${AGE_KEY_PATH}`);
    process.exit(1);
  }

  const publicKey = getPublicKey();
  const baseDir = resolve(import.meta.dirname ?? process.cwd(), "..", "data", "sessions");
  const contentDir = join(baseDir, "content");
  const analysisDir = join(baseDir, "analysis");
  mkdirSync(analysisDir, { recursive: true });

  if (!existsSync(contentDir)) {
    console.error("No content files. Run: tsx tools/extract-session-content.ts");
    process.exit(1);
  }

  // Find content files, check which already have analysis
  const contentFiles = readdirSync(contentDir)
    .filter((f) => f.endsWith(".jsonl.age") && f !== "recovery-key.age")
    .sort();

  const existingAnalysis = new Set(
    readdirSync(analysisDir)
      .filter((f) => f.endsWith(".json.age"))
      .map((f) => f.replace(".json.age", ""))
  );

  const pending = contentFiles.filter((f) => {
    const key = f.replace(".jsonl.age", "");
    if (existingAnalysis.has(key)) return false;
    if (since && key.slice(0, 10) < since) return false;
    return true;
  });

  console.log(`Content files: ${contentFiles.length}`);
  console.log(`Already analyzed: ${existingAnalysis.size}`);
  console.log(`Pending: ${pending.length}`);
  if (pending.length === 0) {
    console.log("Nothing to analyze.");
    return;
  }

  let tokensThisMinute = 0;
  let minuteStart = Date.now();

  for (const file of pending) {
    const filePath = join(contentDir, file);
    const fileSize = statSync(filePath).size;
    const sessionKey = file.replace(".jsonl.age", "");

    // Decrypt
    let plaintext: string;
    try {
      plaintext = decrypt(filePath);
    } catch (err) {
      console.error(`  ! Decrypt error ${file}: ${err}`);
      continue;
    }

    // Truncate large sessions to stay under rate limit
    if (plaintext.length > MAX_CONTENT_BYTES) {
      console.log(`  ~ Truncating ${sessionKey} from ${(plaintext.length / 1024).toFixed(0)}KB to ${(MAX_CONTENT_BYTES / 1024).toFixed(0)}KB`);
      plaintext = plaintext.slice(0, MAX_CONTENT_BYTES);
    }

    // Rate limit: wait if we'd exceed 50K tokens/min
    const estimatedTokens = Math.ceil(plaintext.length / 4);
    const elapsed = Date.now() - minuteStart;
    if (elapsed < 60_000 && tokensThisMinute + estimatedTokens > MAX_INPUT_TOKENS_PER_MIN) {
      const waitMs = 60_000 - elapsed + 1000;
      console.log(`  ~ Rate limit: waiting ${(waitMs / 1000).toFixed(0)}s...`);
      await new Promise((r) => setTimeout(r, waitMs));
      tokensThisMinute = 0;
      minuteStart = Date.now();
    }
    if (elapsed >= 60_000) {
      tokensThisMinute = 0;
      minuteStart = Date.now();
    }

    // Call API
    console.log(`  > ${sessionKey} (${(plaintext.length / 1024).toFixed(0)}KB)...`);
    try {
      const result = await callHaiku(plaintext);
      tokensThisMinute += result.inputTokens;

      const analysis = parseResponse(result.response);
      const output = {
        session: sessionKey,
        model: MODEL,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        analysis,
      };

      const outPath = join(analysisDir, `${sessionKey}.json.age`);
      encryptAndWrite(JSON.stringify(output, null, 2), outPath, publicKey);

      const corrections = (analysis.correction_count as number) ?? 0;
      const arcType = (analysis.arc_type as string) ?? "?";
      console.log(`    ${arcType}, ${corrections} corrections, ${result.inputTokens} tokens`);
    } catch (err) {
      const msg = String(err);
      if (msg.includes("429")) {
        console.log(`    Rate limited — waiting 60s...`);
        await new Promise((r) => setTimeout(r, 60_000));
        tokensThisMinute = 0;
        minuteStart = Date.now();
      } else {
        console.log(`    Error: ${msg.slice(0, 120)} — retrying...`);
      }
      // Retry once for any error (rate limit, parse failure, network)
      try {
        const result = await callHaiku(plaintext);
        tokensThisMinute += result.inputTokens;
        const analysis = parseResponse(result.response);
        const output = { session: sessionKey, model: MODEL, input_tokens: result.inputTokens, output_tokens: result.outputTokens, analysis };
        const outPath = join(analysisDir, `${sessionKey}.json.age`);
        encryptAndWrite(JSON.stringify(output, null, 2), outPath, publicKey);
        const corrections = (analysis.correction_count as number) ?? 0;
        console.log(`    ${analysis.arc_type}, ${corrections} corrections (retry)`);
      } catch (retryErr) {
        console.error(`    Retry failed: ${retryErr}`);
      }
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
