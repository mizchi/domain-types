import {
  type HandlersFor,
  type EffectFor,
  type SyncHandlersFor,
  defineEffect,
  performAsync,
  performSync,
  EffectYieldError,
  EffectMissingError,
  EffectHandlerError,
} from "./effect.ts";
import { expect } from "@std/expect";
import { unreachable } from "./unreachable.ts";
import { assertErrorInstance } from "./error.ts";

Deno.test("performSync", async (t) => {
  await t.step("sync minimum", () => {
    const none = defineEffect<"none", [], undefined>("none");
    type TestProgramEffect = EffectFor<typeof none>;
    const testProgram = function* (): Generator<TestProgramEffect> {
      const _: void = yield* none();
    };
    const xs: TestProgramEffect[] = Array.from(
      performSync(testProgram(), {
        [none.t]: () => {},
      })
    );
    expect(xs).toEqual([none.of([], undefined)]);
  });
  await t.step("with sub program", () => {
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
    const handlers: SyncHandlersFor<MyProgramEffect> = {
      [v.t]: () => {},
    };
    const result: MyProgramEffect[] = Array.from(
      performSync(myProgram(), handlers)
    );
    const expected: MyProgramEffect[] = [
      v.of([1], undefined),
      v.of([2], undefined),
    ];
    expect(result).toEqual(expected);
  });
  await t.step("infer Effect from implementation", async () => {
    const a = defineEffect<"a">("a");
    const b = defineEffect<"b">("b");
    const c = defineEffect<"c">("c");
    const d = defineEffect<"d">("d");

    function* subSync() {
      yield* b();
      yield* c();
    }
    async function* subAsync() {
      yield* c();
      yield* d();
    }

    async function* main() {
      yield* a();
      yield* subSync();
      yield* subAsync();
    }
    type ExpectedMainEffect =
      | EffectFor<typeof a>
      | EffectFor<typeof b>
      | EffectFor<typeof c>
      | EffectFor<typeof d>;
    type ExpectedSubEffect = EffectFor<typeof b | typeof c>;
    type ExpectedAsyncSubEffect = EffectFor<typeof c | typeof d>;
    const mg: AsyncGenerator<ExpectedMainEffect> = performAsync(main(), {
      [a.t]: () => {},
      [b.t]: () => {},
      [c.t]: () => {},
      [d.t]: () => {},
    });
    const sg: Generator<ExpectedSubEffect> = performSync(subSync(), {
      [b.t]: () => {},
      [c.t]: () => {},
    });
    const asg: AsyncGenerator<ExpectedAsyncSubEffect> = performAsync(
      subAsync(),
      {
        [c.t]: () => {},
        [d.t]: () => {},
      }
    );

    expect(await Array.fromAsync(mg)).toEqual([
      a.of([], undefined),
      b.of([], undefined),
      c.of([], undefined),
      c.of([], undefined),
      d.of([], undefined),
    ]);
    expect(Array.from(sg)).toEqual([b.of([], undefined), c.of([], undefined)]);
    expect(await Array.fromAsync(asg)).toEqual([
      c.of([], undefined),
      d.of([], undefined),
    ]);

    // const _0: AsyncGenerator<EffectFor<typeof a | typeof b | typeof c>> = main();
  });
});

Deno.test("perform(async)", async (t) => {
  await t.step("async minimum", async () => {
    const none = defineEffect<"none">("none");
    type MyProgramEffect = EffectFor<typeof none>;
    const myProgram = async function* (): AsyncGenerator<MyProgramEffect> {
      const _: void = yield* none();
    };
    const handlers: HandlersFor<MyProgramEffect> = {
      [none.t]: async () => {},
    };
    const result = await Array.fromAsync(performAsync(myProgram(), handlers));
    const expected: MyProgramEffect[] = [none.of([], undefined)];
    expect(result).toEqual(expected);
  });
  await t.step("with subprogram", async () => {
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
    const handlers: SyncHandlersFor<ValueEffect> = {
      [v.t]: () => {},
    };
    const result: ValueEffect[] = await Array.fromAsync(
      performAsync(myProgram(), handlers)
    );
    const expected: ValueEffect[] = [
      v.of([1], undefined),
      v.of([2], undefined),
    ];
    expect(result).toEqual(expected);
  });
});

Deno.test("types", async (t) => {
  const TYPECHECK_ONLY: boolean = false;
  const none = defineEffect<"none">("none");
  const double = defineEffect<"double", [number], number>("double");
  const undef = defineEffect<"undef">("undef");

  type MyProgramEffect = EffectFor<typeof double> | EffectFor<typeof none>;

  await t.step("Generator allows only Generator (not AsyncGenerator)", () => {
    if (TYPECHECK_ONLY) {
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
  await t.step("performSync allows only sync Handlers", () => {});
  if (TYPECHECK_ONLY) {
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

    const handlers: HandlersFor<MyProgramEffect> = {
      [double.t]: async (x: number) => x * 2,
      [none.t]: () => undefined,
    };
    const g: AsyncGenerator<MyProgramEffect> = performAsync(p(), handlers);
    const _steps: MyProgramEffect[] = await Array.fromAsync(g);
  }
  await t.step("SyncHandlersFor", async () => {
    if (TYPECHECK_ONLY) {
      const double = defineEffect<"double", [number], number>("double");
      type MyProgramEffect =
        | EffectFor<typeof double>
        | EffectFor<typeof none>
        | EffectFor<typeof undef>;
      const _validAsyncHandlers: HandlersFor<MyProgramEffect> = {
        [double.t]: async (x: number) => x * 2,
        [none.t]: async () => {},
        [undef.t]: async () => {},
      };

      const _invalidSyncHandlers: SyncHandlersFor<MyProgramEffect> = {
        // @ts-expect-error can not take async handler in sync HandlersFor
        [double.t]: async (x: number) => x * 2,
        // @ts-expect-error
        [none.t]: async () => {},
        [undef.t]: () => {},
      };

      const _validAsyncHandlers2: HandlersFor<MyProgramEffect> = {
        [double.t]: async (x: number) => x * 2,
        [none.t]: async () => {},
        [undef.t]: async () => {},
      };
    }
  });
});

Deno.test("with EffectYieldError", async (t) => {
  const none = defineEffect<"none">("none");
  type TestEffect = EffectFor<typeof none>;
  const MyError = class extends Error {};
  const testProgram = async function* (): AsyncGenerator<TestEffect> {
    throw new MyError("test error");
    const _: void = yield* none();
  };

  await t.step("throw with init", async () => {
    try {
      await Array.fromAsync(
        performAsync(testProgram(), {
          [none.t]: () => {},
        })
      );
      unreachable("should not reach here");
    } catch (e) {
      assertErrorInstance(e, EffectYieldError);
      assertErrorInstance(e.cause, MyError);
    }
  });
});

Deno.test("with EffetMissingError", async (t) => {
  const none = defineEffect<"none">("none");
  const none2 = defineEffect<"none2">("none2");

  type TestEffect = EffectFor<typeof none> | EffectFor<typeof none2>;
  const testProgram = async function* (): AsyncGenerator<TestEffect> {
    const _: void = yield* none2();
  };

  await t.step("throw with init", async () => {
    try {
      await Array.fromAsync(
        // @ts-expect-error none2 is not defined in handlers
        performAsync(testProgram(), {
          [none.t]: () => {},
        })
      );
      unreachable("should not reach here");
    } catch (e) {
      assertErrorInstance(e, EffectMissingError);
      expect(e.key).toBe(none2.t);
    }
  });
});

Deno.test("with EffectHandlerError", async (t) => {
  const MyError = class extends Error {};
  const none = defineEffect<"none">("none");
  const myProgram = async function* () {
    const _: void = yield* none();
  };
  await t.step("throw EffectHandlerError ", async (t) => {
    try {
      await Array.fromAsync(
        performAsync(myProgram(), {
          [none.t]: () => {
            throw new MyError("test error");
          },
        })
      );
      unreachable("should not reach here");
    } catch (e) {
      assertErrorInstance(e, EffectHandlerError);
      assertErrorInstance(e.cause, MyError);
    }
  });
});
