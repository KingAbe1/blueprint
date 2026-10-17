import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            if (
              id.includes('/services/codebaseAnalysisService')
              || id.includes('/services/qualityExtendedFindings')
              || id.includes('/services/functionComplexityAnalysis')
              || id.includes('/services/frameworks/')
              || id.includes('/services/architectureAnalysisService')
              || id.includes('/services/dependencyRiskService')
            ) {
              return 'brownfield-analysis';
            }
            if (id.includes('/components/project/CodebaseAnalysisView')) {
              return 'brownfield-ui';
            }
            return undefined;
          }
          if (id.includes('node_modules/typescript')) {
            return 'typescript';
          }
          return undefined;
        },
      },
    },
  },
})
