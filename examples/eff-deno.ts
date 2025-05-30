import {
  type Eff,
  eff,
  perform,
  defineHandlers,
  AsyncTask,
  Task,
} from "../src/mod.ts";
import path from "node:path";
import { performResult } from "../src/eff.ts";
import { run } from "node:test";

type FsReadEffect = Eff<"fsRead", { path: string }>;
type FsWriteEffect = Eff<"fsWrite", { path: string; content: string }>;
type NetworkEffect = Eff<"network", { url: string; init: RequestInit }>;
type EnvEffect = Eff<"env", { key: string }>;
type RunEffect = Eff<"run", { command: string; args: string[] }>;
type DenoProgramEffect =
  | FsReadEffect
  | FsWriteEffect
  | NetworkEffect
  | EnvEffect
  | RunEffect;

function fsRead(path: string): FsReadEffect {
  return eff("fsRead", { path });
}

function fsWrite(path: string, content: string): FsWriteEffect {
  return eff("fsWrite", { path, content });
}

function networkRequest(url: string, init: RequestInit): NetworkEffect {
  return eff("network", { url, init });
}

function getEnv(key: string): EnvEffect {
  return eff("env", { key });
}

function runCommand(command: string, args: string[]): RunEffect {
  return eff("run", { command, args });
}

async function* readFileTask(
  filepath: string
): AsyncGenerator<FsReadEffect, string> {
  return yield fsRead(filepath);
}

async function* readEnvTask(key: string): AsyncGenerator<EnvEffect, string> {
  return yield getEnv(key);
}

// run with handlers
const denoHandlers = defineHandlers<DenoProgramEffect>({
  fsRead: async ({ path }) => {
    const data = await Deno.readTextFile(path);
    return data;
  },
  fsWrite: async ({ path, content }) => {
    await Deno.writeTextFile(path, content);
  },
  network: async ({ url, init }) => {
    const response = await fetch(url, init);
    return response.json();
  },
  env: ({ key }) => {
    return Deno.env.get(key);
  },
  run: async ({ command, args }) => {
    const cmd = new Deno.Command(command, {
      args,
      stdout: "piped",
      stderr: "piped",
    });
    const { code, success, signal, stdout, stderr } = await cmd.output();
    return {
      code,
      success,
      signal,
      stdout: new TextDecoder().decode(stdout),
      stderr: new TextDecoder().decode(stderr),
    };
  },
});

/// -----------
type LogEffect = Eff<"log", string>;
function log(message: string): LogEffect {
  return eff("log", message);
}

function* runCommandTask(
  cmd: string,
  args: string[]
): Generator<RunEffect, { code: number; stdout: string; stderr: string }> {
  return yield eff("run", {
    command: cmd,
    args,
  });
}

async function* program(): AsyncTask<DenoProgramEffect | LogEffect, void> {
  const home = yield* readEnvTask("HOME");
  const zshrcPath = path.join(home, ".zshrc");
  const result = yield* readFileTask(zshrcPath);
  yield log(`File read from ${zshrcPath}: ${result.length} bytes`);
  const ls = yield* runCommandTask("ls", ["-l"]);
  if (ls.code === 0) {
    yield log(`command succeeded: ${ls.stdout}`);
  } else {
    yield log(`command failed: ${ls.stderr}`);
  }
}

{
  const handlers = defineHandlers<LogEffect>({
    log(payload) {
      console.log(`[log] ${payload}`);
    },
  });

  const result = await performResult(program(), {
    ...handlers,
    ...denoHandlers,
  });
  console.log("Program result:", result);
}
