import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Hosts supplémentaires autorisés pour cette exécution uniquement (preview cloud).
const hostsSupplementaires = (process.env.VITE_PREVIEW_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h: string) => h.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: hostsSupplementaires,
  },
});
