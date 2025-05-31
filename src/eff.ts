import { err, ok, Result } from "./result.ts";

export type Eff<T extends string, F extends (p: any) => any> = {
  eff: T;
  payload: Parameters<F>[0];
  __result__: ReturnType<F>; // Optional result type for the effect
};

export function eff<T extends string, F extends (p: any) => any>(
  eff: T,
  payload: Parameters<F>[0]
): Eff<T, F> {
  return { eff, payload } as Eff<T, F>;
}

export function defineEff<K extends string, F extends (p: any) => any>(
  eff: K
): (p: Parameters<F>[0]) => Eff<K, F> {
  return (payload: Parameters<F>[0]): Eff<K, F> => {
    return { eff, payload, __result__: undefined } as Eff<K, F>;
  };
}

// Effect結果型を推論するヘルパー型
export type AsEffResult<T extends Eff<any, any>> = T extends Eff<any, infer F>
  ? F extends (p: any) => infer R
    ? NonNullable<R>
    : never
  : never;

// タスク定義のヘルパー関数
export function defineTask<E extends Eff<any, any>>(
  handler: (eff: E) => Promise<AsEffResult<E> | any>
) {
  return async function* (i: E): AsyncGenerator<E, AsEffResult<E>> {
    return yield handler(i);
  };
}

export type AsyncTask<T extends Eff<any, any>, R> = AsyncGenerator<T, R, any>;
export type Task<T extends Eff<any, any>, R> = Generator<T, R, any>;

// Handler型の定義
export type Handler<E extends Eff<any, any>, R> = (
  payload: E["payload"]
) => Promise<R> | R;

// Handlers型を推論するためのヘルパー型
export type InferHandlers<TEffect extends Eff<any, any>> = {
  [K in TEffect["eff"]]: Handler<Extract<TEffect, { eff: K }>, any>;
};

// Handlers型から推論するヘルパー関数
export function defineHandlers<TEffect extends Eff<any, any>>(
  handlers: InferHandlers<TEffect>
): InferHandlers<TEffect> {
  return handlers;
}

// Effect System の核となる実行エンジン
type PerformOptions<TEffect extends Eff<any, any>> = {
  onEff?: (effect: TEffect) => void;
  onHandle?: <K extends TEffect["eff"]>(
    effect: Extract<TEffect, { eff: K }>,
    result: ReturnType<InferHandlers<TEffect>[K]> extends Promise<infer R>
      ? R
      : ReturnType<InferHandlers<TEffect>[K]>
  ) => void;
  onError?: (error: Error) => void;
};
export async function perform<TEffect extends Eff<any, any>, TResult>(
  generator: AsyncGenerator<TEffect, TResult, any>,
  handlers: InferHandlers<TEffect>,
  options?: PerformOptions<TEffect>
): Promise<TResult>;
export async function perform<TEffect extends Eff<any, any>, TResult>(
  generator: Generator<TEffect, TResult, any>,
  handlers: InferHandlers<TEffect>,
  options?: PerformOptions<TEffect>
): Promise<TResult>;
export async function perform<TEffect extends Eff<any, any>, TResult>(
  generator:
    | Generator<TEffect, TResult, any>
    | AsyncGenerator<TEffect, TResult, any>,
  handlers: InferHandlers<TEffect>,
  options?: PerformOptions<TEffect>
): Promise<TResult> {
  // Symbol.asyncIteratorを使ってAsyncGeneratorを判定
  const isAsync = Symbol.asyncIterator in generator;

  let result: IteratorResult<TEffect, TResult>;

  if (isAsync) {
    result = await (generator as AsyncGenerator<TEffect, TResult, any>).next();
  } else {
    result = (generator as Generator<TEffect, TResult, any>).next();
  }

  while (!result.done) {
    const effect = result.value;
    options?.onEff?.(effect);
    // @ts-ignore
    const handler = handlers[effect.eff];

    if (!handler) {
      throw new Error(`No handler found for effect type: ${effect.eff}`);
    }

    // Handlerを実行して結果を取得
    const handlerResult = await handler(effect.payload);
    options?.onHandle?.(effect as any, handlerResult);

    // 結果をgeneratorに送り返す
    if (isAsync) {
      result = await (generator as AsyncGenerator<TEffect, TResult, any>).next(
        handlerResult
      );
    } else {
      result = (generator as Generator<TEffect, TResult, any>).next(
        handlerResult
      );
    }
  }
  return result.value;
}

type TaskResult<TEffect extends Eff<any, any>, TResult> = Result<
  TResult,
  Error
> & {
  steps: TEffect[];
};

export async function performResult<TEffect extends Eff<any, any>, TResult>(
  generator: AsyncGenerator<TEffect, TResult, any>,
  handlers: InferHandlers<TEffect>
): Promise<TaskResult<TEffect, TResult>>;
export async function performResult<TEffect extends Eff<any, any>, TResult>(
  generator: Generator<TEffect, TResult, any>,
  handlers: InferHandlers<TEffect>
): Promise<TaskResult<TEffect, TResult>>;
export async function performResult<TEffect extends Eff<any, any>, TResult>(
  generator:
    | Generator<TEffect, TResult, any>
    | AsyncGenerator<TEffect, TResult, any>,
  handlers: InferHandlers<TEffect>
): Promise<TaskResult<TEffect, TResult>> {
  const effects: Eff<any, any>[] = [];
  try {
    const value = await perform(generator as any, handlers, {
      onEff: (eff) => {
        effects.push(eff);
      },
    });
    return {
      ok: true,
      value: value,
      steps: effects,
    } as TaskResult<TEffect, TResult>;
  } catch (error) {
    return {
      ok: false,
      error: error as Error,
      steps: effects,
    } as TaskResult<TEffect, TResult>;
  }
}
