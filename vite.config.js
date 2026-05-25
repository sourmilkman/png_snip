import { defineConfig } from "vite";
export default defineConfig({
  base: "/png_snip/",
  server: {
    port: 5174
  },
  test: {
    environment: "jsdom",
    globals: true
  }
});
