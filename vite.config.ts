import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    open: false
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'motion/react',
      'jspdf',
      '@hugeicons/react',
      '@hugeicons/core-free-icons'
    ]
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ui-primitives': ['motion', '@hugeicons/react', '@hugeicons/core-free-icons'],
          'pdf-export': ['jspdf']
        }
      }
    }
  }
});
