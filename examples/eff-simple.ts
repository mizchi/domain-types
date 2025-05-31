import {
  type Eff,
  defineHandlers,
  defineEff,
  performResult,
  defineTask,
  type AsEffResult,
} from "../src/mod.ts";

type PrintEff = Eff<"print", (p: string) => void>;
type DelayEff = Eff<"delay", (p: number) => void>;
type NetworkEff = Eff<
  "network",
  (p: { url: string }) => {
    ok: boolean;
    value: number;
  }
>;

const print = defineEff<"print", (p: string) => void>("print");
const delay = defineEff<"delay", (p: number) => void>("delay");
const doFetch = defineEff<
  "network",
  (p: { url: string }) => {
    ok: boolean;
    value: number;
  }
>("network");

const myTask = defineTask<NetworkEff>(async (eff) => {
  // Simulate a network request
  console.log(`Fetching from ${eff.payload.url}`);
  return {
    ok: true,
    value: 42,
  };
});

function* runFetchTask(): Generator<
  NetworkEff,
  { ok: boolean; value: number }
> {
  const v = yield doFetch({
    url: "https://example.com/api/data",
  });
  return v as AsEffResult<NetworkEff>;
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
