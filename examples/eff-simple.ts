import { type Eff, eff, runEff, createHandlers, waitFor } from "../src/mod.ts";

type PrintEffect = Eff<"print", string>;
type DelayEffect = Eff<"delay", number>;

function print(message: string): PrintEffect {
  return eff("print", message);
}
function delay(ms: number): DelayEffect {
  return eff("delay", ms);
}

async function* subTask(): AsyncGenerator<PrintEffect> {
  yield print("a");
  yield print("b");

  // @ts-expect-error type mismatch but it works
  yield delay(100);
}

type ProgramEffect = PrintEffect | DelayEffect;
async function* program(): AsyncGenerator<ProgramEffect> {
  yield print("Start");
  yield delay(500);
  yield print("End");
  yield* waitFor(subTask());
}

{
  // run with handlers
  const handlers = createHandlers<ProgramEffect>({
    async print(payload) {
      console.log(`[PRINT] ${payload}`);
    },
    delay: async (payload) => {
      await new Promise((resolve) => setTimeout(resolve, payload));
    },
  });
  await runEff(program(), handlers);
}
