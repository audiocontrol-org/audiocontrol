#!/usr/bin/env tsx
/**
 * Automated Protocol Test Suite
 *
 * Comprehensive test automation for verifying protocol fixes
 * after other agents complete their implementations.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

interface TestResult {
  phase: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'ERROR';
  details: string;
  timestamp: string;
}

interface CompilationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  duration: number;
}

interface RoundTripResult {
  slot: number;
  writeSuccess: boolean;
  readSuccess: boolean;
  dataIntegrity: boolean;
  nameMatch: boolean;
  controlCountMatch: boolean;
  patternDetected: boolean;
  error?: string;
}

class ProtocolTestAutomation {
  private results: TestResult[] = [];
  private startTime = Date.now();
  private reportPath = join(process.cwd(), 'test-automation-results.md');

  /**
   * Execute complete test automation suite
   */
  async runTestSuite(): Promise<void> {
    console.log('🤖 Launch Control XL3 Protocol Test Automation');
    console.log('='.repeat(50));
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log();

    try {
      // Phase 1: Compilation Verification
      await this.runCompilationTests();

      // Phase 2: Round-Trip Testing
      await this.runRoundTripTests();

      // Phase 3: Results Analysis
      await this.generateReport();

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.addResult('EXECUTION', 'Test Suite', 'ERROR',
        `Test suite execution failed: ${(error as Error).message}`);
    }

    console.log('\n📊 Test automation complete');
    console.log(`Total duration: ${((Date.now() - this.startTime) / 1000).toFixed(2)}s`);
    console.log(`Report saved to: ${this.reportPath}`);
  }

  /**
   * Phase 1: Compilation verification
   */
  private async runCompilationTests(): Promise<CompilationResult> {
    console.log('🔧 Phase 1: Compilation Verification');
    console.log('-'.repeat(30));

    const startTime = Date.now();

    try {
      console.log('→ Running TypeScript compilation...');

      // Clean first
      await execAsync('npm run clean');
      console.log('  ✓ Clean completed');

      // Build
      const { stdout, stderr } = await execAsync('npm run build');
      const duration = Date.now() - startTime;

      console.log(`  ✓ Build completed in ${(duration / 1000).toFixed(2)}s`);

      const result: CompilationResult = {
        success: true,
        errors: [],
        warnings: [],
        duration
      };

      // Parse stderr for warnings/errors
      if (stderr) {
        const lines = stderr.split('\n').filter(line => line.trim());
        result.warnings = lines.filter(line =>
          line.includes('warning') || line.includes('Warning'));
        result.errors = lines.filter(line =>
          line.includes('error') || line.includes('Error'));
      }

      this.addResult('COMPILATION', 'TypeScript Build', 'PASS',
        `Build successful in ${(duration / 1000).toFixed(2)}s. ` +
        `Warnings: ${result.warnings.length}, Errors: ${result.errors.length}`);

      if (result.warnings.length > 0) {
        console.log(`  ⚠️  ${result.warnings.length} warnings found`);
        result.warnings.forEach(w => console.log(`    ${w}`));
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`  ❌ Build failed after ${(duration / 1000).toFixed(2)}s`);
      console.error('  Error:', (error as any).stderr || (error as Error).message);

      this.addResult('COMPILATION', 'TypeScript Build', 'FAIL',
        `Build failed: ${(error as any).stderr || (error as Error).message}`);

      return {
        success: false,
        errors: [(error as any).stderr || (error as Error).message],
        warnings: [],
        duration
      };
    }
  }

  /**
   * Phase 2: Round-trip testing
   */
  private async runRoundTripTests(): Promise<RoundTripResult[]> {
    console.log('\n🔄 Phase 2: Round-Trip Protocol Testing');
    console.log('-'.repeat(30));

    try {
      console.log('→ Running round-trip test...');

      const { stdout, stderr } = await execAsync('npx tsx utils/test-round-trip.ts', {
        timeout: 120000 // 2 minute timeout
      });

      console.log('  ✓ Round-trip test completed');

      // Parse results from stdout
      const results = this.parseRoundTripOutput(stdout);

      // Log summary
      const passed = results.filter(r => r.writeSuccess && r.readSuccess && r.dataIntegrity);
      const failed = results.filter(r => !r.writeSuccess || !r.readSuccess || !r.dataIntegrity);

      console.log(`  ✓ Passed: ${passed.length}/${results.length} slots`);
      if (failed.length > 0) {
        console.log(`  ❌ Failed: ${failed.length}/${results.length} slots`);
        failed.forEach(f => {
          console.log(`    Slot ${f.slot}: Write: ${f.writeSuccess}, Read: ${f.readSuccess}, Integrity: ${f.dataIntegrity}`);
        });
      }

      // Add individual results
      results.forEach(result => {
        const status = (result.writeSuccess && result.readSuccess && result.dataIntegrity) ? 'PASS' : 'FAIL';
        const details = `Write: ${result.writeSuccess}, Read: ${result.readSuccess}, ` +
          `Integrity: ${result.dataIntegrity}, Name: ${result.nameMatch}, ` +
          `Count: ${result.controlCountMatch}, Pattern: ${result.patternDetected}`;

        this.addResult('ROUND_TRIP', `Slot ${result.slot}`, status, details);
      });

      return results;

    } catch (error) {
      console.log('  ❌ Round-trip test failed');
      console.error('  Error:', (error as any).stderr || (error as Error).message);

      this.addResult('ROUND_TRIP', 'Test Execution', 'ERROR',
        `Round-trip test failed: ${(error as any).stderr || (error as Error).message}`);

      return [];
    }
  }

  /**
   * Parse round-trip test output
   */
  private parseRoundTripOutput(output: string): RoundTripResult[] {
    const results: RoundTripResult[] = [];
    const lines = output.split('\n');

    let currentSlot = -1;
    let writeSuccess = false;
    let readSuccess = false;
    let nameMatch = false;
    let controlCountMatch = false;
    let patternDetected = false;

    for (const line of lines) {
      // Detect slot testing
      const slotMatch = line.match(/=== Testing Slot (\d+) ===/);
      if (slotMatch) {
        // Save previous slot result if exists
        if (currentSlot >= 0) {
          results.push({
            slot: currentSlot,
            writeSuccess,
            readSuccess,
            dataIntegrity: nameMatch && controlCountMatch,
            nameMatch,
            controlCountMatch,
            patternDetected
          });
        }

        // Reset for new slot
        currentSlot = parseInt(slotMatch[1]);
        writeSuccess = false;
        readSuccess = false;
        nameMatch = false;
        controlCountMatch = false;
        patternDetected = false;
        continue;
      }

      // Detect success/failure patterns
      if (line.includes('✓ Write completed')) {
        writeSuccess = true;
      } else if (line.includes('✗ Write failed')) {
        writeSuccess = false;
      } else if (line.includes('✓ Read successful')) {
        readSuccess = true;
      } else if (line.includes('✗ Read failed') || line.includes('✗ Read returned empty')) {
        readSuccess = false;
      } else if (line.includes('Name: ✓')) {
        nameMatch = true;
      } else if (line.includes('Control count: ✓')) {
        controlCountMatch = true;
      } else if (line.includes('Test name pattern found: ✓')) {
        patternDetected = true;
      }
    }

    // Save last slot result
    if (currentSlot >= 0) {
      results.push({
        slot: currentSlot,
        writeSuccess,
        readSuccess,
        dataIntegrity: nameMatch && controlCountMatch,
        nameMatch,
        controlCountMatch,
        patternDetected
      });
    }

    return results;
  }

  /**
   * Generate comprehensive report
   */
  private async generateReport(): Promise<void> {
    console.log('\n📊 Phase 3: Report Generation');
    console.log('-'.repeat(30));

    const totalDuration = Date.now() - this.startTime;
    const passedTests = this.results.filter(r => r.status === 'PASS').length;
    const failedTests = this.results.filter(r => r.status === 'FAIL').length;
    const errorTests = this.results.filter(r => r.status === 'ERROR').length;

    const report = this.generateMarkdownReport(totalDuration, passedTests, failedTests, errorTests);

    try {
      writeFileSync(this.reportPath, report);
      console.log(`  ✓ Report generated: ${this.reportPath}`);
    } catch (error) {
      console.error('  ❌ Failed to write report:', (error as Error).message);
    }

    // Console summary
    console.log('\n📈 Test Summary:');
    console.log(`  • Passed: ${passedTests}`);
    console.log(`  • Failed: ${failedTests}`);
    console.log(`  • Errors: ${errorTests}`);
    console.log(`  • Total: ${this.results.length}`);
    console.log(`  • Success Rate: ${((passedTests / this.results.length) * 100).toFixed(1)}%`);
  }

  /**
   * Generate markdown report content
   */
  private generateMarkdownReport(totalDuration: number, passed: number, failed: number, errors: number): string {
    const timestamp = new Date().toISOString();
    const successRate = ((passed / this.results.length) * 100).toFixed(1);

    return `# Launch Control XL3 Protocol Fix Verification

## Test Automation Report
**Date:** ${timestamp}
**Test Agent:** test-automator
**Test Suite:** Round-trip Protocol Verification
**Duration:** ${(totalDuration / 1000).toFixed(2)}s

## Executive Summary

- **✅ Passed:** ${passed} tests
- **❌ Failed:** ${failed} tests
- **🚨 Errors:** ${errors} tests
- **📊 Success Rate:** ${successRate}%

## Test Results

### Phase 1: Compilation Verification
${this.results.filter(r => r.phase === 'COMPILATION').map(r =>
  `- **${r.test}:** ${r.status === 'PASS' ? '✅' : '❌'} ${r.status} - ${r.details}`
).join('\n')}

### Phase 2: Round-Trip Testing
${this.results.filter(r => r.phase === 'ROUND_TRIP').map(r =>
  `- **${r.test}:** ${r.status === 'PASS' ? '✅' : '❌'} ${r.status} - ${r.details}`
).join('\n')}

## Detailed Results

| Phase | Test | Status | Details | Timestamp |
|-------|------|--------|---------|-----------|
${this.results.map(r =>
  `| ${r.phase} | ${r.test} | ${r.status} | ${r.details} | ${r.timestamp} |`
).join('\n')}

## Analysis

### Protocol Improvements Verified
${this.analyzeImprovements()}

### Remaining Issues
${this.identifyRemainingIssues()}

### Recommendations
${this.generateRecommendations()}

---
**Report generated by test-automator on ${timestamp}**`;
  }

  private analyzeImprovements(): string {
    const roundTripResults = this.results.filter(r => r.phase === 'ROUND_TRIP' && r.status === 'PASS');
    if (roundTripResults.length === 0) {
      return "- No successful round-trip operations detected";
    }

    return `- Successfully verified ${roundTripResults.length} slot operations
- Protocol fixes appear to be working for verified slots
- Data integrity maintained across write/read cycles`;
  }

  private identifyRemainingIssues(): string {
    const failures = this.results.filter(r => r.status === 'FAIL' || r.status === 'ERROR');
    if (failures.length === 0) {
      return "- No issues detected - all tests passed";
    }

    return failures.map(f => `- ${f.phase}/${f.test}: ${f.details}`).join('\n');
  }

  private generateRecommendations(): string {
    const failures = this.results.filter(r => r.status === 'FAIL' || r.status === 'ERROR');
    if (failures.length === 0) {
      return "- Protocol fixes successful - ready for production use\n- Consider automated regression testing for future changes";
    }

    return "- Address remaining test failures before deployment\n- Investigate protocol issues in failed slots\n- Consider additional error handling improvements";
  }

  /**
   * Add test result
   */
  private addResult(phase: string, test: string, status: 'PASS' | 'FAIL' | 'ERROR', details: string): void {
    this.results.push({
      phase,
      test,
      status,
      details,
      timestamp: new Date().toISOString()
    });
  }
}

// Main execution
if (require.main === module) {
  const automation = new ProtocolTestAutomation();
  automation.runTestSuite().catch(console.error);
}

export { ProtocolTestAutomation };