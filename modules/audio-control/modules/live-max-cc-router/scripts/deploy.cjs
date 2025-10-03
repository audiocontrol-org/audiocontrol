#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { createAMXDBinary, createMaxForLiveDevice } = require('./create-amxd-binary.cjs');

// Configuration
const SOURCE_FILE = path.join(__dirname, '..', 'dist', 'cc-router.js');
const PROJECT_NAME = 'cc-router';

// Platform-specific Max for Live paths
function getMaxForLivePaths() {
  const platform = os.platform();
  const homeDir = os.homedir();
  
  const paths = [];
  
  if (platform === 'darwin') { // macOS
    paths.push(
      path.join(homeDir, 'Music', 'Ableton', 'User Library', 'Presets', 'Audio Effects', 'Max Audio Effect'),
      path.join(homeDir, 'Documents', 'Max 8', 'Projects'),
      path.join(homeDir, 'Documents', 'Max 9', 'Projects'),
      path.join('/Applications', 'Max.app', 'Contents', 'Resources', 'C74', 'projects')
    );
  } else if (platform === 'win32') { // Windows
    paths.push(
      path.join(homeDir, 'Documents', 'Ableton', 'User Library', 'Presets', 'Audio Effects', 'Max Audio Effect'),
      path.join(homeDir, 'Documents', 'Max 8', 'Projects'),
      path.join(homeDir, 'Documents', 'Max 9', 'Projects'),
      path.join('C:', 'Program Files', 'Cycling \'74', 'Max 8', 'projects'),
      path.join('C:', 'Program Files', 'Cycling \'74', 'Max 9', 'projects')
    );
  }
  
  return paths;
}

// Find the best deployment location
function findDeploymentPath() {
  const possiblePaths = getMaxForLivePaths();
  
  for (const basePath of possiblePaths) {
    if (fs.existsSync(basePath)) {
      const targetDir = path.join(basePath, PROJECT_NAME);
      return { basePath, targetDir };
    }
  }
  
  return null;
}

// Create deployment directory structure
function createProjectStructure(targetDir) {
  const dirs = [
    targetDir,
    path.join(targetDir, 'code'),
    path.join(targetDir, 'docs')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

// Copy files to deployment location
function deployFiles(targetDir) {
  const deployments = [
    {
      source: SOURCE_FILE,
      target: path.join(targetDir, 'cc-router.js'),
      description: 'Main CC Router JavaScript'
    },
    {
      source: path.join(__dirname, 'ioRouting.js'),
      target: path.join(targetDir, 'ioRouting.js'),
      description: 'MIDI Routing Helper'
    },
    {
      source: path.join(__dirname, '..', 'README.md'),
      target: path.join(targetDir, 'docs', 'README.md'),
      description: 'Documentation'
    }
  ];

  deployments.forEach(({ source, target, description }) => {
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, target);
      console.log(`✅ Deployed: ${description} -> ${target}`);
    } else {
      console.log(`⚠️  Source not found: ${source}`);
    }
  });
}

// Create a Max for Live Audio Effect device
function createMaxDevice(targetDir) {
  const deviceContent = createMaxForLiveDevice();
  const binaryContent = createAMXDBinary(deviceContent);

  const devicePath = path.join(targetDir, 'cc-router.amxd');
  fs.writeFileSync(devicePath, binaryContent);
  console.log(`✅ Created Max for Live device: ${devicePath}`);
}

// Main deployment function
function deploy() {
  console.log('🚀 Deploying CC Router to Max for Live...\n');
  
  // Check if compiled JavaScript exists
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`❌ Compiled JavaScript not found: ${SOURCE_FILE}`);
    console.log('Run "npm run build" first to compile TypeScript.');
    process.exit(1);
  }
  
  // Find deployment location
  const deploymentInfo = findDeploymentPath();
  if (!deploymentInfo) {
    console.error('❌ Could not find Max for Live installation path.');
    console.log('Please ensure Max for Live is installed and try again.');
    process.exit(1);
  }
  
  const { basePath, targetDir } = deploymentInfo;
  console.log(`📁 Deploying to: ${targetDir}`);
  console.log(`📍 Base path: ${basePath}\n`);
  
  // Create project structure
  createProjectStructure(targetDir);
  
  // Deploy files
  deployFiles(targetDir);
  
  // Create Max for Live device
  createMaxDevice(targetDir);
  
  console.log('\n✅ Deployment complete!');
  console.log('\nNext steps:');
  console.log('1. Open Max for Live');
  console.log(`2. Navigate to: ${targetDir}`);
  console.log('3. Drag cc-router.amxd to an audio track');
  console.log('4. Save as an Audio Effect in your Live set');
  console.log('5. Send MIDI CC messages to the device');
  
  console.log('\nDevelopment workflow:');
  console.log('- Edit TypeScript files in src/');
  console.log('- Run "npm run watch" for auto-compilation');
  console.log('- Run "npm run deploy" to update Max device');
}

// Run deployment
if (require.main === module) {
  deploy();
}

module.exports = { deploy, getMaxForLivePaths, findDeploymentPath };
