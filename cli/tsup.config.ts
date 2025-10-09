import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  platform: 'node',
  // Bundle everything including @monorepo/lib and commander
  noExternal: [/.*/],
  // Add shebang for CLI executable
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
})

