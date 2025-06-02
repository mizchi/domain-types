/**
 * @internal
 */
type AnyArgs = Array<any>;

/**
 * @internal
 */
type ExplicitSync<F> = F extends (...args: any[]) => any
  ? F extends (...args: any[]) => Promise<any>
    ? never
    : F
  : never;

/**
 * Represents an effect with a key, arguments, and expected return type.
 * @template K - The effect key/identifier
 * @template A - The arguments tuple type
 * @template R - The return type
 */
export type Effect<K extends string, A extends AnyArgs, R> = {
  t: K;
  args: A;
  return: R;
};

/**
 * Creates an async handler map type for a given effect union.
 * @template E - Union of effect types
 * @returns Object type mapping effect keys to their async handler functions
 */
export type AsyncHandlersFor<E extends Effect<string, AnyArgs, any>> = {
  [K in E["t"]]: E extends Effect<K, infer A, infer R>
    ? (...args: A) => R | Promise<R>
    : never;
};

/**
 * Creates a synchronous handler map type for a given effect union.
 * @template E - Union of effect types
 * @returns Object type mapping effect keys to their sync handler functions
 */
export type HandlersFor<E extends Effect<string, AnyArgs, any>> = {
  [K in E["t"]]: E extends Effect<K, infer A, Awaited<infer R>>
    ? ExplicitSync<(...args: A) => R>
    : never;
};
/**
 * Extracts the Effect type from an EffectBuilder.
 * @template Builder - The EffectBuilder type
 * @returns The corresponding Effect type
 */
export type EffectFor<Builder extends EffectBuilder<string, AnyArgs, any>> =
  Builder extends EffectBuilder<infer K, infer A, infer F>
    ? Effect<K, A, F>
    : never;

/**
 * Builder type for creating effects with type-safe APIs.
 * @example
 * const val = defineEffect<'val', [number], number>('val');
 * const log = defineEffect<'log', [string]>('log');
 */
export type EffectBuilder<K extends string, A extends AnyArgs, R> = {
  (...args: A): Generator<Effect<K, A, R>, R, any>;
  /**
   * Creates an effect from the given arguments and return value.
   * @param args The arguments to pass to the effect
   * @param returns The return value of the effect
   * @returns The created effect
   */
  of: (args: A, returns: R) => Effect<K, A, R>;
  /**
   * The unique key for this effect.
   * @example
   */
  t: K;
};

/**
 * Create `EeffectBuilder` for `EffectKey`.
 * @example
 * // Define effects
 * const none = defineEffect<'none'>('none'); // () => void
 * const log = defineEffect<'log', [string]>('log'); // (i: string) => void
 * const val = defineEffect<'val', [number, number], number>('val'); // (a: number, b: number) => number
 * @example
 * // Use in a generator
 * async function* myProgram(): AsyncGenerator<EffectFor<typeof val>> {
 *   const v = yield* val(1, 2);
 * }
 */
export function defineEffect<
  EffectKey extends string,
  Args extends AnyArgs = [],
  Return = void | undefined
>(key: EffectKey): EffectBuilder<EffectKey, Args, Return> {
  const builder: EffectBuilder<EffectKey, Args, Return> = ((...args: Args) => {
    const g = (function* () {
      // @ts-ignore
      return yield { t: key, args } as Effect<EffectKey, Args, Return>;
    })();
    // GeneratorとEffの両方のプロパティを持つオブジェクトを作成
    return Object.assign(g, {
      key,
      args,
    } as unknown as Effect<EffectKey, Args, Return>);
  }) as any;
  builder.t = key;
  builder.of = (args: Args, r: Return) =>
    ({
      t: key,
      args,
      return: r,
    } as Effect<EffectKey, Args, Return>);
  return builder as EffectBuilder<EffectKey, Args, Return>;
}

/**
 * Creates `EffectBuilder` from a function signature.
 * @example
 * // Define effect from existing function type
 * const readFile = effectFrom<'node:readFile', typeof fs.readTextFile>('node:readFile');
 */
export function effectFrom<K extends string, F extends (...args: any[]) => any>(
  k: K
) {
  return defineEffect<K, Parameters<F>, Awaited<ReturnType<F>>>(k);
}

/**
 * Performs effects from a generator using synchronous handlers.
 * @throws {EffectMissingError} When a handler for an effect is not found
 * @throws {EffectError} When a handler throws an error
 * @example
 * const log = defineEffect<'log', [string]>('log');
 * function* program(): Generator<EffectFor<typeof log>> {
 *   yield* log('debug:log');
 * }
 * [...perform(program(), { log: console.log })]
 */
export function* perform<E extends Effect<string, AnyArgs, any>, R>(
  g: Generator<E, R, any>,
  handlers: HandlersFor<E>
): Generator<E> {
  let result: IteratorResult<E, R> = g.next();
  while (!result.done) {
    const effect = result.value;
    const handler = (handlers as any)[effect.t];
    if (!handler) {
      throw new EffectMissingError(effect.t);
    }
    try {
      // @ts-ignore
      const handlerResult = handler(...effect.args);
      result = g.next(handlerResult);
      yield {
        t: effect.t,
        args: effect.args,
        return: handlerResult,
      } as E;
    } catch (error) {
      throw new EffectError(
        error instanceof Error ? error : new Error(String(error)),
        "handler",
        effect.t,
        effect.args
      );
    }
  }
}

/**
 * Performs effects from AsyncGenerator with handlers.
 * @example
 * const val = defineEffect<'val', [number], number>('val');
 * async function* program(): AsyncGenerator<EffectFor<typeof val>> {
 *   const v = yield* val(42);
 * }
 * const g = performAsync(program(), {
 *   [val.t]: async (n: number) => n + 1,
 * });
 * for await (const step of g) {
 *   console.log(step); // { t: 'val', args: [42], return: 43 }
 * }
 * @throws {EffectMissingError} When a handler for an effect is not found
 * @throws {EffectError} When a handler throws an error or generator fails
 */
export async function* performAsync<E extends Effect<string, AnyArgs, any>, R>(
  generator: AsyncGenerator<E, R, any> | Generator<E, R, any>,
  handlers: AsyncHandlersFor<E>
): AsyncGenerator<E> {
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
    const handler = (handlers as any)[effect.t];
    if (!handler) {
      throw new EffectMissingError(effect.t);
    }
    let handlerReturn: any;
    try {
      handlerReturn = await handler(...effect.args);
    } catch (error) {
      throw new EffectError(
        error instanceof Error ? error : new Error(String(error)),
        "handler",
        effect.t,
        effect.args
      );
    }
    try {
      result = await generator.next(handlerReturn);
      yield {
        t: effect.t,
        args: effect.args,
        return: handlerReturn,
      } as E;
    } catch (error) {
      throw new EffectError(
        error instanceof Error ? error : new Error(String(error)),
        "generator",
        effect.t,
        effect.args
      );
    }
  }
}

/**
 * No-op function that returns undefined.
 * Useful as a default handler.
 * @example
 * const handlers = {
 *   debug: process.env.DEBUG ? console.log : none,
 *   analytics: isProduction ? sendAnalytics : none
 * };
 */
export const none = () => {};

/**
 * Creates a function that returns a constant value.
 * @example
 * const handlers = {
 *   getEnv: returns({ apiUrl: 'https://api.example.com' }),
 *   getCurrentUser: returns({ id: 1, name: 'Test User' }),
 *   isFeatureEnabled: returns(true)
 * };
 *
 * // Useful for testing
 * const testHandlers = {
 *   fetchUser: returns({ id: 1, name: 'Mock User' }),
 *   saveData: returns(undefined),
 *   generateId: returns('test-id-123')
 * };
 */
export const returns =
  <T>(v: T) =>
  () =>
    v;

const EFFECT_ERROR_MESSAGE = "EffectError";

/**
 * Error thrown when an effect execution fails.
 * Contains information about which step failed and the effect context.
 * @example
 * try {
 *   await performAsync(program(), handlers);
 * } catch (error) {
 *   if (error instanceof EffectError) {
 *     console.error(`Failed at ${error.step} args ${error.args} returned ${error.return}`);
 *   }
 * }
 */
export class EffectError extends Error {
  /**
   * @param originalError - The original error that caused the failure
   * @param step - The step where the error occurred (handler, init, or generator)
   * @param t - The effect key that was being executed
   * @param args - The arguments passed to the effect
   */
  constructor(
    originalError: Error | string,
    public step: "handler" | "init" | "generator",
    public readonly t: string | undefined,
    public readonly args: AnyArgs
  ) {
    const message = ["handler", "missingHandler"].includes(step)
      ? `${step}:${t}`
      : step;
    // @ts-ignore node can not handle Error cause yet
    super(`${EFFECT_ERROR_MESSAGE}: ${message}`, {
      cause: originalError,
    });
  }
}

/**
 * Error thrown when a handler for an effect is not found.
 * @example
 * const log = defineEffect<'log', [string]>('log');
 * const read = defineEffect<'read', [string], string>('read');
 *
 * function* program() {
 *   yield* log('Hello');
 *   yield* read('file.txt'); // This will throw if no 'read' handler
 * }
 *
 * try {
 *   // Missing 'read' handler
 *   for (const step of perform(program(), { log: console.log })) {}
 * } catch (error) {
 *   if (error instanceof EffectMissingError) {
 *     console.error(`Missing handler for: ${error.key}`); // 'read'
 *   }
 * }
 */
export class EffectMissingError extends Error {
  /**
   * @param key - The effect key that has no handler
   */
  constructor(public readonly key: string | undefined) {
    super(`EffectMissingError: Missing handler for effect: ${key}`);
  }
}
