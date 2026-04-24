import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      UPLOAD_DIR: "/tmp/ghar-kharcha-test-uploads",
    },
  },
});
