#!/usr/bin/env tsx
/**
 * Check if the integration test environment is properly set up
 */

import chalk from 'chalk';

async function checkEnvironment(): Promise<boolean> {
  let allGood = true;

  console.log(chalk.bold('\n🔍 Integration Test Environment Check\n'));
  console.log('═'.repeat(50));

  // Check 1: JUCE MIDI Server
  console.log(chalk.cyan('\n1. JUCE MIDI Server (required)'));
  try {
    const response = await fetch('http://localhost:7777/health', { signal: AbortSignal.timeout(2000) });
    const data = await response.json();

    if (data.status === 'ok') {
      console.log(chalk.green('   ✓ Server running on http://localhost:7777'));

      // Check for available ports
      const portsResponse = await fetch('http://localhost:7777/ports');
      const ports = await portsResponse.json();

      const hasLCXL3 = ports.inputs.some((p: string) => p.includes('LCXL3')) &&
                       ports.outputs.some((p: string) => p.includes('LCXL3'));

      if (hasLCXL3) {
        console.log(chalk.green('   ✓ Launch Control XL3 detected'));
        console.log(chalk.gray('     Inputs:', ports.inputs.filter((p: string) => p.includes('LCXL3')).join(', ')));
        console.log(chalk.gray('     Outputs:', ports.outputs.filter((p: string) => p.includes('LCXL3')).join(', ')));
      } else {
        console.log(chalk.yellow('   ⚠ Launch Control XL3 not detected'));
        console.log(chalk.gray('     Available inputs:', ports.inputs.join(', ')));
        console.log(chalk.gray('     Available outputs:', ports.outputs.join(', ')));
        allGood = false;
      }
    }
  } catch (error: any) {
    console.log(chalk.red('   ✗ Server not running'));
    console.log(chalk.yellow('   → Start with: pnpm env:juce-server'));
    allGood = false;
  }

  // Check 2: Device Connection
  console.log(chalk.cyan('\n2. Device Connection'));
  if (allGood) {
    console.log(chalk.green('   ✓ Ready for testing'));
  } else {
    console.log(chalk.red('   ✗ Not ready - fix issues above first'));
  }

  // Summary
  console.log('\n' + '═'.repeat(50));
  if (allGood) {
    console.log(chalk.green.bold('\n✅ Environment ready for integration tests!\n'));
    console.log(chalk.cyan('Run tests with:'));
    console.log(chalk.white('  pnpm test:round-trip:node'));
    console.log(chalk.white('  pnpm backup'));
  } else {
    console.log(chalk.red.bold('\n❌ Environment not ready\n'));
    console.log(chalk.cyan('Setup instructions:'));
    console.log(chalk.white('  1. Start JUCE server: pnpm env:juce-server'));
    console.log(chalk.white('  2. Connect Launch Control XL3 via USB'));
    console.log(chalk.white('  3. Power on the device'));
    console.log(chalk.white('  4. Re-run this check: pnpm env:check'));
    console.log(chalk.gray('\nFor help: pnpm env:help'));
  }

  console.log();
  return allGood;
}

checkEnvironment()
  .then(ready => process.exit(ready ? 0 : 1))
  .catch(error => {
    console.error(chalk.red('Environment check failed:'), error.message);
    process.exit(1);
  });
