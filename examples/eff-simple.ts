import {
  type Eff,
  defineHandlers,
  defineEff,
  Task,
  performResult,
} from "../src/mod.ts";

type PrintEff = Eff<"print", string>;
type DelayEff = Eff<"delay", number>;
type NetworkEff = Eff<"network", { url: string }>;

const print = defineEff<"print", string>("print");
const delay = defineEff<"delay", number>("delay");
const doFetch = defineEff<"network", { url: string }>("network");

// effect with return value
function* runFetchTask(): Generator<
  NetworkEff,
  { ok: boolean; value: number }
> {
  return yield doFetch({
    url: "https://example.com/api/data",
  });
}

function* subTask(): Generator<PrintEff, void> {
  yield print("a");
  yield print("b");
  // @ts-expect-error type mismatch but it works
  yield delay(100);
}

type ProgramEffect = PrintEff | DelayEff | NetworkEff;
function* program(): Generator<ProgramEffect, number> {
  yield print("Start");
  yield delay(500);
  yield print("End");
  // yield* waitFor(subTask());
  yield* subTask();

  // const v = yield* waitFor(httpGetTask());
  const v = yield* runFetchTask();
  yield print(`HTTP GET result: ${v.ok}: ${v.value}`);
  return v.value;
}

{
  // run with handlers
  const handlers = defineHandlers<ProgramEffect>({
    print(payload) {
      console.log(`print ${payload}`);
    },
    delay: async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    },
    network: async (init) => {
      return Promise.resolve({
        ok: true,
        value: 42,
      });
    },
  });
  const result = await performResult(program(), handlers);
  console.log("Program result:", result);
}
