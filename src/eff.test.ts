import {
  AsyncHandlersFor,
  defineEffect,
  EffectFor,
  performAsync,
  perform,
  HandlersFor,
  ResultStep,
} from "./eff.ts";
import { expect } from "@std/expect";

// async
Deno.test("perform: minimum", async () => {
  const none = defineEffect<"none">("none");
  type MyProgramEffect = EffectFor<typeof none>;
  const myProgram = function* (): Generator<MyProgramEffect> {
    const _: void = yield* none();
  };
  const handlers = {
    [none.t]: () => undefined,
  } satisfies HandlersFor<MyProgramEffect>;
  const xs: ResultStep<MyProgramEffect>[] = Array.from(
    perform(myProgram(), handlers)
  );
  expect(xs).toEqual([["none", [], undefined]]);
});

const TYPECHECK_ONLY: boolean = false;
Deno.test("perform: types", async () => {
  if (TYPECHECK_ONLY) {
    const none = defineEffect<"none">("none");
    const double = defineEffect<"none", [number], number>("none");
    type MyProgramEffect = EffectFor<typeof double> | EffectFor<typeof none>;
    function* _(): Generator<MyProgramEffect> {
      const _1: void = yield* none();
      // @ts-expect-error can not return without yield*
      yield double(2);
      // @ts-expect-error Input expected
      yield* double("err");
      const _2: number = yield* double(1);
    }

    function* _sub(): Generator<EffectFor<typeof double>> {
      const _: number = yield* double(2);
      // @ts-expect-error can not yield
      yield* none();
    }
  }
});

Deno.test("HandlersFor", async () => {
  if (TYPECHECK_ONLY) {
    const none = defineEffect<"none">("none");
    const double = defineEffect<"double", [number], number>("double");
    type MyProgramEffect = EffectFor<typeof double> | EffectFor<typeof none>;
    const _asyncHandlers = {
      [double.t]: async (x: number) => x * 2,
      [none.t]: () => undefined,
    } satisfies AsyncHandlersFor<MyProgramEffect>;

    const _syncHandlers = {
      [double.t]: (x: number) => x * 2,
      [none.t]: async () => undefined,
    } satisfies HandlersFor<MyProgramEffect>;
    // function* _(): Generator<MyProgramEffect> {
    //   const _1: void = yield* none();
    //   // @ts-expect-error can not return without yield*
    //   yield double(2);
    //   // @ts-expect-error Input expected
    //   yield* double("err");
    //   const _2: number = yield* double(1);
    // }

    // function* _sub(): Generator<EffectFor<typeof double>> {
    //   const _: number = yield* double(2);
    //   // @ts-expect-error can not yield
    //   yield* none();
    // }
  }
});

Deno.test("perform: types", async () => {
  if (TYPECHECK_ONLY) {
    const none = defineEffect<"none">("none");
    const double = defineEffect<"double", [x: number], number>("double");
    type MyProgramEffect = EffectFor<typeof double> | EffectFor<typeof none>;

    function* sync(): Generator<EffectFor<typeof double>, boolean> {
      const _: number = yield* double(2);
      // @ts-expect-error can not yield
      yield* none();
      return true;
    }

    // AsyncGenerator can call sync
    async function* p(): AsyncGenerator<MyProgramEffect> {
      const _v: boolean = yield* sync();
      const _1: void = yield* none();
      // @ts-expect-error can not return without yield*
      yield double(2);
      // @ts-expect-error Input expected
      yield* double("err");
      const _2: number = yield* double(1);
    }

    const handlers = {
      [double.t]: async (x: number) => x * 2,
      [none.t]: () => void 0,
    } satisfies AsyncHandlersFor<MyProgramEffect>;

    const g: AsyncGenerator<ResultStep<MyProgramEffect>> = performAsync(
      p(),
      handlers
    );
    const _steps: ResultStep<MyProgramEffect>[] = await Array.fromAsync(g);
  }
});

Deno.test("performAsync: minimum", async () => {
  const none = defineEffect<"none">("none");
  type MyProgramEffect = EffectFor<typeof none>;
  const myProgram = async function* (): AsyncGenerator<MyProgramEffect> {
    const _: void = yield* none();
  };
  const handlers = {
    [none.t]: () => undefined,
  } satisfies AsyncHandlersFor<MyProgramEffect>;
  const xs = await Array.fromAsync(performAsync(myProgram(), handlers));
  expect(xs).toEqual([["none", [], undefined]]);
});

Deno.test("async effect example", async () => {
  const none = defineEffect<"none">("none");
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
  const xs = await Array.fromAsync(
    performAsync(myProgram(), {
      [lazy1.t]: async (input: number) => input * 2,
      [lazy2.t]: () => "lazyValue",
      [none.t]: () => undefined,
    } satisfies AsyncHandlersFor<MyProgramEffect>)
  );
  expect(xs).toEqual([
    ["lazy1", [2], 4],
    ["lazy2", [], "lazyValue"],
    ["none", [], undefined],
  ]);
});
