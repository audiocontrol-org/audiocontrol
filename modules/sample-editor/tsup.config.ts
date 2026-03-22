import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/ui/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    '@radix-ui/react-dialog',
    '@audiocontrol/synth-core',
    '@audiocontrol/sampler-library',
  ],
});
