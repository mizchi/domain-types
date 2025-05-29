// 基本的なAsyncGeneratorの型定義
type AsyncStep<T> = AsyncGenerator<void, T, unknown>;

// waitFor関数の実装例
async function* waitForPromise<T>(
  promise: Promise<T>
): AsyncGenerator<void, T, unknown> {
  return yield* waitAsync(promise);
}

// 内部的な待機処理
async function* waitAsync<T>(
  promise: Promise<T>
): AsyncGenerator<void, T, unknown> {
  return await promise;
}

async function* waitFor<T>(
  g: AsyncGenerator<any, any, T>
): AsyncGenerator<void, T, unknown> {
  let result = await g.next();
  while (!result.done) {
    yield result.value;
    result = await g.next();
  }
  return result.value;
}

async function* sub(): AsyncGenerator<string, number, unknown> {
  yield "This is a generator!";
  yield "This is another value!";
  return 10; // 最後の値は1
}

async function* main() {
  const v = yield* waitForPromise(Promise.resolve("Hello, World!"));
  console.log(v);
  const result = yield* waitFor(sub());
  // const result = await waitForAsyncGenerator(g);
  console.log(result); // "This is a generator!"
  // 注意: この時点では、resultは1ではなく、"This is a generator!"が出力されます
  // これは、waitForAsyncGeneratorが最後の値を返すためです
}

for await (const value of main()) {
  console.log(value); // "Hello, World!" と "This is a generator!" が出力されます
  // ここでは何も出力されません
  // main関数内でのyieldによる値の受け渡しは、for awaitループでは直接受け取れません
}
