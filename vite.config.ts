
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react-swc';
  import path from 'path';

  export default defineConfig({
    plugins: [react()],
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'esnext',
      outDir: 'dist',
      // Минификация включена для продакшена
      // Если возникают проблемы с порядком инициализации, установите DISABLE_MINIFY=true
      minify: process.env.DISABLE_MINIFY !== 'true' ? 'esbuild' : false,
      rollupOptions: {
        output: {
          chunkSizeWarningLimit: 1000,
          format: 'es',
        },
        // Tree-shaking включен для оптимизации размера бандла
        // Если возникают проблемы, установите DISABLE_TREESHAKE=true
        treeshake: process.env.DISABLE_TREESHAKE !== 'true',
      },
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
    },
    server: {
      port: 3000,
      open: true,
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
    },
  });