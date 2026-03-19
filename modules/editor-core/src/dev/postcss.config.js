import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  plugins: {
    tailwindcss: {
      config: path.resolve(__dirname, 'tailwind.config.ts'),
    },
    autoprefixer: {},
  },
};
