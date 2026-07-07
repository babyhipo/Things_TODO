/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Things_TODO/',
  test: {
    // 모든 테스트 실행 전에 메모리 localStorage를 준비한다(스토어 테스트용)
    setupFiles: ['./src/test/setup.ts'],
  },
})
