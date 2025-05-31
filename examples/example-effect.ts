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
