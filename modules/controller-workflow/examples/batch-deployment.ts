/**
 * Batch Deployment Example
 *
 * This example demonstrates how to:
 * 1. Deploy multiple configuration slots to multiple DAWs
 * 2. Track progress across multiple deployments
 * 3. Aggregate and report errors
 * 4. Generate deployment summary reports
 *
 * @module controller-workflow/examples
 */

import { DeploymentWorkflow } from '../src/index.js';
import type { WorkflowOptions, WorkflowResult, DeploymentResult } from '../src/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for a batch deployment job
 */
interface BatchDeploymentJob {
  /** Configuration slot to read */
  slot: number;
  /** Target DAWs for this slot */
  targets: string[];
  /** Optional plugin name */
  pluginName?: string;
  /** Optional custom output directory */
  outputDir?: string;
}

/**
 * Result of a single batch job
 */
interface BatchJobResult {
  /** The job that was executed */
  job: BatchDeploymentJob;
  /** Workflow result */
  result: WorkflowResult;
  /** Time taken in milliseconds */
  durationMs: number;
}

/**
 * Complete batch deployment summary
 */
interface BatchSummary {
  /** Total jobs executed */
  totalJobs: number;
  /** Number of successful jobs */
  successfulJobs: number;
  /** Number of failed jobs */
  failedJobs: number;
  /** Total deployments attempted */
  totalDeployments: number;
  /** Successful deployments */
  successfulDeployments: number;
  /** Individual job results */
  jobResults: BatchJobResult[];
  /** Total time taken in milliseconds */
  totalDurationMs: number;
}

// ============================================================================
// Batch Deployment Engine
// ============================================================================

/**
 * Execute multiple deployment jobs sequentially
 */
async function executeBatchDeployment(jobs: BatchDeploymentJob[]): Promise<BatchSummary> {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Batch Deployment - ${jobs.length} job(s)`);
  console.log('='.repeat(70) + '\n');

  const startTime = Date.now();
  const jobResults: BatchJobResult[] = [];

  // Create workflow once and reuse for all jobs
  let workflow: DeploymentWorkflow | undefined;

  try {
    console.log('Initializing workflow...');
    workflow = await DeploymentWorkflow.create({
      targets: [], // Targets will be specified per-job
    });
    console.log('Workflow initialized\n');

    // Execute each job
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`Job ${i + 1}/${jobs.length}: Slot ${job.slot} → [${job.targets.join(', ')}]`);
      console.log('─'.repeat(70));

      const jobStartTime = Date.now();

      // Set up progress monitoring for this job
      let currentStep = 0;
      const progressHandler = ({ step, message }: { step: number; message: string }) => {
        if (step !== currentStep) {
          currentStep = step;
          console.log(`\n[Step ${step}/4]`);
        }
        console.log(`  ${message}`);
      };

      workflow.on('progress', progressHandler);

      try {
        // Build workflow options for this job
        const options: WorkflowOptions = {
          configSlot: job.slot,
          targets: job.targets,
          ...(job.pluginName && {
            pluginInfo: {
              manufacturer: 'Unknown',
              name: job.pluginName,
            },
          }),
          preserveLabels: true,
          outputDir: job.outputDir || `./output/slot-${job.slot}`,
          autoInstall: false, // Safer for batch operations
        };

        // Execute workflow
        const result = await workflow.execute(options);
        const jobDuration = Date.now() - jobStartTime;

        // Store result
        jobResults.push({
          job,
          result,
          durationMs: jobDuration,
        });

        // Display job summary
        if (result.success) {
          console.log(`\n✅ Job ${i + 1} completed successfully in ${jobDuration}ms`);
        } else {
          console.log(`\n❌ Job ${i + 1} failed in ${jobDuration}ms`);
          if (result.errors.length > 0) {
            console.log('   Errors:');
            result.errors.forEach((err) => console.log(`     - ${err}`));
          }
        }
      } catch (error) {
        // Handle job-level errors
        const jobDuration = Date.now() - jobStartTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        console.log(`\n❌ Job ${i + 1} threw an error in ${jobDuration}ms`);
        console.log(`   Error: ${errorMessage}`);

        jobResults.push({
          job,
          result: {
            success: false,
            deployments: [],
            errors: [errorMessage],
          },
          durationMs: jobDuration,
        });
      } finally {
        // Remove progress handler
        workflow.off('progress', progressHandler);
      }
    }
  } finally {
    // Clean up workflow
    if (workflow) {
      await workflow.cleanup();
    }
  }

  const totalDuration = Date.now() - startTime;

  // Calculate summary statistics
  const summary: BatchSummary = {
    totalJobs: jobs.length,
    successfulJobs: jobResults.filter((r) => r.result.success).length,
    failedJobs: jobResults.filter((r) => !r.result.success).length,
    totalDeployments: jobResults.reduce((sum, r) => sum + r.result.deployments.length, 0),
    successfulDeployments: jobResults.reduce(
      (sum, r) => sum + r.result.deployments.filter((d) => d.success).length,
      0
    ),
    jobResults,
    totalDurationMs: totalDuration,
  };

  return summary;
}

/**
 * Display batch deployment summary
 */
function displayBatchSummary(summary: BatchSummary): void {
  console.log(`\n${'='.repeat(70)}`);
  console.log('Batch Deployment Summary');
  console.log('='.repeat(70) + '\n');

  console.log(`Total Jobs:        ${summary.totalJobs}`);
  console.log(`Successful:        ${summary.successfulJobs} ✅`);
  console.log(`Failed:            ${summary.failedJobs} ❌`);
  console.log(`Total Deployments: ${summary.totalDeployments}`);
  console.log(`Successful DAW Deployments: ${summary.successfulDeployments}`);
  console.log(`Total Duration:    ${summary.totalDurationMs}ms\n`);

  // Job-by-job breakdown
  console.log('Job Results:');
  console.log('─'.repeat(70));

  summary.jobResults.forEach((jobResult, index) => {
    const { job, result, durationMs } = jobResult;
    const icon = result.success ? '✅' : '❌';

    console.log(`\n${icon} Job ${index + 1}: Slot ${job.slot} (${durationMs}ms)`);

    if (result.controllerConfig) {
      console.log(`   Config: ${result.controllerConfig.name}`);
    }

    if (result.canonicalPath) {
      console.log(`   Canonical: ${result.canonicalPath}`);
    }

    // DAW deployment results
    if (result.deployments.length > 0) {
      console.log('   Deployments:');
      result.deployments.forEach((deployment) => {
        const depIcon = deployment.success ? '  ✅' : '  ❌';
        console.log(`   ${depIcon} ${deployment.dawName}: ${deployment.outputPath || 'N/A'}`);
        if (!deployment.success && deployment.errors) {
          deployment.errors.forEach((err) => console.log(`        - ${err}`));
        }
      });
    }

    // Errors
    if (result.errors.length > 0) {
      console.log('   Errors:');
      result.errors.forEach((err) => console.log(`     - ${err}`));
    }
  });

  console.log('\n' + '='.repeat(70) + '\n');
}

/**
 * Save batch summary to JSON file
 */
async function saveBatchReport(summary: BatchSummary, outputPath: string): Promise<void> {
  // Create a JSON-serializable version of the summary
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalJobs: summary.totalJobs,
      successfulJobs: summary.successfulJobs,
      failedJobs: summary.failedJobs,
      totalDeployments: summary.totalDeployments,
      successfulDeployments: summary.successfulDeployments,
      totalDurationMs: summary.totalDurationMs,
    },
    jobs: summary.jobResults.map((jobResult) => ({
      slot: jobResult.job.slot,
      targets: jobResult.job.targets,
      pluginName: jobResult.job.pluginName,
      success: jobResult.result.success,
      durationMs: jobResult.durationMs,
      configName: jobResult.result.controllerConfig?.name,
      canonicalPath: jobResult.result.canonicalPath,
      deployments: jobResult.result.deployments.map((d) => ({
        dawName: d.dawName,
        success: d.success,
        outputPath: d.outputPath,
        errors: d.errors,
      })),
      errors: jobResult.result.errors,
    })),
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`📊 Batch report saved to: ${outputPath}`);
}

// ============================================================================
// Example Batch Jobs
// ============================================================================

/**
 * Example 1: Deploy multiple slots to Ardour
 */
async function example1_MultipleSlots(): Promise<void> {
  const jobs: BatchDeploymentJob[] = [
    {
      slot: 0,
      targets: ['ardour'],
      pluginName: 'TAL-Filter',
      outputDir: './output/batch-1/slot-0',
    },
    {
      slot: 1,
      targets: ['ardour'],
      pluginName: 'Dexed',
      outputDir: './output/batch-1/slot-1',
    },
    {
      slot: 2,
      targets: ['ardour'],
      outputDir: './output/batch-1/slot-2',
    },
  ];

  const summary = await executeBatchDeployment(jobs);
  displayBatchSummary(summary);
  await saveBatchReport(summary, './output/batch-1/report.json');
}

/**
 * Example 2: Deploy single slot to multiple DAWs
 */
async function example2_MultipleDaws(): Promise<void> {
  const jobs: BatchDeploymentJob[] = [
    {
      slot: 0,
      targets: ['ardour'], // Add 'live' when Live deployer is available
      pluginName: 'TAL-Filter',
      outputDir: './output/batch-2',
    },
  ];

  const summary = await executeBatchDeployment(jobs);
  displayBatchSummary(summary);
  await saveBatchReport(summary, './output/batch-2/report.json');
}

/**
 * Example 3: Deploy all slots to all DAWs (comprehensive)
 */
async function example3_Comprehensive(): Promise<void> {
  // Generate jobs for slots 0-7
  const jobs: BatchDeploymentJob[] = [];

  for (let slot = 0; slot < 8; slot++) {
    jobs.push({
      slot,
      targets: ['ardour'], // Add more DAWs as they become available
      outputDir: `./output/batch-3/slot-${slot}`,
    });
  }

  const summary = await executeBatchDeployment(jobs);
  displayBatchSummary(summary);
  await saveBatchReport(summary, './output/batch-3/report.json');
}

/**
 * Example 4: Error handling - deploy from invalid slots
 */
async function example4_ErrorHandling(): Promise<void> {
  const jobs: BatchDeploymentJob[] = [
    {
      slot: 0,
      targets: ['ardour'],
    },
    {
      slot: 999, // Invalid slot
      targets: ['ardour'],
    },
    {
      slot: 1,
      targets: ['ardour'],
    },
  ];

  const summary = await executeBatchDeployment(jobs);
  displayBatchSummary(summary);

  // Demonstrate error filtering
  console.log('\nFailed Jobs:');
  const failedJobs = summary.jobResults.filter((r) => !r.result.success);
  failedJobs.forEach((jobResult) => {
    console.log(`  Slot ${jobResult.job.slot}: ${jobResult.result.errors.join(', ')}`);
  });
}

/**
 * Example 5: Progress tracking with callbacks
 */
async function example5_ProgressTracking(): Promise<void> {
  const jobs: BatchDeploymentJob[] = [
    { slot: 0, targets: ['ardour'] },
    { slot: 1, targets: ['ardour'] },
  ];

  console.log('Batch Deployment with Progress Tracking\n');

  let completedJobs = 0;
  const totalJobs = jobs.length;

  const summary = await executeBatchDeployment(jobs);

  // Track progress (in real implementation, you'd update UI or progress bar)
  summary.jobResults.forEach((result, index) => {
    completedJobs++;
    const percentage = ((completedJobs / totalJobs) * 100).toFixed(0);
    console.log(`\nProgress: ${percentage}% (${completedJobs}/${totalJobs})`);
  });

  displayBatchSummary(summary);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const example = process.argv[2] || 'multiple-slots';

  try {
    switch (example) {
      case 'multiple-slots':
        await example1_MultipleSlots();
        break;

      case 'multiple-daws':
        await example2_MultipleDaws();
        break;

      case 'comprehensive':
        await example3_Comprehensive();
        break;

      case 'error-handling':
        await example4_ErrorHandling();
        break;

      case 'progress-tracking':
        await example5_ProgressTracking();
        break;

      default:
        console.log('Usage: ts-node batch-deployment.ts [example]');
        console.log('\nAvailable examples:');
        console.log('  multiple-slots     - Deploy multiple slots to Ardour');
        console.log('  multiple-daws      - Deploy single slot to multiple DAWs');
        console.log('  comprehensive      - Deploy all slots to all DAWs');
        console.log('  error-handling     - Demonstrate error handling');
        console.log('  progress-tracking  - Track progress with callbacks');
        process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Batch deployment failed:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  }
}

main().catch(console.error);
