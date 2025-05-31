type AnyArgs = Array<any>;

export type Effect<K extends string, A extends AnyArgs, R> = {
  key: K;
  args: A;
  return: R;
};

export type AsyncHandlersFor<E extends Effect<string, AnyArgs, any>> = {
  [K in E["key"]]: E extends Effect<K, infer A, infer R>
    ? (...args: A) => R | Promise<R>
    : never;
};

// Handlers型を推論するためのヘルパー型
export type HandlersFor<E extends Effect<string, AnyArgs, any>> = {
  [K in E["key"]]: E extends Effect<K, infer A, infer R>
    ? (...args: A) => R
    : never;
};

export type EffectFor<T extends EffectBuilder<string, AnyArgs, any>> =
  T extends EffectBuilder<infer K, infer A, infer F> ? Effect<K, A, F> : never;

export type EffectBuilder<K extends string, A extends Array<any>, R> = {
  (...args: A): Generator<Effect<K, A, R>, R, any>;
  with<F extends () => void>(f: F): F;
  t: K;
};

export function defineEffect<
  K extends string,
  A extends AnyArgs = [],
  R = void
>(key: K): EffectBuilder<K, A, R> {
  const builder: EffectBuilder<K, A, R> = ((...args: A) => {
    const g = (function* () {
      // @ts-ignore
      return yield { key, args } as Effect<K, A, R>;
    })();
    // GeneratorとEffの両方のプロパティを持つオブジェクトを作成
    return Object.assign(g, {
      key,
      args,
    } as unknown as Effect<K, A, R>);
  }) as any;
  builder.t = key;
  // @ts-ignore
  builder.with = (t: T) => t;
  return builder as EffectBuilder<K, A, R>;
}

// Handlers型から推論するヘルパー関数
export function defineAsyncHandlers<E extends Effect<any, AnyArgs, any>>(
  handlers: AsyncHandlersFor<E>
): AsyncHandlersFor<E> {
  return handlers;
}
// Handlers型から推論するヘルパー関数
export function defineHandlers<E extends Effect<any, AnyArgs, any>>(
  handlers: HandlersFor<E>
): HandlersFor<E> {
  return handlers;
}

export type EffectResult<K extends string, A extends AnyArgs, R> = [
  effect: K,
  args: A,
  return$: R
];

export type ResultStep<E extends Effect<any, AnyArgs, any>> = E extends Effect<
  infer K,
  infer A,
  infer R
>
  ? EffectResult<K, A, R>
  : never;

export async function* performAsync<E extends Effect<any, AnyArgs, any>, R>(
  generator: AsyncGenerator<E, R, any> | Generator<E, R, any>,
  handlers: AsyncHandlersFor<E>
): AsyncGenerator<ResultStep<E>> {
  let result: IteratorResult<E, R>;
  try {
    result = await generator.next();
  } catch (error) {
    throw new EffectHandlerError(
      error instanceof Error ? error : new Error(String(error)),
      "init",
      undefined,
      []
    );
  }
  if (result.done) {
    return;
  }
  while (!result.done) {
    const effect = result.value;
    const handler = (handlers as any)[effect.key];
    if (!handler) {
      throw new EffectMissingError(effect.key);
    }
    let handlerReturn: any;
    try {
      handlerReturn = await handler(...effect.args);
    } catch (error) {
      throw new EffectHandlerError(
        error instanceof Error ? error : new Error(String(error)),
        "handler",
        effect.key,
        effect.args
      );
    }
    try {
      result = await generator.next(handlerReturn);
      yield [effect.key, effect.args, handlerReturn] as ResultStep<E>;
    } catch (error) {
      throw new EffectGeneratorError(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}

const EFFECT_ERROR_MESSAGE = "EffectError";
export class EffectHandlerError extends Error {
  constructor(
    originalError: Error | string,
    public step: "handler" | "init",
    public readonly key: string | undefined,
    public readonly args: AnyArgs
  ) {
    const message = ["handler", "missingHandler"].includes(step)
      ? `${step}:${key}`
      : step;
    super(`${EFFECT_ERROR_MESSAGE}: ${message}`, {
      cause: originalError,
    });
  }
}

export class EffectGeneratorError extends Error {
  constructor(public originalError: Error | string) {
    super(`EffectItarateError`, { cause: originalError });
  }
}

export class EffectMissingError extends Error {
  constructor(public readonly key: string | undefined) {
    super(`EffectMissingError: Missing handler for effect: ${key}`);
  }
}

export function* perform<E extends Effect<any, AnyArgs, any>, TResult>(
  g: Generator<E, TResult, any>,
  handlers: HandlersFor<E>
): Generator<ResultStep<E>> {
  let result: IteratorResult<E, TResult> = g.next();
  while (!result.done) {
    const effect = result.value;
    const handler = (handlers as any)[effect.key];
    if (!handler) {
      throw new EffectMissingError(effect.key);
    }
    try {
      // @ts-ignore
      const handlerResult = handler(...effect.args);
      result = g.next(handlerResult);
      yield [effect.key, effect.args, handlerResult] as ResultStep<E>;
    } catch (error) {
      throw new EffectHandlerError(
        error instanceof Error ? error : new Error(String(error)),
        "handler",
        effect.key,
        effect.args
      );
    }
  }
}

if (import.meta.main) {
  const print = defineEffect<"print", [input: string], void>("print");
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
    const syncHandlers = defineHandlers<ProgramEffect>({
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
    });
    for (const [key, args, result] of perform(program(), syncHandlers)) {
      console.log(`Step:`, key, args, result);
    }
  }
  {
    // async
    const handlers = defineAsyncHandlers<ProgramEffect>({
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
    });
    for await (const [key, args, result] of performAsync(program(), handlers)) {
      console.log(`Async Step`, key, args, result);
    }
  }
  {
    // async
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
    // type NoneEffectResult = ResultFromEffect<EffectFor<typeof none>>;
    // type Lazy1EffectResult = ResultFromEffect<EffectFor<typeof lazy1>>;

    type MergedEffectResult = ResultStep<MyProgramEffect>;
    const h = {
      [lazy1.t]: async (input: number) => input * 2,
      [lazy2.t]: () => "lazyValue",
      [none.t]: () => undefined,
    } satisfies AsyncHandlersFor<MyProgramEffect>;

    const steps1: AsyncGenerator<ResultStep<MyProgramEffect>> = performAsync(
      myProgram(),
      h
    );
    const result: MergedEffectResult[] = await Array.fromAsync(steps1);
    console.log("Collected steps:", result);
  }
}
