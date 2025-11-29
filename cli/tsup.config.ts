import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  platform: "node",
  noExternal: [/.*/],
  minify: true,
  treeshake: true,
  shims: true,
  banner: {
    js: "#!/usr/bin/env -S node --expose-gc",
  },
});
