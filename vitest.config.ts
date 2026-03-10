import { defineConfig } from "vitest/config";
import { resolve } from "path";

console.log(process.env);

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
