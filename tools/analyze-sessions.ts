/**
 * Session data analyzer — reads data/sessions/sessions.jsonl and produces
 * human-readable reports suitable for DEVELOPMENT-NOTES.md.
 *
 * Usage:
 *   tsx tools/analyze-sessions.ts
 *   tsx tools/analyze-sessions.ts --since 2026-04-01
 *   tsx tools/analyze-sessions.ts --json
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";

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

interface CorrectionMatch {
  session_file: string;
  timestamp: string;
  text: string;
  signals: string[];
}

interface ContentAnalysis {
  total_user_text_messages: number;
  correction_count: number;
  correction_rate: string;
  corrections_by_signal: Record<string, number>;
  corrections_by_session: Record<string, number>;
  sample_corrections: CorrectionMatch[];
}

interface AnalysisReport {
  total_sessions: number;
  date_range: { earliest: string; latest: string };
  sessions_by_project: Record<string, number>;
  sessions_by_machine: Record<string, number>;
  total_tokens: { input: number; output: number; combined: number };
  avg_duration_minutes: number;
  avg_user_messages: number;
  agent_spawn_rate: number;
  tool_distribution: Record<string, number>;
  sessions_by_period: Record<string, number>;
  longest_sessions: SessionSummary[];
  token_heaviest_sessions: SessionSummary[];
  total_commits: number;
  total_tool_calls: number;
  models_used: Record<string, number>;
}

interface SessionSummary {
  session_id: string;
  project: string;
  start_time: string;
  duration_minutes: number;
  user_messages: number;
  assistant_messages: number;
  total_tokens: number;
  commits: number;
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(): { since: string | null; json: boolean } {
  const args = process.argv.slice(2);
  let since: string | null = null;
  let json = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--since" && args[i + 1]) {
      since = args[i + 1];
      i++;
    } else if (args[i] === "--json") {
      json = true;
    }
  }
  return { since, json };
}

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------

function loadSessions(since: string | null): SessionRecord[] {
  const jsonlPath = resolve(
    import.meta.dirname ?? process.cwd(),
    "..",
    "data",
    "sessions",
    "sessions.jsonl"
  );

  if (!existsSync(jsonlPath)) {
    console.error(`No session data found at ${jsonlPath}`);
    console.error("Run: tsx tools/extract-sessions.ts");
    process.exit(1);
  }

  const data = readFileSync(jsonlPath, "utf8");
  const records: SessionRecord[] = [];

  for (const line of data.split("\n")) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line) as SessionRecord;
      if (since && record.start_time < since) continue;
      records.push(record);
    } catch {
      continue;
    }
  }

  return records;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

function analyze(sessions: SessionRecord[]): AnalysisReport {
  const byProject: Record<string, number> = {};
  const byMachine: Record<string, number> = {};
  const toolCounts: Record<string, number> = {};
  const byPeriod: Record<string, number> = {};
  const modelCounts: Record<string, number> = {};

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalDuration = 0;
  let totalUserMessages = 0;
  let totalAgentSpawns = 0;
  let totalCommits = 0;
  let totalToolCalls = 0;
  let earliest = "";
  let latest = "";

  for (const s of sessions) {
    // By project
    byProject[s.project] = (byProject[s.project] ?? 0) + 1;

    // By machine
    byMachine[s.machine] = (byMachine[s.machine] ?? 0) + 1;

    // Tokens
    totalInputTokens += s.input_tokens;
    totalOutputTokens += s.output_tokens;

    // Duration
    totalDuration += s.duration_minutes;

    // User messages
    totalUserMessages += s.user_messages;

    // Agent spawns
    totalAgentSpawns += s.agent_spawns;

    // Commits
    totalCommits += s.commits;

    // Tool calls
    totalToolCalls += s.tool_calls;

    // Tool distribution
    for (const tool of s.tool_types) {
      toolCounts[tool] = (toolCounts[tool] ?? 0) + 1;
    }

    // Sessions by week (Monday-start, using local date to avoid UTC shift)
    if (s.start_time) {
      const date = new Date(s.start_time);
      const day = date.getDay();
      const mondayOffset = day === 0 ? 6 : day - 1; // Sunday=6 back, Mon=0, Tue=1...
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - mondayOffset);
      const weekKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
      byPeriod[weekKey] = (byPeriod[weekKey] ?? 0) + 1;
    }

    // Models
    const modelKey = s.model || "(no assistant messages)";
    modelCounts[modelKey] = (modelCounts[modelKey] ?? 0) + 1;

    // Date range
    if (!earliest || s.start_time < earliest) earliest = s.start_time;
    if (!latest || s.start_time > latest) latest = s.start_time;
  }

  // Top 10 longest
  const longest = [...sessions]
    .sort((a, b) => b.duration_minutes - a.duration_minutes)
    .slice(0, 10)
    .map(toSummary);

  // Top 10 token-heaviest
  const heaviest = [...sessions]
    .sort(
      (a, b) =>
        b.input_tokens + b.output_tokens - (a.input_tokens + a.output_tokens)
    )
    .slice(0, 10)
    .map(toSummary);

  return {
    total_sessions: sessions.length,
    date_range: { earliest, latest },
    sessions_by_project: sortByValue(byProject),
    sessions_by_machine: sortByValue(byMachine),
    total_tokens: {
      input: totalInputTokens,
      output: totalOutputTokens,
      combined: totalInputTokens + totalOutputTokens,
    },
    avg_duration_minutes: sessions.length
      ? Math.round(totalDuration / sessions.length)
      : 0,
    avg_user_messages: sessions.length
      ? Math.round(totalUserMessages / sessions.length)
      : 0,
    agent_spawn_rate: sessions.length
      ? Math.round((totalAgentSpawns / sessions.length) * 100) / 100
      : 0,
    tool_distribution: sortByValue(toolCounts),
    sessions_by_period: byPeriod,
    longest_sessions: longest,
    token_heaviest_sessions: heaviest,
    total_commits: totalCommits,
    total_tool_calls: totalToolCalls,
    models_used: sortByValue(modelCounts),
  };
}

function toSummary(s: SessionRecord): SessionSummary {
  return {
    session_id: s.session_id.slice(0, 8),
    project: s.project,
    start_time: s.start_time.slice(0, 10),
    duration_minutes: s.duration_minutes,
    user_messages: s.user_messages,
    assistant_messages: s.assistant_messages,
    total_tokens: s.input_tokens + s.output_tokens,
    commits: s.commits,
  };
}

function sortByValue(obj: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(obj).sort(([, a], [, b]) => b - a)
  );
}

// ---------------------------------------------------------------------------
// Content analysis (correction detection from encrypted session content)
// ---------------------------------------------------------------------------

const AGE_KEY_PATH = join(
  process.env.HOME ?? "~",
  ".config",
  "age",
  "audiocontrol.key"
);

// Patterns that signal user corrections — case-insensitive, word-boundary-aware
const CORRECTION_PATTERNS: Array<{ signal: string; pattern: RegExp }> = [
  { signal: "no/stop", pattern: /\b(no[,.]?\s|stop\b|don't\b|do not\b)/i },
  { signal: "wrong", pattern: /\b(wrong|incorrect|that's not|that is not)\b/i },
  { signal: "why", pattern: /\bwhy (did you|are you|would you|is there|isn't)\b/i },
  { signal: "undo", pattern: /\b(revert|undo|roll back|put it back|remove that)\b/i },
  { signal: "not what I", pattern: /\bnot what I (asked|wanted|meant|said)\b/i },
  { signal: "too complex", pattern: /\b(too complex|over.?engineer|unnecessary|simpl)/i },
  { signal: "fabrication", pattern: /\b(made.?up|fabricat|you just|where did you get)\b/i },
];

function analyzeContent(since: string | null): ContentAnalysis | null {
  const contentDir = resolve(
    import.meta.dirname ?? process.cwd(),
    "..",
    "data",
    "sessions",
    "content"
  );

  if (!existsSync(contentDir) || !existsSync(AGE_KEY_PATH)) {
    return null;
  }

  const files = readdirSync(contentDir).filter((f) => f.endsWith(".jsonl.age"));
  if (files.length === 0) return null;

  let totalUserTexts = 0;
  let correctionCount = 0;
  const bySignal: Record<string, number> = {};
  const bySession: Record<string, number> = {};
  const samples: CorrectionMatch[] = [];

  for (const file of files) {
    // Filter by date if --since provided
    const fileDate = file.slice(0, 10);
    if (since && fileDate < since) continue;

    const filePath = join(contentDir, file);
    let plaintext: string;
    try {
      plaintext = execSync(
        `age -d -i "${AGE_KEY_PATH}" "${filePath}"`,
        { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 }
      );
    } catch {
      continue;
    }

    for (const line of plaintext.split("\n")) {
      if (!line.trim()) continue;

      let entry: { type: string; timestamp: string; content: Array<{ type: string; text?: string }> };
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }

      if (entry.type !== "user") continue;

      for (const block of entry.content) {
        if (block.type !== "text" || !block.text) continue;
        totalUserTexts++;

        const matched: string[] = [];
        for (const { signal, pattern } of CORRECTION_PATTERNS) {
          if (pattern.test(block.text)) {
            matched.push(signal);
            bySignal[signal] = (bySignal[signal] ?? 0) + 1;
          }
        }

        if (matched.length > 0) {
          correctionCount++;
          bySession[file] = (bySession[file] ?? 0) + 1;

          if (samples.length < 20) {
            samples.push({
              session_file: file,
              timestamp: entry.timestamp,
              text: block.text.slice(0, 200),
              signals: matched,
            });
          }
        }
      }
    }
  }

  return {
    total_user_text_messages: totalUserTexts,
    correction_count: correctionCount,
    correction_rate: totalUserTexts
      ? `${((correctionCount / totalUserTexts) * 100).toFixed(1)}%`
      : "0%",
    corrections_by_signal: sortByValue(bySignal),
    corrections_by_session: sortByValue(bySession),
    sample_corrections: samples,
  };
}

// ---------------------------------------------------------------------------
// Markdown output
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function renderContentAnalysis(content: ContentAnalysis): string {
  const lines: string[] = [];

  lines.push("### User Corrections");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| User text messages analyzed | ${formatNumber(content.total_user_text_messages)} |`);
  lines.push(`| Corrections detected | ${formatNumber(content.correction_count)} |`);
  lines.push(`| Correction rate | ${content.correction_rate} |`);
  lines.push("");

  if (Object.keys(content.corrections_by_signal).length > 0) {
    lines.push("**By signal type:**");
    lines.push("");
    lines.push("| Signal | Count |");
    lines.push("|--------|-------|");
    for (const [signal, count] of Object.entries(content.corrections_by_signal)) {
      lines.push(`| ${signal} | ${count} |`);
    }
    lines.push("");
  }

  if (Object.keys(content.corrections_by_session).length > 0) {
    lines.push("**Sessions with most corrections:**");
    lines.push("");
    lines.push("| Session | Corrections |");
    lines.push("|---------|-------------|");
    const top = Object.entries(content.corrections_by_session).slice(0, 10);
    for (const [session, count] of top) {
      lines.push(`| ${session.replace(".jsonl.age", "")} | ${count} |`);
    }
    lines.push("");
  }

  if (content.sample_corrections.length > 0) {
    lines.push("**Sample corrections (first 20):**");
    lines.push("");
    for (const c of content.sample_corrections) {
      const date = c.timestamp.slice(0, 10);
      const signals = c.signals.join(", ");
      const text = c.text.replace(/\n/g, " ").replace(/\|/g, "\\|");
      lines.push(`- **[${signals}]** (${date}): ${text}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function renderMarkdown(report: AnalysisReport, since: string | null, content: ContentAnalysis | null): string {
  const lines: string[] = [];

  lines.push("## Session Analytics Report");
  lines.push("");
  if (since) {
    lines.push(`**Filter:** sessions since ${since}`);
  }
  lines.push(
    `**Date range:** ${report.date_range.earliest.slice(0, 10)} to ${report.date_range.latest.slice(0, 10)}`
  );
  lines.push("");

  // Overview
  lines.push("### Overview");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total sessions | ${report.total_sessions} |`);
  lines.push(`| Total commits | ${formatNumber(report.total_commits)} |`);
  lines.push(
    `| Total tool calls | ${formatNumber(report.total_tool_calls)} |`
  );
  lines.push(
    `| Total tokens (input) | ${formatTokens(report.total_tokens.input)} |`
  );
  lines.push(
    `| Total tokens (output) | ${formatTokens(report.total_tokens.output)} |`
  );
  lines.push(`| Avg session duration (wall clock) | ${report.avg_duration_minutes} min |`);
  lines.push(`| Avg user messages/session | ${report.avg_user_messages} |`);
  lines.push(`| Agent spawns/session | ${report.agent_spawn_rate} |`);
  lines.push("");

  // Sessions by project
  lines.push("### Sessions by Project");
  lines.push("");
  lines.push("| Project | Sessions |");
  lines.push("|---------|----------|");
  for (const [project, count] of Object.entries(report.sessions_by_project)) {
    lines.push(`| ${project} | ${count} |`);
  }
  lines.push("");

  // Sessions by machine
  lines.push("### Sessions by Machine");
  lines.push("");
  lines.push("| Machine | Sessions |");
  lines.push("|---------|----------|");
  for (const [machine, count] of Object.entries(report.sessions_by_machine)) {
    lines.push(`| ${machine} | ${count} |`);
  }
  lines.push("");

  // Tool distribution
  lines.push("### Tool Distribution");
  lines.push("");
  lines.push("| Tool | Sessions Using |");
  lines.push("|------|---------------|");
  for (const [tool, count] of Object.entries(report.tool_distribution)) {
    lines.push(`| ${tool} | ${count} |`);
  }
  lines.push("");

  // Models used
  lines.push("### Models Used");
  lines.push("");
  lines.push("| Model | Sessions |");
  lines.push("|-------|----------|");
  for (const [model, count] of Object.entries(report.models_used)) {
    lines.push(`| ${model} | ${count} |`);
  }
  lines.push("");

  // Sessions over time
  const sortedWeeks = Object.entries(report.sessions_by_period).sort(
    ([a], [b]) => a.localeCompare(b)
  );
  if (sortedWeeks.length > 0) {
    lines.push("### Sessions by Week");
    lines.push("");
    lines.push("| Week Starting | Sessions |");
    lines.push("|--------------|----------|");
    for (const [week, count] of sortedWeeks) {
      lines.push(`| ${week} | ${count} |`);
    }
    lines.push("");
  }

  // Longest sessions
  lines.push("### Longest Sessions by Wall Clock (top 10)");
  lines.push("");
  lines.push(
    "| Project | Date | Wall Clock | User Msgs | Commits |"
  );
  lines.push(
    "|---------|------|------------|-----------|---------|"
  );
  for (const s of report.longest_sessions) {
    const hrs = Math.round(s.duration_minutes / 60);
    lines.push(
      `| ${s.project} | ${s.start_time} | ${hrs}h (${formatNumber(s.duration_minutes)}min) | ${s.user_messages} | ${s.commits} |`
    );
  }
  lines.push("");

  // Token-heaviest sessions
  lines.push("### Token-Heaviest Sessions (top 10)");
  lines.push("");
  lines.push(
    "| Project | Date | Tokens | User Msgs | Duration |"
  );
  lines.push(
    "|---------|------|--------|-----------|----------|"
  );
  for (const s of report.token_heaviest_sessions) {
    lines.push(
      `| ${s.project} | ${s.start_time} | ${formatTokens(s.total_tokens)} | ${s.user_messages} | ${s.duration_minutes}min |`
    );
  }
  lines.push("");

  // Content analysis (corrections)
  if (content) {
    lines.push(renderContentAnalysis(content));
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const { since, json } = parseArgs();
  const sessions = loadSessions(since);

  if (sessions.length === 0) {
    console.error("No sessions found" + (since ? ` since ${since}` : ""));
    process.exit(1);
  }

  const report = analyze(sessions);
  const content = analyzeContent(since);

  if (json) {
    console.log(JSON.stringify({ ...report, content }, null, 2));
  } else {
    console.log(renderMarkdown(report, since, content));
  }
}

main();
