import { defineConfig } from 'vite';

// Relative base so the site works under https://<user>.github.io/<repo>/ and locally.
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
});
