import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/handler.ts"],
  outfile: "build/handler/index.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
  banner: {
    js: 'import { createRequire } from "node:module";const require = createRequire(import.meta.url);',
  },
  external: ["@aws-sdk/*"],
  minify: true,
  sourcemap: true,
});
