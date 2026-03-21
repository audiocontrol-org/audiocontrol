import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/ui/index.ts', 'src/workers/loop-detection.worker.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', '@audiocontrol/sampler-library', '@audiocontrol/sampler-library/browser'],
});
