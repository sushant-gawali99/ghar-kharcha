import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/db/migrate.ts"],
  format: ["esm"],
  target: "node22",
  bundle: true,
  sourcemap: true,
  clean: true,
  external: [
    // Native addons that can't be bundled
    "pg-native",
  ],
});
