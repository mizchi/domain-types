# @mizchi/domain-types

typescript utilities for domain modeling

## Install

```bash
# node
$ npm add @mizchi/domain-types
# deno
$ deno add jsr:@mizchi/domain-types
```

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

### simple usecase

```ts
import {
  type EffectFor,
  defineEffect,
  performAsync,
} from "@mizchi/domain-types";

const log = defineEffect<"log", [message: string], void>("log");
const val = defineEffect<"val", [], number>("val");
type ProgramEffect = EffectFor<typeof log> | EffectFor<typeof val>;

async function* program(): AsyncGenerator<ProgramEffect> {
  const v = yield* val();
  yield* log(`v:${v}`);
}

// with 42
console.log(
  await Array.fromAsync(
    performAsync(program(), {
      [log.t]: async (message) => {
        console.log(`[log] ${message}`);
      },
      [val.t]: async () => {
        return 42;
      },
    })
  )
);
// [log] v:42
// => [ [ "val", [], 42 ], [ "log", [ "v:42" ], undefined ] ]

// with 10 and logger
console.log(
  await Array.fromAsync(
    performAsync(program(), {
      [log.t]() {},
      [val.t]: async () => {
        return 10;
      },
    })
  )
);
// => [ [ "val", [], 10 ], [ "log", [ "v:10" ], undefined ] ]
```

### sub task

```ts
import {
  type EffectFor,
  type AsyncHandlersFor,
  type ResultStep,
  defineEffect,
  performAsync,
} from "@mizchi/domain-types";

const log = defineEffect<"log", [message: string], void>("log");
const delay = defineEffect<"delay", [ms: number], void>("delay");
const val = defineEffect<"val", [], number>("val");
type ProgramEffect =
  | EffectFor<typeof log>
  | EffectFor<typeof delay>
  | EffectFor<typeof val>;

function* subTask(): Generator<EffectFor<typeof log> | EffectFor<typeof val>> {
  yield* log("sub");
  const v = yield* val();
  // yield* delay(100); // You can yield only Generator<T> or AsyncGenerator<T>
  return v + 1;
}

async function* program(): AsyncGenerator<ProgramEffect> {
  yield* log("start");
  const v = yield* subTask();
  yield* log(`returned: ${v}`);
}

// run with handlers
const handlers: AsyncHandlersFor<ProgramEffect> = {
  [log.t]: async (message) => {
    console.log(`[log] ${message}`);
  },
  [delay.t]: async (ms) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  },
  [val.t]: async () => {
    return 42;
  },
};

// Execute the program
const steps: ResultStep<ProgramEffect>[] = await Array.fromAsync(
  performAsync(program(), handlers)
);
console.log("Program steps:", steps);
/** * Output:
[log] start
[log] sub
[log] subTask returned: 43
Program steps: [
  [ "log", [ "start" ], undefined ],
  [ "log", [ "sub" ], undefined ],
  [ "val", [], 42 ],
  [ "log", [ "returned: 43" ], undefined ]
]
*/
```

### sync and async

- `perform(Generator<T, R, N>, {...})`
- `performAsync(AsyncGenerator<T, R, N>, {...})`

```ts
// sync example
// All handlers and generator should be sync in perform()
import { type EffectFor, defineEffect, perform } from "@mizchi/domain-types";

const val = defineEffect<"val", [], number>("val");
type ProgramEffect = EffectFor<typeof val>;
function* program(): Generator<ProgramEffect> {
  yield* val();
}

console.log(
  ...perform(program(), {
    [val.t]: () => 42,
  })
);
// => [ "val", [], 42 ]
```

## LICENSE

MIT
