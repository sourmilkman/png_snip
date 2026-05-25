import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/png_snip/",
  plugins: [react()],
  server: {
    port: 5174
  },
  test: {
    environment: "jsdom",
    globals: true
  }
});
