import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/max-integration.ts',
  output: {
    file: 'dist/cc-router.js',
    format: 'es',
    // No IIFE wrapper - output bare JavaScript for Max
    // Max's js object needs functions at the top level
  },
  treeshake: false, // Disable tree-shaking to preserve all code including unused variables
  plugins: [
    resolve(),
    typescript({
      tsconfig: './tsconfig.json',
      outputToFilesystem: true,
      compilerOptions: {
        target: 'ES5',
        module: 'ES2015'
      }
    }),
    // Optional: minification for production builds
    // terser()
  ],
  // Tell Rollup to treat Max globals as external
  external: [],
  // Suppress warnings about circular dependencies or unused externals
  onwarn: function(warning, warn) {
    // Skip certain warnings
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return;
    // Use default for everything else
    warn(warning);
  }
};