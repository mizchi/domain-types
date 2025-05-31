type AnyArgs = Array<any>;
// type Sync<T> = T extends Promise<any> ? never : T;

// 厳密な型チェックのためのヘルパー型
type ExplicitSync<F> = F extends (...args: any[]) => any
  ? F extends (...args: any[]) => Promise<any>
    ? never
    : F
  : never;

export type Effect<K extends string, A extends AnyArgs, R> = {
  key: K;
  args: A;
  return: R;
};

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

export type AsyncHandlersFor<E extends Effect<string, AnyArgs, any>> = {
  [K in E["key"]]: E extends Effect<K, infer A, infer R>
    ? (...args: A) => R | Promise<R>
    : never;
};

// Handlers型を推論するためのヘルパー型
export type HandlersFor<E extends Effect<string, AnyArgs, any>> = {
  [K in E["key"]]: E extends Effect<K, infer A, Awaited<infer R>>
    ? ExplicitSync<(...args: A) => R>
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
  R = void | undefined
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

export function effectFrom<K extends string, F extends (...args: any[]) => any>(
  k: K
) {
  return defineEffect<K, Parameters<F>, Awaited<ReturnType<F>>>(k);
}

export async function* performAsync<E extends Effect<any, AnyArgs, any>, R>(
  generator: AsyncGenerator<E, R, any> | Generator<E, R, any>,
  handlers: AsyncHandlersFor<E>
): AsyncGenerator<ResultStep<E>> {
  let result: IteratorResult<E, R>;
  try {
    result = await generator.next();
  } catch (error) {
    throw new EffectError(
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
      throw new EffectError(
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
      throw new EffectError(
        error instanceof Error ? error : new Error(String(error)),
        "generator",
        effect.key,
        effect.args
      );
    }
  }
}

export const none = () => {};
export const returns =
  <T>(v: T) =>
  () =>
    v;

const EFFECT_ERROR_MESSAGE = "EffectError";
export class EffectError extends Error {
  constructor(
    originalError: Error | string,
    public step: "handler" | "init" | "generator",
    public readonly key: string | undefined,
    public readonly args: AnyArgs
  ) {
    const message = ["handler", "missingHandler"].includes(step)
      ? `${step}:${key}`
      : step;
    // @ts-ignore node can not handle Error cause yet
    super(`${EFFECT_ERROR_MESSAGE}: ${message}`, {
      cause: originalError,
    });
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
      throw new EffectError(
        error instanceof Error ? error : new Error(String(error)),
        "handler",
        effect.key,
        effect.args
      );
    }
  }
}
