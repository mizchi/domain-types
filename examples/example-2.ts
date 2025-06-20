import {
  type HandlersFor,
  type EffectFor,
  type SyncHandlersFor,
  defineEffect,
  performAsync,
  performSync,
} from "@mizchi/domain-types";

const print = defineEffect<"log", [input: string], void>("log");
const delay = defineEffect<"delay", [ms: number], void>("delay");
const network = defineEffect<
  "network",
  [string],
  {
    ok: boolean;
    value: number;
  }
>("network");

function* subTask(): Generator<EffectFor<typeof print>, void> {
  yield* print("b");
  // @ts-expect-error type mismatch but it works
  yield* delay(100);
}

type ProgramEffect =
  | EffectFor<typeof print>
  | EffectFor<typeof delay>
  | EffectFor<typeof network>;
function* program(): Generator<ProgramEffect, number> {
  yield* print("Start");
  yield* delay(500);
  yield* print("End");
  yield* subTask();
  const v = yield* network("https://example.com");
  yield* print(`HTTP GET result: ${v.ok}: ${v.value}`);
  return v.value;
}

{
  // sync
  const syncHandlers: SyncHandlersFor<ProgramEffect> = {
    [print.t](payload) {
      console.log(`print ${payload}`);
    },
    [delay.t](ms) {
      console.log(`delay ${ms}ms`);
    },
    [network.t](url) {
      console.log(`network ${JSON.stringify(url)}`);
      // Simulate a network response
      return { ok: true, value: 42 };
    },
  };
  for (const g of performSync(program(), syncHandlers)) {
    console.log(`Step:`, g);
  }
}
{
  // async
  const handlers: HandlersFor<ProgramEffect> = {
    [print.t](payload) {
      console.log(`print ${payload}`);
    },
    async [delay.t](ms) {
      console.log(`delay ${ms}ms`);
      await new Promise((resolve) => setTimeout(resolve, ms));
    },
    async [network.t](url) {
      console.log(`network ${JSON.stringify(url)}`);
      return { ok: true, value: 42 };
    },
  };
  for await (const e of performAsync(program(), handlers)) {
    console.log(`Async Step`, e);
  }
}
{
  // async
  const none = defineEffect<"none", [], undefined>("none");
  const lazy1 = defineEffect<"lazy1", [input: number], number>("lazy1");
  const lazy2 = defineEffect<"lazy2", [], string>("lazy2");
  type MyProgramEffect =
    | EffectFor<typeof none>
    | EffectFor<typeof lazy1>
    | EffectFor<typeof lazy2>;
  const myProgram = async function* (): AsyncGenerator<MyProgramEffect> {
    const _1: number = yield* lazy1(2);
    const _2: string = yield* lazy2();
    const _3: void = yield* none();
  };
  type MergedEffectResult = MyProgramEffect;
  const h: HandlersFor<MyProgramEffect> = {
    [lazy1.t]: async (input: number) => input * 2,
    [lazy2.t]: () => "lazyValue",
    [none.t]: async () => {
      return undefined;
    },
  };

  const steps1: AsyncGenerator<MyProgramEffect> = performAsync(myProgram(), h);
  const result: MergedEffectResult[] = await Array.fromAsync(steps1);
  console.log("Collected steps:", result);
}
