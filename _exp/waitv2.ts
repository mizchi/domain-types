async function* waitFor<T, R>(
  g: AsyncGenerator<T, R>
): AsyncGenerator<T, R, unknown> {
  let result = await g.next();
  while (!result.done) {
    yield result.value;
    result = await g.next();
  }
  return result.value;
}

type Eff<T> = void & {
  type: T;
};
function eff<T extends string>(type?: string): Eff<T> {
  return { type } as Eff<T>;
}

async function* sub(): AsyncGenerator<Eff<"console">, number> {
  yield eff<"console">("This is a generator!");
  yield eff<"console">("This is another value!");
  // 最後の値は1
  return 10; // 最後の値は1
}

async function* httpGet(): AsyncGenerator<Eff<"net">, { value: number }> {
  // 最後の値は1
  yield eff<"net">("xxx");
  return { value: 42 }; // 最後の値は1
}

async function* main(): AsyncGenerator<
  Eff<"console"> | Eff<"net">,
  void,
  unknown
> {
  const result = yield* waitFor(sub());
  console.log(result); // "This is a generator!"
  const netResult = yield* waitFor(httpGet());
  console.log(netResult); // "This is a generator!" が出力されます
}

for await (const value of main()) {
  console.log(value); // "Hello, World!" と "This is a generator!" が出力されます
  // ここでは何も出力されません
  // main関数内でのyieldによる値の受け渡しは、for awaitループでは直接受け取れません
}
