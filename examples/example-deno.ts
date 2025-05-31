import {
  type EffectFor,
  type AsyncHandlersFor,
  type HandlersFor,
  defineEffect,
  performAsync,
  effectFrom,
  perform,
} from "@mizchi/domain-types";
import path from "node:path";

// Define effects using defineEffect
const cwd = effectFrom<"Deno$cwd", typeof Deno.cwd>("Deno$cwd");
const readTextFile = effectFrom<"Deno$readTextFile", typeof Deno.readTextFile>(
  "Deno$readTextFile"
);
const writeTextFile = effectFrom<
  "Deno$writeTextFile",
  typeof Deno.writeTextFile
>("Deno$writeTextFile");

const getEnv = effectFrom<
  "Deno$get$env",
  (envKey: string) => string | undefined
>("Deno$get$env");

const runCmd = defineEffect<
  "Deno$NewCommand",
  [command: string, args: string[]],
  {
    ok: boolean;
    stdout: string;
    stderr: string;
  }
>("Deno$NewCommand");

const log = defineEffect<"log", [message: string], void>("log");

// Type for all effects
type DenoProgramEffect =
  | EffectFor<typeof cwd>
  | EffectFor<typeof readTextFile>
  | EffectFor<typeof writeTextFile>
  | EffectFor<typeof getEnv>
  | EffectFor<typeof runCmd>
  | EffectFor<typeof log>;

// Main program
function* program(): Generator<DenoProgramEffect, void> {
  const home = yield* getEnv("HOME");

  const zshrcPath = path.join(home!, ".zshrc");
  const result = yield* readTextFile(zshrcPath);

  yield* log(`File read from ${zshrcPath}: ${result.length} bytes`);
  const ls = yield* runCmd("ls", ["-l"]);
  if (ls.ok) {
    yield* log(`command succeeded: ${ls.stdout}`);
  } else {
    yield* log(`command failed: ${ls.stderr}`);
  }
}

// Handlers
{
  const handlers: AsyncHandlersFor<DenoProgramEffect> = {
    [cwd.t]: Deno.cwd,
    [readTextFile.t]: Deno.readTextFile,
    [writeTextFile.t]: Deno.writeTextFile,
    [getEnv.t]: Deno.env.get,
    async [runCmd.t](command, args) {
      const cmd = new Deno.Command(command, {
        args,
        stdout: "piped",
        stderr: "piped",
      });
      const { success, stdout, stderr } = await cmd.output();
      return {
        ok: success,
        stdout: new TextDecoder().decode(stdout),
        stderr: new TextDecoder().decode(stderr),
      };
    },
    [log.t]: (message) => {
      console.log(`[log] ${message}`);
    },
  };

  // Execute the program
  console.log("=== Running Deno Program ===");
  const steps = await Array.fromAsync(performAsync(program(), handlers));
  console.log("Program steps:", steps);
}

{
  // Mocked
  console.log("=== Running Mocked Deno Program ===");
  const handlers: HandlersFor<DenoProgramEffect> = {
    [cwd.t]: Deno.cwd,
    [readTextFile.t]: () => {
      return "Mocked file content";
    },
    [writeTextFile.t]() {
      console.log("Mocked writeTextFile called");
    },
    [getEnv.t](envKey) {
      if (envKey === "HOME") {
        return "/mocked/home";
      }
    },
    [runCmd.t](command, args) {
      return {
        ok: true,
        stderr: "ls: mocked stderr",
        stdout: "ls; mocked stdout",
      };
    },
    [log.t]: (message) => {
      console.log(`[log] ${message}`);
    },
  };
  const steps = perform(program(), handlers);
  console.log("Program steps:", Array.from(steps));
}
