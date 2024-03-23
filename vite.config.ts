import { sveltekit } from "@sveltejs/kit/vite";
import wasm from "vite-plugin-wasm";
import { defineConfig } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";

import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));

export default defineConfig({
  plugins: [sveltekit(), wasm(), topLevelAwait()],
  ssr: {
    noExternal: ["gridstack"],
  },
  resolve: {
    alias: {
      // "@onsetsoftware/automerge-patcher": path.resolve(
      //   __dirname,
      //   "../packages/npm/automerge-patcher/src",
      // ),
      // "@onsetsoftware/automerge-repo-undo-redo": path.resolve(
      //   __dirname,
      //   "../packages/npm/automerge-repo-undo-redo/src",
      // ),
    },
  },
});
