import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  server: {
    allowedHosts: [
      'cheque-echo-handle-cognitive.trycloudflare.com',
      'stud-optimization-magnitude-relation.trycloudflare.com',
      'berry-infections-aged-prisoners.trycloudflare.com',
    ],
    proxy: {'/api': 'http://127.0.0.1:8000'},
    fs: {
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/backend/**', '**/.venv/**'],
    },
  },
});
