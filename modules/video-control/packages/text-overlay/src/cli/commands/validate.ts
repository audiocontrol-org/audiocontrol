import * as fs from "node:fs";
import { parseProject, validateYaml } from "../../parser/parse.js";

export async function validateCommand(projectPath: string): Promise<void> {
  // Validate project file exists
  if (!fs.existsSync(projectPath)) {
    console.error(`Error: Project file not found: ${projectPath}`);
    process.exit(1);
  }

  // Read project file
  const content = fs.readFileSync(projectPath, "utf-8");

  // Validate
  const errors = validateYaml(content);

  if (errors.length > 0) {
    console.error("❌ Validation failed:\n");
    errors.forEach((err) => console.error(`  ${err}`));
    process.exit(1);
  }

  // Parse to show summary
  try {
    const project = parseProject(content);

    console.log("✅ Validation passed\n");
    console.log(`Project: ${project.project.name}`);
    console.log(`Resolution: ${project.project.width}x${project.project.height}`);
    console.log(`Framerate: ${project.project.fps}fps`);
    console.log(`Duration: ${project.project.durationInFrames} frames`);
    console.log(`Overlays: ${project.overlays.length}`);
    console.log("");

    // List overlays
    console.log("Overlays:");
    project.overlays.forEach((overlay, i) => {
      const id = overlay.id ?? `#${i + 1}`;
      const frames = `${overlay.inFrame}-${overlay.outFrame}`;
      const displayText = overlay.title ?? "";
      console.log(`  [${overlay.type}] ${id}: "${displayText.slice(0, 30)}${displayText.length > 30 ? "..." : ""}" (frames ${frames})`);
    });
  } catch (err) {
    console.error("❌ Validation failed:");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
