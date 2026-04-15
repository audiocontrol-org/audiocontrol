#!/usr/bin/env node

import { program } from "commander";
import { renderCommand } from "./commands/render.js";
import { validateCommand } from "./commands/validate.js";
import { templatesCommand } from "./commands/templates.js";
import { initCommand } from "./commands/init.js";

program
  .name("textoverlay")
  .version("1.0.0")
  .description("Generate text overlay videos from YAML definitions");

program
  .command("render <project>")
  .description("Render a text overlay video from a YAML project file")
  .option("-o, --output <path>", "Output file path", "output.mov")
  .option(
    "--format <format>",
    "Output format: prores, png-sequence, webm",
    "prores"
  )
  .option("--range <range>", "Time range to render (e.g., 0:45-1:00)")
  .option("--concurrency <n>", "Number of frames to render in parallel", "4")
  .action(renderCommand);

program
  .command("validate <project>")
  .description("Validate a YAML project file without rendering")
  .action(validateCommand);

program
  .command("templates")
  .description("List available overlay templates")
  .action(templatesCommand);

program
  .command("init")
  .description("Generate a sample project file")
  .option("-o, --output <path>", "Output file path (defaults to stdout)")
  .action(initCommand);

program.parse();
