/**
 * Controller Workflow Module
 *
 * Provides a generalized framework for:
 * 1. Interrogating MIDI controllers for configuration data
 * 2. Converting controller-specific formats to canonical MIDI mappings
 * 3. Deploying to multiple DAWs (Ardour, Ableton Live, etc.)
 *
 * @module controller-workflow
 */

// Export all type definitions
export * from './types/index.js';

// Export controller adapters
export * from './adapters/controllers/LaunchControlXL3Adapter.js';

// Export canonical converters
export * from './converters/LaunchControlXL3Converter.js';

// Export DAW deployers
export * from './adapters/daws/ArdourDeployer.js';
export * from './adapters/daws/LiveDeployer.js';

// Export services
export * from './services/index.js';

// Export orchestrator (core workflow engine)
export * from './orchestrator/DeploymentWorkflow.js';
