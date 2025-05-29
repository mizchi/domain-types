export type Eff<T extends string, P = void> = {
  type: T;
  payload: P;
};

export function eff<T extends string, P = void>(
  type: T,
  payload: P
): Eff<T, P> {
  return { type, payload };
}

// Handler型の定義
export type Handler<E extends Eff<any, any>, R> = (
  payload: E["payload"]
) => Promise<R> | R;

// Handlers型を推論するためのヘルパー型
export type InferHandlers<TEffect extends Eff<any, any>> = {
  [K in TEffect["type"]]: Handler<Extract<TEffect, { type: K }>, any>;
};

// Handlers型から推論するヘルパー関数
export function createHandlers<TEffect extends Eff<any, any>>(
  handlers: InferHandlers<TEffect>
): InferHandlers<TEffect> {
  return handlers;
}

// Effect System の核となる実行エンジン（オーバーロード）
export async function runEff<TEffect extends Eff<any, any>, TResult>(
  generator: AsyncGenerator<TEffect, TResult, any>,
  handlers: InferHandlers<TEffect>
): Promise<TResult>;
export async function runEff<TEffect extends Eff<any, any>, TResult>(
  generator: Generator<TEffect, TResult, any>,
  handlers: InferHandlers<TEffect>
): Promise<TResult>;
export async function runEff<TEffect extends Eff<any, any>, TResult>(
  generator:
    | Generator<TEffect, TResult, any>
    | AsyncGenerator<TEffect, TResult, any>,
  handlers: InferHandlers<TEffect>
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
    // @ts-ignore
    const handler = handlers[effect.type];

    if (!handler) {
      throw new Error(`No handler found for effect type: ${effect.type}`);
    }

    // Handlerを実行して結果を取得
    const handlerResult = await handler(effect.payload);

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

export async function* waitFor<T, R, TResult>(
  g: AsyncGenerator<T, R, TResult>
): AsyncGenerator<T, R, TResult> {
  let result = await g.next();
  let lastInput: any = undefined;

  while (!result.done) {
    lastInput = yield result.value;
    result = await g.next(lastInput);
  }

  return result.value;
}
