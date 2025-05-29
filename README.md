# @mizchi/domain-types

typescript utilities for domain modeling

## Result Types

Simple result types with asserts

```ts
import {
  ok,
  err,
  assertErr,
  assertOk,
  type Result,
} from "@mizchi/domain-types";

function getValue(v: number): Result<string, string> {
  if (v > 0) {
    return ok("Value is positive");
  }
  return err("Value must be positive");
}

Deno.test("Result", () => {
  const result: Result<string, string> = getValue(5);
  if (result.ok) {
    const _: string = result.value;
  } else {
    const _: string = result.error;
  }
});

Deno.test("Result: ok case", () => {
  const result = getValue(10);
  // @ts-expect-error
  result.value;
  assertOk(result);
  console.log(result.value);
});

Deno.test("Result: err case", () => {
  const result = getValue(-5);
  // @ts-expect-error
  result.error;
  assertErr(result);
  console.log(result.error);
});
```

## Effect Types

Generator Style Effect handler

```ts
import {
  type Eff,
  eff,
  runEff,
  createHandlers,
  waitFor,
} from "jsr:@mizchi/domain-types";

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
```

## LICENSE

MIT
