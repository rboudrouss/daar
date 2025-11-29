import { defineConfig } from "tsup";
import { copyFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  platform: "node",
  onSuccess: async () => {
    // Copier schema.sql dans dist/db/
    const srcPath = join(__dirname, "src/db/schema.sql");
    const destDir = join(__dirname, "dist/");
    const destPath = join(destDir, "schema.sql");

    mkdirSync(destDir, { recursive: true });
    copyFileSync(srcPath, destPath);
    console.log("- Copied schema.sql to dist/db/");
  },
});
