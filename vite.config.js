import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        app: resolve(__dirname, 'app.html'),
        motherduck: resolve(__dirname, 'motherduck.html')
      }
    }
  },
  server: {
    port: 3000,
    open: '/login.html'
  }
});
