import { performResult } from "../src/eff.ts";
import {
  type Eff,
  eff,
  perform,
  defineHandlers,
  AsyncTask,
  Task,
} from "../src/mod.ts";

type PrintEffect = Eff<"print", any[]>;

function print(...args: any[]): PrintEffect {
  return eff("print", args);
}

async function* subTask(): AsyncTask<PrintEffect, number> {
  yield print("async:a");
  yield print("async:b");
  return 42;
}

function* subSyncTask(): Task<PrintEffect, void> {
  yield print("sync:a");
  yield print("sync:b");
}

type ProgramEffect = PrintEffect;
async function* program(): AsyncTask<ProgramEffect, number> {
  yield* subSyncTask();
  const v = yield* subTask();
  yield print("Start");
  return v;
}

{
  // run with handlers
  const handlers = defineHandlers<ProgramEffect>({
    print(args) {
      console.log(`print`, ...args);
    },
  });
  const result = await performResult(program(), handlers);
  console.log("Program result:", result);
}
