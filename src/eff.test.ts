import {
  type AsyncHandlersFor,
  type EffectBuilder,
  type EffectFor,
  type HandlersFor,
  type ResultStep,
  defineEffect,
  performAsync,
  perform,
  EffectError,
} from "./eff.ts";
import { expect } from "@std/expect";
import { unreachable } from "./unreachable.ts";
import { assertErrorInstance } from "./error.ts";

Deno.test("perform: minimum", async () => {
  const none = defineEffect<"none", [], undefined>("none");
  type MyProgramEffect = EffectFor<typeof none>;
  const myProgram = function* (): Generator<MyProgramEffect> {
    const _: void = yield* none();
  };
  const handlers: HandlersFor<MyProgramEffect> = {
    [none.t]: () => {},
  };
  const xs: ResultStep<MyProgramEffect>[] = Array.from(
    perform(myProgram(), handlers)
  );
  expect(xs).toEqual([["none", [], undefined]]);
});

Deno.test("performAsync: minimum", async () => {
  const none = defineEffect<"none">("none");
  type MyProgramEffect = EffectFor<typeof none>;
  const myProgram = async function* (): AsyncGenerator<MyProgramEffect> {
    const _: void = yield* none();
  };
  const handlers: AsyncHandlersFor<MyProgramEffect> = {
    [none.t]: async () => {},
  };
  const result = await Array.fromAsync(performAsync(myProgram(), handlers));
  const expected: ResultStep<MyProgramEffect>[] = [["none", [], undefined]];
  expect(result).toEqual(expected);
});

Deno.test("perform: sub", async () => {
  const v = defineEffect<"v", [v: number], undefined>("v");
  type MyProgramEffect = EffectFor<typeof v>;
  const sub = function* (): Generator<MyProgramEffect> {
    const _: void = yield* v(1);
  };
  const subReturn = function* (): Generator<MyProgramEffect, number> {
    yield* v(2);
    return 1; // should not return
  };

  const myProgram = function* (): Generator<MyProgramEffect> {
    yield* sub();
    const _: number = yield* subReturn();
  };
  const handlers: HandlersFor<MyProgramEffect> = {
    [v.t]: () => {},
  };
  const result: ResultStep<MyProgramEffect>[] = Array.from(
    perform(myProgram(), handlers)
  );
  const expected: ResultStep<MyProgramEffect>[] = [
    ["v", [1], undefined],
    ["v", [2], undefined],
  ];
  expect(result).toEqual(expected);
});

Deno.test("performAsync: sub", async () => {
  const v = defineEffect<"v", [v: number], undefined>("v");
  type ValueEffect = EffectFor<typeof v>;
  const sub = function* (): Generator<ValueEffect> {
    const _: void = yield* v(1);
  };
  const subReturn = async function* (): AsyncGenerator<ValueEffect, number> {
    yield* v(2);
    return 1; // should not return
  };

  const myProgram = async function* (): AsyncGenerator<ValueEffect> {
    yield* sub();
    const _: number = yield* subReturn();
  };
  const handlers: HandlersFor<ValueEffect> = {
    [v.t]: () => {},
  };
  const result: ResultStep<ValueEffect>[] = await Array.fromAsync(
    performAsync(myProgram(), handlers)
  );
  const expected: ResultStep<ValueEffect>[] = [
    ["v", [1], undefined],
    ["v", [2], undefined],
  ];
  expect(result).toEqual(expected);
});

const TYPECHECK_ONLY: boolean = false;
Deno.test("types", async () => {
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

Deno.test("async types", async () => {
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

    const handlers: AsyncHandlersFor<MyProgramEffect> = {
      [double.t]: async (x: number) => x * 2,
      [none.t]: () => undefined,
    };
    const g: AsyncGenerator<ResultStep<MyProgramEffect>> = performAsync(
      p(),
      handlers
    );
    const _steps: ResultStep<MyProgramEffect>[] = await Array.fromAsync(g);
  }
});

Deno.test("HandlersFor", async () => {
  if (TYPECHECK_ONLY) {
    const none = defineEffect<"none">("none");
    const undef = defineEffect<"undef">("undef");

    const double = defineEffect<"double", [number], number>("double");
    type MyProgramEffect =
      | EffectFor<typeof double>
      | EffectFor<typeof none>
      | EffectFor<typeof undef>;
    const _validAsyncHandlers: AsyncHandlersFor<MyProgramEffect> = {
      [double.t]: async (x: number) => x * 2,
      [none.t]: async () => {},
      [undef.t]: async () => {},
    };

    const _invalidSyncHandlers: HandlersFor<MyProgramEffect> = {
      // @ts-expect-error can not take async handler in sync HandlersFor
      [double.t]: async (x: number) => x * 2,
      // @ts-expect-error
      [none.t]: async () => {},
      [undef.t]: () => {},
    };

    const _validAsyncHandlers2: AsyncHandlersFor<MyProgramEffect> = {
      [double.t]: async (x: number) => x * 2,
      [none.t]: async () => {},
      [undef.t]: async () => {},
    };
  }
});

Deno.test("with EffectError(init)", async () => {
  const none = defineEffect<"none">("none");
  type MyProgramEffect = EffectFor<typeof none>;
  const myProgram = async function* (): AsyncGenerator<MyProgramEffect> {
    (null as any).toString(); // should throw TypeError
    const _: void = yield* none();
  };
  try {
    await Array.fromAsync(
      performAsync(myProgram(), {
        [none.t]: () => {},
      } satisfies AsyncHandlersFor<MyProgramEffect>)
    );
    unreachable("should not reach here");
  } catch (e) {
    assertErrorInstance(e, EffectError);
    expect(e.key).toBe(undefined);
    expect(e.step).toBe("init");
    assertErrorInstance(e.cause, TypeError);
  }
});

Deno.test("with EffectError(generator)", async () => {
  const none = defineEffect<"none">("none");
  type MyProgramEffect = EffectFor<typeof none>;
  const myProgram = async function* (): AsyncGenerator<MyProgramEffect> {
    const _: void = yield* none();
    (null as any).toString(); // should throw TypeError
  };
  try {
    await Array.fromAsync(
      performAsync(myProgram(), {
        [none.t]: () => {},
      } satisfies AsyncHandlersFor<MyProgramEffect>)
    );
    unreachable("should not reach here");
  } catch (e) {
    assertErrorInstance(e, EffectError);
    expect(e.step).toBe("generator");
    assertErrorInstance(e.cause, TypeError);
  }
});
