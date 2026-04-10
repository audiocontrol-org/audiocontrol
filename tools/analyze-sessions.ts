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

interface LlmCorrection {
  category: string;
  description: string;
  user_quote: string;
}

interface SessionAnalysis {
  session: string;
  arc_type: string;
  arc_description: string;
  summary: string;
  correction_count: number;
  corrections: LlmCorrection[];
  patterns: string[];
  improvement_suggestions: string[];
}

interface ContentAnalysis {
  sessions_analyzed: number;
  arc_distribution: Record<string, number>;
  total_corrections: number;
  corrections_by_category: Record<string, number>;
  sessions_with_most_corrections: Array<{ session: string; count: number; arc_type: string }>;
  all_corrections: LlmCorrection[];
  all_patterns: string[];
  all_suggestions: string[];
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
// Content analysis (reads LLM analysis results from data/sessions/analysis/)
// ---------------------------------------------------------------------------

const AGE_KEY_PATH = join(
  process.env.HOME ?? "~",
  ".config",
  "age",
  "audiocontrol.key"
);

function loadLlmAnalysis(since: string | null): ContentAnalysis | null {
  const analysisDir = resolve(
    import.meta.dirname ?? process.cwd(),
    "..",
    "data",
    "sessions",
    "analysis"
  );

  if (!existsSync(analysisDir) || !existsSync(AGE_KEY_PATH)) return null;

  const files = readdirSync(analysisDir).filter((f) => f.endsWith(".json.age"));
  if (files.length === 0) return null;

  const arcDist: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const sessionCorrections: Array<{ session: string; count: number; arc_type: string }> = [];
  const allCorrections: LlmCorrection[] = [];
  const allPatterns: string[] = [];
  const allSuggestions: string[] = [];
  let totalCorrections = 0;

  for (const file of files) {
    const fileDate = file.slice(0, 10);
    if (since && fileDate < since) continue;

    const filePath = join(analysisDir, file);
    let plaintext: string;
    try {
      plaintext = execSync(`age -d -i "${AGE_KEY_PATH}" "${filePath}"`, {
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch {
      continue;
    }

    let record: { session: string; analysis: Record<string, unknown> };
    try {
      record = JSON.parse(plaintext);
    } catch {
      continue;
    }

    const a = record.analysis;
    const arcType = (a.arc_type as string) ?? "unknown";
    const corrections = (a.corrections as LlmCorrection[]) ?? [];
    const corrCount = (a.correction_count as number) ?? corrections.length;

    arcDist[arcType] = (arcDist[arcType] ?? 0) + 1;
    totalCorrections += corrCount;

    if (corrCount > 0) {
      sessionCorrections.push({ session: record.session, count: corrCount, arc_type: arcType });
    }

    for (const c of corrections) {
      allCorrections.push(c);
      byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
    }

    for (const p of (a.patterns as string[]) ?? []) allPatterns.push(p);
    for (const s of (a.improvement_suggestions as string[]) ?? []) allSuggestions.push(s);
  }

  sessionCorrections.sort((a, b) => b.count - a.count);

  return {
    sessions_analyzed: files.filter((f) => !since || f.slice(0, 10) >= since).length,
    arc_distribution: sortByValue(arcDist),
    total_corrections: totalCorrections,
    corrections_by_category: sortByValue(byCategory),
    sessions_with_most_corrections: sessionCorrections.slice(0, 10),
    all_corrections: allCorrections,
    all_patterns: allPatterns,
    all_suggestions: allSuggestions,
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

  lines.push("### LLM Session Analysis");
  lines.push("");
  lines.push(`*${content.sessions_analyzed} sessions analyzed via Claude Haiku*`);
  lines.push("");

  // Arc distribution
  if (Object.keys(content.arc_distribution).length > 0) {
    lines.push("**Arc types:**");
    lines.push("");
    lines.push("| Type | Sessions |");
    lines.push("|------|----------|");
    for (const [arc, count] of Object.entries(content.arc_distribution)) {
      lines.push(`| ${arc} | ${count} |`);
    }
    lines.push("");
  }

  // Corrections summary
  lines.push("**Corrections:**");
  lines.push("");
  lines.push(`Total: ${content.total_corrections} across ${content.sessions_analyzed} sessions`);
  lines.push("");

  if (Object.keys(content.corrections_by_category).length > 0) {
    lines.push("| Category | Count |");
    lines.push("|----------|-------|");
    for (const [cat, count] of Object.entries(content.corrections_by_category)) {
      lines.push(`| ${cat} | ${count} |`);
    }
    lines.push("");
  }

  // Sessions with most corrections
  if (content.sessions_with_most_corrections.length > 0) {
    lines.push("**Sessions with most corrections:**");
    lines.push("");
    lines.push("| Session | Arc | Corrections |");
    lines.push("|---------|-----|-------------|");
    for (const s of content.sessions_with_most_corrections) {
      lines.push(`| ${s.session} | ${s.arc_type} | ${s.count} |`);
    }
    lines.push("");
  }

  // Correction details
  if (content.all_corrections.length > 0) {
    lines.push("**Correction details:**");
    lines.push("");
    for (const c of content.all_corrections.slice(0, 30)) {
      const quote = c.user_quote.replace(/\n/g, " ").slice(0, 150);
      lines.push(`- **[${c.category}]** ${c.description}`);
      lines.push(`  > "${quote}"`);
    }
    lines.push("");
  }

  // Improvement suggestions (deduplicated)
  const uniqueSuggestions = [...new Set(content.all_suggestions)];
  if (uniqueSuggestions.length > 0) {
    lines.push("**Improvement suggestions:**");
    lines.push("");
    for (const s of uniqueSuggestions.slice(0, 15)) {
      lines.push(`- ${s}`);
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
  const content = loadLlmAnalysis(since);

  if (json) {
    console.log(JSON.stringify({ ...report, content }, null, 2));
  } else {
    console.log(renderMarkdown(report, since, content));
  }
}

main();
