import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/renderer/svgeditEntry.ts'),
      name: 'SvgEditorBundle',
      formats: ['iife'],
      fileName: () => 'bundle.js'
    },
    outDir: resolve(__dirname, 'resources'),
    emptyOutDir: false,
    sourcemap: false,
    minify: true,
    rollupOptions: {
      output: {
        // Inline all assets into the bundle
        inlineDynamicImports: true
      }
    }
  },
  define: {
    // SVG Edit may reference process.env
    'process.env': '{}',
    'process.env.NODE_ENV': '"production"'
  },
  css: {
    // Inline CSS into the JS bundle
    modules: {
      localsConvention: 'camelCase'
    }
  },
  resolve: {
    alias: {
      // Ensure we resolve svgcanvas from node_modules
      '@svgedit/svgcanvas': resolve(__dirname, 'node_modules/@svgedit/svgcanvas/dist/svgcanvas.js')
    }
  }
})
