/**
 * Session data extractor — parses Claude Code JSONL session logs and
 * extracts one structured record per session into data/sessions/sessions.jsonl.
 *
 * Usage:
 *   tsx tools/extract-sessions.ts
 *   tsx tools/extract-sessions.ts --data-dir /tmp/m1-data --machine orion-m1
 */

import { appendFileSync, createReadStream, existsSync, readFileSync, writeFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionRecord {
  session_id: string;
  project: string;
  machine: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  user_messages: number;
  assistant_messages: number;
  tool_calls: number;
  tool_types: string[];
  agent_spawns: number;
  input_tokens: number;
  output_tokens: number;
  commits: number;
  branch: string;
  model: string;
}

interface ContentBlock {
  type: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface MessagePayload {
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  content?: ContentBlock[];
}

interface LogEntry {
  type: string;
  timestamp?: string;
  gitBranch?: string;
  message?: MessagePayload | { content?: string };
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(): { dataDir: string; machine: string } {
  const args = process.argv.slice(2);
  let dataDir = join(
    process.env.HOME ?? "~",
    ".claude",
    "projects"
  );
  let machine = execSync("hostname -s", { encoding: "utf8" }).trim();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--data-dir" && args[i + 1]) {
      dataDir = resolve(args[i + 1]);
      i++;
    } else if (args[i] === "--machine" && args[i + 1]) {
      machine = args[i + 1];
      i++;
    }
  }
  return { dataDir, machine };
}

// ---------------------------------------------------------------------------
// JSONL streaming parser for a single session
// ---------------------------------------------------------------------------

async function extractSession(
  filePath: string,
  projectName: string,
  machine: string
): Promise<SessionRecord | null> {
  const sessionId = basename(filePath, ".jsonl");

  let startTime = "";
  let endTime = "";
  let userMessages = 0;
  let assistantMessages = 0;
  let toolCalls = 0;
  const toolTypeSet = new Set<string>();
  let agentSpawns = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let commits = 0;
  let branch = "";
  let model = "";

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    let entry: LogEntry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    // Track timestamps
    const ts = entry.timestamp;
    if (ts) {
      if (!startTime || ts < startTime) startTime = ts;
      if (!endTime || ts > endTime) endTime = ts;
    }

    // Branch (take first non-empty)
    if (!branch && entry.gitBranch) {
      branch = entry.gitBranch;
    }

    if (entry.type === "user") {
      userMessages++;

      // Check for git commit in user messages (tool results containing git commit)
      const msg = entry.message;
      if (msg && typeof msg === "object" && "content" in msg) {
        const content = msg.content;
        if (typeof content === "string" && content.includes("git commit")) {
          commits++;
        }
      }
    }

    if (entry.type === "assistant") {
      assistantMessages++;

      const msg = entry.message as MessagePayload | undefined;
      if (!msg) continue;

      // Model
      if (!model && msg.model) {
        model = msg.model;
      }

      // Token usage (include cache tokens for accurate totals)
      if (msg.usage) {
        inputTokens +=
          (msg.usage.input_tokens ?? 0) +
          (msg.usage.cache_creation_input_tokens ?? 0) +
          (msg.usage.cache_read_input_tokens ?? 0);
        outputTokens += msg.usage.output_tokens ?? 0;
      }

      // Tool calls from content blocks
      const content = msg.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "tool_use") {
            toolCalls++;
            if (block.name) {
              toolTypeSet.add(block.name);
            }
            if (block.name === "Agent") {
              agentSpawns++;
            }
            // Check for git commit in Bash tool calls
            if (
              block.name === "Bash" &&
              typeof block.input === "object" &&
              block.input !== null &&
              "command" in block.input &&
              typeof block.input.command === "string" &&
              block.input.command.includes("git commit")
            ) {
              commits++;
            }
          }
        }
      }
    }
  }

  // Skip empty/trivial sessions (no messages at all)
  if (!startTime || (userMessages === 0 && assistantMessages === 0)) {
    return null;
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

  return {
    session_id: sessionId,
    project: projectName,
    machine,
    start_time: startTime,
    end_time: endTime,
    duration_minutes: durationMinutes,
    user_messages: userMessages,
    assistant_messages: assistantMessages,
    tool_calls: toolCalls,
    tool_types: [...toolTypeSet].sort(),
    agent_spawns: agentSpawns,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    commits,
    branch,
    model,
  };
}

// ---------------------------------------------------------------------------
// Discover session JSONL files
// ---------------------------------------------------------------------------

async function discoverSessions(
  dataDir: string
): Promise<Array<{ path: string; project: string }>> {
  const results: Array<{ path: string; project: string }> = [];

  if (!existsSync(dataDir)) {
    console.error(`Data directory not found: ${dataDir}`);
    process.exit(1);
  }

  const entries = await readdir(dataDir);
  for (const dirName of entries) {
    const dirPath = join(dataDir, dirName);
    const dirStat = await stat(dirPath);
    if (!dirStat.isDirectory()) continue;

    // Extract project name from directory
    // Format: -Users-orion-work-audiocontrol-work-audiocontrol-<slug>
    // We want the last meaningful segment(s)
    const parts = dirName.split("-");
    const projectName = extractProjectName(dirName);

    const files = await readdir(dirPath);
    for (const file of files) {
      if (file.endsWith(".jsonl")) {
        results.push({
          path: join(dirPath, file),
          project: projectName,
        });
      }
    }
  }

  return results;
}

function extractProjectName(dirName: string): string {
  // Directory names look like: -Users-orion-work-audiocontrol-work-audiocontrol-library-ux
  // We want: audiocontrol-library-ux (or just the slug after the last "audiocontrol-work-")
  const workIdx = dirName.lastIndexOf("-work-");
  if (workIdx !== -1) {
    return dirName.slice(workIdx + 6); // skip "-work-"
  }
  // Fallback: last segment after the last path separator encoded as dash
  const segments = dirName.split("-");
  return segments.slice(-2).join("-");
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function loadExistingIds(outputPath: string): Set<string> {
  const ids = new Set<string>();
  if (!existsSync(outputPath)) return ids;

  const data = readFileSync(outputPath, "utf8");
  for (const line of data.split("\n")) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      ids.add(record.session_id);
    } catch {
      continue;
    }
  }
  return ids;
}

function appendRecord(outputPath: string, record: SessionRecord): void {
  const line = JSON.stringify(record) + "\n";
  appendFileSync(outputPath, line, "utf8");
}

function generateCsv(jsonlPath: string, csvPath: string): void {
  if (!existsSync(jsonlPath)) return;

  const data = readFileSync(jsonlPath, "utf8");
  const lines = data.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return;

  const headers = [
    "session_id",
    "project",
    "machine",
    "start_time",
    "end_time",
    "duration_minutes",
    "user_messages",
    "assistant_messages",
    "tool_calls",
    "tool_types",
    "agent_spawns",
    "input_tokens",
    "output_tokens",
    "commits",
    "branch",
    "model",
  ];

  const csvLines = [headers.join(",")];
  for (const line of lines) {
    try {
      const record = JSON.parse(line) as SessionRecord;
      const row = headers.map((h) => {
        const value = record[h as keyof SessionRecord];
        if (Array.isArray(value)) {
          return `"${value.join(";")}"`;
        }
        if (typeof value === "string" && value.includes(",")) {
          return `"${value}"`;
        }
        return String(value ?? "");
      });
      csvLines.push(row.join(","));
    } catch {
      continue;
    }
  }

  writeFileSync(csvPath, csvLines.join("\n") + "\n", "utf8");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { dataDir, machine } = parseArgs();

  const outputDir = resolve(
    import.meta.dirname ?? process.cwd(),
    "..",
    "data",
    "sessions"
  );
  const jsonlPath = join(outputDir, "sessions.jsonl");
  const csvPath = join(outputDir, "summary.csv");

  console.log(`Data dir:  ${dataDir}`);
  console.log(`Machine:   ${machine}`);
  console.log(`Output:    ${jsonlPath}`);

  // Discover session files
  const sessions = await discoverSessions(dataDir);
  console.log(`Found ${sessions.length} session files`);

  // Load existing IDs for idempotency
  const existingIds = loadExistingIds(jsonlPath);
  console.log(`Existing records: ${existingIds.size}`);

  let newCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const session of sessions) {
    const sessionId = basename(session.path, ".jsonl");

    if (existingIds.has(sessionId)) {
      skipCount++;
      continue;
    }

    try {
      const record = await extractSession(session.path, session.project, machine);
      if (record) {
        appendRecord(jsonlPath, record);
        newCount++;
        console.log(
          `  + ${record.project}/${sessionId.slice(0, 8)}... ` +
            `(${record.user_messages}u/${record.assistant_messages}a, ` +
            `${record.duration_minutes}min)`
        );
      } else {
        skipCount++;
      }
    } catch (err) {
      errorCount++;
      console.error(`  ! Error processing ${session.path}: ${err}`);
    }
  }

  console.log(
    `\nDone: ${newCount} new, ${skipCount} skipped, ${errorCount} errors`
  );

  // Regenerate CSV from full JSONL
  generateCsv(jsonlPath, csvPath);
  console.log(`CSV regenerated: ${csvPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
