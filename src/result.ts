export type Ok<T> = {
  ok: true;
  value: T;
};
export type Err<E> = {
  ok: false;
  error: E;
};

export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export class ResultAssertError extends Error {}

export function assertOk<T, E>(result: Result<T, E>): asserts result is Ok<T> {
  if (!result.ok) {
    throw new ResultAssertError(`Expected Ok, but got Err: ${result.error}`);
  }
}

export function assertErr<T, E>(
  result: Result<T, E>
): asserts result is Err<E> {
  if (result.ok) {
    throw new ResultAssertError(`Expected Err, but got Ok: ${result.value}`);
  }
}

export function throwableAsync<T, E, F extends (...args: any[]) => Promise<T>>(
  fn: F,
  mapErr: (error: unknown) => Err<E> = (error) => {
    if (error instanceof Error) {
      return err(error);
    } else {
      return err(new Error(`Unknown error: ${error}`) as any);
    }
  }
): (...args: Parameters<F>) => Promise<Result<Awaited<ReturnType<F>>, Err<E>>> {
  const f = async (...args: Parameters<F>): Promise<Result<T, E>> => {
    try {
      const v = await fn(...args);
      return ok(v);
    } catch (error) {
      if (mapErr) {
        return mapErr(error);
      }
      if (error instanceof Error) {
        return err(error) as Err<E>;
      } else {
        return err(new Error(`Unknown error: ${error}`) as any);
      }
    }
  };
  return f as any;
}
