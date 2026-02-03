/**
 * Basic Deployment Example
 *
 * This example demonstrates the simplest usage of the controller-workflow module:
 * 1. Auto-detect connected controller
 * 2. Read configuration from slot 0
 * 3. Deploy to Ardour DAW
 *
 * @module controller-workflow/examples
 */

import { DeploymentWorkflow } from '../src/index.js';
import type { WorkflowOptions, WorkflowResult } from '../src/index.js';

/**
 * Main deployment function
 */
async function basicDeployment(): Promise<void> {
  console.log('Controller Workflow - Basic Deployment Example\n');

  // Step 1: Create workflow with auto-detection
  console.log('Creating workflow...');
  let workflow: DeploymentWorkflow | undefined;

  try {
    workflow = await DeploymentWorkflow.create({
      targets: ['ardour'],
    });

    console.log('Workflow created successfully\n');

    // Step 2: Set up progress monitoring
    workflow.on('progress', ({ step, message, data }) => {
      console.log(`[${step}/4] ${message}`);
      if (data) {
        console.log('  ', data);
      }
    });

    // Step 3: Optional - listen for canonical-saved event
    workflow.on('canonical-saved', ({ path, map }) => {
      console.log(`\nCanonical YAML saved to: ${path}`);
      console.log(`  Controls: ${map.controls.length}`);
      console.log(`  Device: ${map.device.manufacturer} ${map.device.model}`);
    });

    // Step 4: Optional - listen for errors
    workflow.on('error', (error) => {
      console.error('\nWorkflow error:', error.message);
    });

    // Step 5: Execute the workflow
    console.log('\nExecuting deployment workflow...\n');

    const options: WorkflowOptions = {
      configSlot: 0, // Read from slot 0
      targets: ['ardour'], // Deploy to Ardour
      preserveLabels: true, // Keep controller's control names
      outputDir: './output', // Save files to ./output directory
      autoInstall: false, // Don't automatically install to DAW directory (safer for demo)
    };

    const result: WorkflowResult = await workflow.execute(options);

    // Step 6: Handle results
    console.log('\n' + '='.repeat(60));
    if (result.success) {
      console.log('✅ Deployment successful!\n');

      // Display controller config details
      if (result.controllerConfig) {
        console.log('Controller Configuration:');
        console.log(`  Name: ${result.controllerConfig.name}`);
        console.log(`  Controls: ${result.controllerConfig.controls.length}`);
      }

      // Display canonical map path
      if (result.canonicalPath) {
        console.log(`\nCanonical YAML: ${result.canonicalPath}`);
      }

      // Display deployment results
      console.log('\nDeployment Results:');
      for (const deployment of result.deployments) {
        if (deployment.success) {
          console.log(`  ✅ ${deployment.dawName}: ${deployment.outputPath}`);
          if (deployment.installed) {
            console.log(`     (Installed to DAW config directory)`);
          }
        } else {
          console.log(`  ❌ ${deployment.dawName}: Failed`);
          if (deployment.errors) {
            deployment.errors.forEach((err) => console.log(`       - ${err}`));
          }
        }
      }
    } else {
      console.log('❌ Deployment failed\n');

      // Display errors
      if (result.errors.length > 0) {
        console.log('Errors:');
        for (const error of result.errors) {
          console.log(`  - ${error}`);
        }
      }
    }
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    // Handle unexpected errors
    console.error('\n❌ Unexpected error during deployment:');
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    } else {
      console.error(String(error));
    }
    process.exit(1);
  } finally {
    // Step 7: Always clean up
    if (workflow) {
      console.log('Cleaning up...');
      await workflow.cleanup();
      console.log('Done.\n');
    }
  }
}

/**
 * Enhanced example with plugin information
 */
async function deploymentWithPlugin(): Promise<void> {
  console.log('Controller Workflow - Deployment with Plugin Info\n');

  let workflow: DeploymentWorkflow | undefined;

  try {
    workflow = await DeploymentWorkflow.create({
      targets: ['ardour'],
    });

    // Add progress monitoring
    workflow.on('progress', ({ step, message }) => {
      console.log(`[${step}/4] ${message}`);
    });

    // Execute with plugin information
    const result = await workflow.execute({
      configSlot: 0,
      targets: ['ardour'],
      pluginInfo: {
        manufacturer: 'TAL Software',
        name: 'TAL-Filter',
      },
      midiChannel: 0, // Use MIDI channel 0
      preserveLabels: true,
      outputDir: './output',
      autoInstall: false,
    });

    if (result.success) {
      console.log('\n✅ Deployment with plugin info successful!');
      console.log(`   Canonical: ${result.canonicalPath}`);
      console.log(`   Ardour: ${result.deployments[0]?.outputPath}`);
    } else {
      console.error('\n❌ Deployment failed:', result.errors);
    }
  } finally {
    await workflow?.cleanup();
  }
}

/**
 * Dry-run example (preview without writing files)
 */
async function dryRunDeployment(): Promise<void> {
  console.log('Controller Workflow - Dry Run Example\n');

  let workflow: DeploymentWorkflow | undefined;

  try {
    workflow = await DeploymentWorkflow.create({
      targets: ['ardour'],
    });

    workflow.on('progress', ({ step, message }) => {
      console.log(`[${step}/4] ${message}`);
    });

    const result = await workflow.execute({
      configSlot: 0,
      targets: ['ardour'],
      preserveLabels: true,
      outputDir: './output',
      dryRun: true, // Preview mode - don't write files
    });

    console.log('\n📋 Dry run completed');
    console.log('   No files were written');
    console.log(`   Would have created: ${result.canonicalPath}`);
    console.log(`   Would have deployed to: ${result.deployments.length} DAW(s)`);
  } finally {
    await workflow?.cleanup();
  }
}

/**
 * Error handling example
 */
async function errorHandlingExample(): Promise<void> {
  console.log('Controller Workflow - Error Handling Example\n');

  let workflow: DeploymentWorkflow | undefined;

  try {
    workflow = await DeploymentWorkflow.create({
      targets: ['ardour'],
    });

    // Try to read from an invalid slot
    try {
      const result = await workflow.execute({
        configSlot: 999, // Invalid slot number
        targets: ['ardour'],
        outputDir: './output',
      });

      if (!result.success) {
        console.log('Workflow completed with errors:');
        result.errors.forEach((err) => console.log(`  - ${err}`));
      }
    } catch (error) {
      console.error('Caught error during execution:');
      if (error instanceof Error) {
        console.error(`  ${error.message}`);
      }
    }
  } catch (error) {
    // Handle workflow creation errors
    if (error instanceof Error) {
      if (error.message.includes('No supported controller detected')) {
        console.error('❌ No controller detected');
        console.error('   Please connect a supported controller (e.g., Launch Control XL 3)');
        console.error('   and ensure it is powered on.');
      } else {
        console.error(`❌ Error: ${error.message}`);
      }
    }
  } finally {
    await workflow?.cleanup();
  }
}

// Run the appropriate example based on command-line argument
const example = process.argv[2] || 'basic';

switch (example) {
  case 'basic':
    basicDeployment().catch(console.error);
    break;
  case 'plugin':
    deploymentWithPlugin().catch(console.error);
    break;
  case 'dry-run':
    dryRunDeployment().catch(console.error);
    break;
  case 'error':
    errorHandlingExample().catch(console.error);
    break;
  default:
    console.log('Usage: ts-node basic-deployment.ts [basic|plugin|dry-run|error]');
    process.exit(1);
}
