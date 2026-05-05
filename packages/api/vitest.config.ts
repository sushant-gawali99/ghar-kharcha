import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    env: {
      UPLOAD_DIR: "/tmp/ghar-kharcha-test-uploads",
    },
  },
});
