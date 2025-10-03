#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const chokidar = require('chokidar');
const { findDeploymentPath } = require('./deploy');

// Configuration
const SOURCE_FILE = path.join(__dirname, '..', 'dist', 'cc-router.js');
const PROJECT_NAME = 'cc-router';

// Find deployment location
const deploymentInfo = findDeploymentPath();
if (!deploymentInfo) {
  console.error('❌ Could not find Max for Live installation path.');
  console.log('Please ensure Max for Live is installed and try again.');
  process.exit(1);
}

const { targetDir } = deploymentInfo;
const targetFile = path.join(targetDir, 'cc-router.js');

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log(`Created directory: ${targetDir}`);
}

// Copy function with error handling
function copyToMax() {
  if (fs.existsSync(SOURCE_FILE)) {
    try {
      fs.copyFileSync(SOURCE_FILE, targetFile);
      const timestamp = new Date().toTimeString().split(' ')[0];
      console.log(`[${timestamp}] ✅ Copied to Max: ${targetFile}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to copy: ${error.message}`);
      return false;
    }
  } else {
    console.log('⏳ Waiting for build output...');
    return false;
  }
}

// Start Rollup in watch mode
console.log('🚀 Starting Rollup in watch mode...');
console.log(`📁 Auto-deploying to: ${targetFile}`);
console.log('📍 Max autowatch will detect changes automatically\n');

const rollup = spawn('npx', ['rollup', '-c', '-w'], {
  stdio: 'pipe',
  shell: true
});

// Handle Rollup output
rollup.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);

  // When Rollup finishes building, copy to Max
  if (output.includes('created dist/cc-router.js') || output.includes('updated')) {
    setTimeout(() => {
      copyToMax();
    }, 100); // Small delay to ensure file is fully written
  }
});

rollup.stderr.on('data', (data) => {
  process.stderr.write(data);
});

// Also watch the dist directory as a fallback
const watcher = chokidar.watch(SOURCE_FILE, {
  persistent: true,
  ignoreInitial: false,
  awaitWriteFinish: {
    stabilityThreshold: 100,
    pollInterval: 100
  }
});

watcher.on('add', () => {
  console.log('📝 Initial file detected');
  copyToMax();
});

watcher.on('change', () => {
  copyToMax();
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Stopping watch mode...');
  rollup.kill();
  watcher.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  rollup.kill();
  watcher.close();
  process.exit(0);
});

// Initial copy if file exists
if (fs.existsSync(SOURCE_FILE)) {
  copyToMax();
}

console.log('👀 Watching for changes... (Ctrl+C to stop)\n');