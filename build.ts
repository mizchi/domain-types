// ex. scripts/build_npm.ts
import { build, emptyDir } from "@deno/dnt";
import config from "./deno.json" with { type: "json" };

await emptyDir("./npm");

await build({
  entryPoints: ["./src/mod.ts"], // entry point for your package
  outDir: "./npm",
  // typeCheck: false,
  test: false,
  shims: {
    // see JS docs for overview and more options
    // deno: true,
  },
  package: {
    // package.json properties
    name: config.name,
    version: config.version,
    description: "type utilities for domain modeling",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/mizchi/domain-types.git",
    },
    bugs: {
      url: "https://github.com/mizchi/domain-types/issues",
    },
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});
