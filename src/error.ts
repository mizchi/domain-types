type ErrorConstructor<T extends Error = Error> = new (...args: any[]) => T;

/**
 * エラーが指定された型であることをアサートする関数
 * @param error - チェックするエラー
 * @param ErrorClass - 期待するエラークラス
 * @throws AssertionError エラーが期待する型でない場合
 */
export function assertErrorInstance<T extends Error>(
  error: unknown,
  ErrorClass: ErrorConstructor<T>
): asserts error is T {
  if (!(error instanceof ErrorClass)) {
    throw new Error(
      `Expected error to be instance of ${ErrorClass.name}, but got ${
        error instanceof Error ? error.constructor.name : typeof error
      }`
    );
  }
}
