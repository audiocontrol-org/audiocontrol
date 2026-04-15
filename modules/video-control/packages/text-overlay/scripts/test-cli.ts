#!/usr/bin/env tsx
/**
 * Quick test script for CLI functionality
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parseProject, validateYaml } from "../src/parser/parse";

const projectRoot = path.dirname(__dirname);
const samplePath = path.join(projectRoot, "sample.yaml");

console.log("=== CLI Functionality Test ===\n");

// Test 1: Validate command functionality
console.log("1. Testing validate command...");
if (fs.existsSync(samplePath)) {
  const content = fs.readFileSync(samplePath, "utf-8");
  const errors = validateYaml(content);
  if (errors.length === 0) {
    console.log("   ✅ sample.yaml validation passed\n");
  } else {
    console.log("   ❌ Validation errors:");
    errors.forEach((e) => console.log(`      ${e}`));
    console.log("");
  }
} else {
  console.log("   ❌ sample.yaml not found\n");
}

// Test 2: Parse command functionality
console.log("2. Testing parse functionality...");
try {
  const content = fs.readFileSync(samplePath, "utf-8");
  const project = parseProject(content);
  console.log(`   ✅ Project parsed: "${project.project.name}"`);
  console.log(`      Resolution: ${project.project.width}x${project.project.height}`);
  console.log(`      Duration: ${project.project.durationInFrames} frames @ ${project.project.fps}fps`);
  console.log(`      Overlays: ${project.overlays.length}`);
  project.overlays.forEach((overlay, i) => {
    console.log(`        ${i + 1}. [${overlay.type}] ${overlay.id ?? "(unnamed)"} (${overlay.inFrame}-${overlay.outFrame})`);
  });
  console.log("");
} catch (err) {
  console.log(`   ❌ Parse error: ${err instanceof Error ? err.message : String(err)}\n`);
}

// Test 3: Invalid YAML handling
console.log("3. Testing error handling...");
const invalidYaml = `
project:
  name: "Test"
  resolution: [1920, 1080]
  framerate: 30
  duration: "1:00"

overlays:
  - type: invalid-type
    text: "This should fail"
    in: "0:01"
    out: "0:05"
`;

const invalidErrors = validateYaml(invalidYaml);
if (invalidErrors.length > 0) {
  console.log("   ✅ Invalid YAML correctly rejected");
  console.log(`      Error: ${invalidErrors[0].slice(0, 80)}...`);
} else {
  console.log("   ❌ Invalid YAML should have been rejected");
}

console.log("\n=== All tests complete ===");
