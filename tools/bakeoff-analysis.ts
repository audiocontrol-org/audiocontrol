/**
 * Bakeoff: compare Haiku, Sonnet, and Opus on session analysis.
 * Sends the same session content to all three models and saves results.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... tsx tools/bakeoff-analysis.ts <session-file.jsonl.age>
 */

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { basename, join, resolve } from "node:path";

const AGE_KEY_PATH = join(
  process.env.HOME ?? "~",
  ".config",
  "age",
  "audiocontrol.key"
);

const MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "haiku" },
  // Sonnet and Opus require higher API tier — add back when available:
  // { id: "claude-sonnet-4-5-20250514", label: "sonnet" },
  // { id: "claude-opus-4-5-20250918", label: "opus" },
];

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

Return ONLY valid JSON, no markdown fencing.`;

async function callClaude(
  model: string,
  content: string
): Promise<{ response: string; inputTokens: number; outputTokens: number; durationMs: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  const start = Date.now();
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here is the session log to analyze:\n\n${content}`,
        },
      ],
    }),
  });

  const data = await response.json() as Record<string, unknown>;
  const durationMs = Date.now() - start;

  if (!response.ok) {
    const errMsg = (data.error as Record<string, unknown>)?.message ?? JSON.stringify(data);
    throw new Error(`API ${response.status}: ${errMsg}`);
  }

  const blocks = data.content as Array<{ type: string; text?: string }> | undefined;
  const usage = data.usage as { input_tokens: number; output_tokens: number } | undefined;

  const text = blocks
    ?.filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("") ?? "";

  return {
    response: text,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    durationMs,
  };
}

async function main(): Promise<void> {
  const sessionFile = process.argv[2];
  if (!sessionFile) {
    console.error("Usage: tsx tools/bakeoff-analysis.ts <session-file.jsonl.age>");
    process.exit(1);
  }

  // Decrypt session content
  const plaintext = execSync(
    `age -d -i "${AGE_KEY_PATH}" "${sessionFile}"`,
    { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 }
  );

  console.log(`Session: ${basename(sessionFile)}`);
  console.log(`Content: ${(plaintext.length / 1024).toFixed(0)}KB, ${plaintext.split("\n").length} entries`);
  console.log("");

  const outputDir = resolve(import.meta.dirname ?? process.cwd(), "..", "tmp");
  execSync(`mkdir -p "${outputDir}"`);

  for (const model of MODELS) {
    console.log(`Running ${model.label} (${model.id})...`);
    try {
      const result = await callClaude(model.id, plaintext);
      console.log(
        `  Done: ${result.inputTokens} in / ${result.outputTokens} out, ${(result.durationMs / 1000).toFixed(1)}s`
      );

      // Parse and pretty-print
      let parsed: unknown;
      try {
        // Strip markdown fencing if present
        let jsonText = result.response.trim();
        if (jsonText.startsWith("```")) {
          jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }
        parsed = JSON.parse(jsonText);
      } catch {
        parsed = { raw: result.response, parse_error: true };
      }

      const output = {
        model: model.id,
        label: model.label,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        duration_ms: result.durationMs,
        analysis: parsed,
      };

      const outFile = join(
        outputDir,
        `bakeoff_${basename(sessionFile, ".jsonl.age")}_${model.label}.json`
      );
      writeFileSync(outFile, JSON.stringify(output, null, 2) + "\n", "utf8");
      console.log(`  Saved: ${outFile}`);
    } catch (err) {
      console.error(`  Error: ${err}`);
    }
    console.log("");
  }

  console.log("Bakeoff complete. Compare results in tmp/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
