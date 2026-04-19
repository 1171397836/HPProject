import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        app: resolve(__dirname, 'app.html'),
        motherduck: resolve(__dirname, 'motherduck.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  },
  server: {
    port: 3000,
    open: '/login.html'
  }
});
