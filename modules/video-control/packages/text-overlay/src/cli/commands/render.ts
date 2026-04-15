import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { parseProject } from "../../parser/parse.js";
import { parseTimecode } from "../../utils/timing.js";

export interface RenderOptions {
  output: string;
  format: "prores" | "png-sequence" | "webm";
  range?: string;
  concurrency: string;
}

export async function renderCommand(
  projectPath: string,
  options: RenderOptions
): Promise<void> {
  // Validate project file exists
  if (!fs.existsSync(projectPath)) {
    console.error(`Error: Project file not found: ${projectPath}`);
    process.exit(1);
  }

  // Read and parse project
  const content = fs.readFileSync(projectPath, "utf-8");
  let project;

  try {
    project = parseProject(content);
  } catch (err) {
    console.error("Error parsing project file:");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  console.log(`📹 Rendering: ${project.project.name}`);
  console.log(`   Resolution: ${project.project.width}x${project.project.height}`);
  console.log(`   Duration: ${project.project.durationInFrames} frames @ ${project.project.fps}fps`);
  console.log(`   Overlays: ${project.overlays.length}`);

  // Build remotion render command
  const args: string[] = ["remotion", "render"];

  // Composition ID
  args.push("TextOverlay");

  // Output path
  const outputPath = path.resolve(options.output);
  args.push("--output", outputPath);

  // Format-specific options
  switch (options.format) {
    case "prores":
      args.push("--codec", "prores");
      args.push("--prores-profile", "4444");
      args.push("--pixel-format", "yuva444p10le");
      break;
    case "png-sequence":
      args.push("--image-format", "png");
      args.push("--sequence");
      break;
    case "webm":
      args.push("--codec", "vp9");
      args.push("--pixel-format", "yuva420p");
      break;
  }

  // Frame range
  if (options.range) {
    const [start, end] = options.range.split("-");
    if (start && end) {
      const startFrame = parseTimecode(start, project.project.fps);
      const endFrame = parseTimecode(end, project.project.fps);
      args.push("--frames", `${startFrame}-${endFrame}`);
    }
  }

  // Concurrency
  args.push("--concurrency", options.concurrency);

  // Write project data to temp file to avoid shell escaping issues
  const propsFile = path.join(os.tmpdir(), `remotion-props-${Date.now()}.json`);
  fs.writeFileSync(propsFile, JSON.stringify({ project }));
  args.push("--props", propsFile);

  // Mute audio (overlays don't have audio)
  args.push("--muted");

  console.log(`\n🎬 Starting render...`);

  // Execute render without shell to avoid escaping issues
  const remotion = spawn("npx", args, {
    stdio: "inherit",
  });

  const cleanup = () => {
    try {
      fs.unlinkSync(propsFile);
    } catch {
      // Ignore cleanup errors
    }
  };

  remotion.on("close", (code) => {
    cleanup();
    if (code === 0) {
      console.log(`\n✅ Render complete: ${outputPath}`);
    } else {
      console.error(`\n❌ Render failed with code ${code}`);
      process.exit(code ?? 1);
    }
  });

  remotion.on("error", (err) => {
    cleanup();
    console.error("Failed to start render:", err.message);
    process.exit(1);
  });
}
