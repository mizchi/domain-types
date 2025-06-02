import {
  type EffectFor,
  type HandlersFor,
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
const handlers: HandlersFor<ProgramEffect> = {
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
const effects: ProgramEffect[] = await Array.fromAsync(
  performAsync(program(), handlers)
);
console.log("Program steps:", effects);
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
