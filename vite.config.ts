import { defineConfig } from 'vite';

// GitHub Pages serves this project at https://<user>.github.io/brain-surgery-sim/
// so every asset URL must be prefixed with the repository name.
export default defineConfig({
  base: '/brain-surgery-sim/',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
});
