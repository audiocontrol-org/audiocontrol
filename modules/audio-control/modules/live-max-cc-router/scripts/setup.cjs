#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Setup configuration
function setup() {
  console.log('🎛️  CC Router TypeScript Setup\n');
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 16) {
    console.error('❌ Node.js 16+ required. Current version:', nodeVersion);
    process.exit(1);
  }
  
  console.log('✅ Node.js version:', nodeVersion);
  
  // Install dependencies
  console.log('\n📦 Installing dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed');
  } catch (error) {
    console.error('❌ Failed to install dependencies');
    process.exit(1);
  }
  
  // Create necessary directories
  const dirs = ['dist', 'src'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    }
  });
  
  // Compile TypeScript
  console.log('\n🔨 Compiling TypeScript...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ TypeScript compiled successfully');
  } catch (error) {
    console.error('❌ TypeScript compilation failed');
    process.exit(1);
  }
  
  // Deploy to Max for Live
  console.log('\n🚀 Deploying to Max for Live...');
  try {
    execSync('npm run copy-to-max', { stdio: 'inherit' });
    console.log('✅ Deployed to Max for Live');
  } catch (error) {
    console.warn('⚠️  Deployment to Max for Live failed - you can deploy manually later');
  }
  
  // Create development files
  createDevelopmentFiles();
  
  console.log('\n🎉 Setup complete!\n');
  console.log('Next steps:');
  console.log('1. npm run watch    # Start TypeScript watch mode');
  console.log('2. Open Max for Live');
  console.log('3. Load the cc-router.maxpat file');
  console.log('4. Connect your Launch Control XL3');
  console.log('5. Start mapping!\n');
  
  console.log('Commands:');
  console.log('- npm run build     # Compile TypeScript');
  console.log('- npm run watch     # Auto-compile on changes');
  console.log('- npm run deploy    # Deploy to Max for Live');
  console.log('- npm run dev       # Watch + notifications');
}

function createDevelopmentFiles() {
  // Create a simple development guide
  const devGuide = `# CC Router Development Guide

## Quick Start

1. **Start development mode:**
   \`\`\`bash
   npm run dev
   \`\`\`

2. **Edit TypeScript files in src/**
   - src/cc-router.ts - Core routing logic
   - src/max-integration.ts - Max for Live interface
   - src/types.ts - Type definitions

3. **Files auto-compile to dist/**
   - dist/cc-router.js
   - dist/max-integration.js

## Workflow

1. Edit TypeScript files
2. Files auto-compile (if using \`npm run watch\`)
3. In Max for Live: reload the js object to pick up changes
4. Test your changes

## Max for Live Integration

- The compiled JavaScript goes to your Max projects folder
- Load cc-router.maxpat in Max for Live
- The patcher contains a \`js cc-router.js @autowatch 1\` object
- Send MIDI CC messages to test: \`[176, 13, 64]\`

## Testing

Send messages to the Max object:
- \`loadbang\` - Initialize
- \`help\` - Show commands  
- \`config\` - Show current mappings
- \`testcc 13 64\` - Test CC 13 with value 64
- \`debug 1\` - Enable debug output

## Adding New Features

1. Add types to \`src/types.ts\`
2. Implement logic in \`src/cc-router.ts\`
3. Add Max interface in \`src/max-integration.ts\`
4. Test in Max for Live

## Debugging

- Enable debug mode: \`debug 1\`
- Check Max console for output
- Use \`trackinfo\` to see current track/devices
- Use \`config\` to see current mappings
`;

  fs.writeFileSync('DEVELOPMENT.md', devGuide);
  console.log('✅ Created DEVELOPMENT.md');
  
  // Create a VS Code settings file for better TypeScript experience
  const vscodeDir = '.vscode';
  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir);
  }
  
  const vscodeSettings = {
    "typescript.preferences.quoteStyle": "single",
    "editor.insertSpaces": true,
    "editor.tabSize": 2,
    "files.watcherExclude": {
      "**/node_modules/**": true,
      "**/dist/**": true
    },
    "typescript.suggest.autoImports": false,
    "files.associations": {
      "*.js": "javascript"
    }
  };
  
  fs.writeFileSync(path.join(vscodeDir, 'settings.json'), JSON.stringify(vscodeSettings, null, 2));
  console.log('✅ Created .vscode/settings.json');
}

// Run setup
if (require.main === module) {
  setup();
}

module.exports = { setup };
