import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@snap/react-camera-kit": path.resolve(__dirname, "../dist/esm/index.js"),
    },
  },
});
