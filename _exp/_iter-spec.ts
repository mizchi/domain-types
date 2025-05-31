{
  async function* g() {
    yield 1;
    yield 2;
    yield 3;
    return 4;
  }
  async function* f() {
    yield 0;
    const r = yield* g();
    yield r;
    yield 5;
  }

  async function main() {
    for await (const v of f()) {
      console.log(v);
    }
  }

  await main();
  /**
    0
    1
    2
    3
    4
    5
   */
}

{
  async function* f(): AsyncGenerator<number, void, number> {
    const ret = yield 1;
    console.log("[next]", ret);
    const ret2 = yield 2;
    console.log("[next]", ret2);
  }

  async function main() {
    const handler = (v: any) => {
      console.log("[handler]", v);
      return v * 2;
    };

    const gen = f();
    let next = await gen.next();
    while (!next.done) {
      const result = handler(next.value);
      next = await gen.next(result);
    }
  }

  await main();
  /**
    [handler] 1
    [next] 2
    [handler] 2
    [next] 4
   */
}

{
  // v3: with yield* and async generator
  async function* g(): AsyncGenerator<number, void, number> {
    const x = yield 7;
    console.log("[g]", x);
    const y = yield 11;
    console.log("[g]", y);
  }
  async function* f(): AsyncGenerator<number, void, number> {
    const ret = yield 1;
    console.log("[f]", ret);
    const ret2 = yield 2;
    console.log("[f]", ret2);
    yield* g();
  }

  async function main() {
    const handler = (v: any) => {
      console.log("[handler]", v);
      return v * 2;
    };

    const gen = f();
    let next = await gen.next();
    while (!next.done) {
      const result = handler(next.value);
      next = await gen.next(result);
    }
  }

  await main();
  /**
[f] 2
[handler] 2
[f] 4
[handler] 7
[g] 14
[handler] 11
[g] 22
   */
}

{
  // v4: perform
  console.log("-------- v4: perform");
  async function* g(): AsyncGenerator<number, void, number> {
    const x = yield 7;
    console.log("[g]", x);
    const y = yield 11;
    console.log("[g]", y);
  }
  async function* f(): AsyncGenerator<number, void, number> {
    const ret = yield 1;
    console.log("[f]", ret);
    const ret2 = yield 2;
    console.log("[f]", ret2);
    yield* g();
  }

  async function perform(
    generator: AsyncGenerator<number, void, number>,
    handler: (value: number) => Promise<number>
  ) {
    let next = await generator.next();
    while (!next.done) {
      const result = await handler(next.value);
      next = await generator.next(result);
    }
  }
  async function main() {
    const handler = async (v: number) => {
      console.log("[handler]", v);
      return v * 2;
    };
    await perform(f(), handler);
  }

  await main();
  /**
[f] 2
[handler] 2
[f] 4
[handler] 7
[g] 14
[handler] 11
[g] 22
   */
}

{
  // v5: perform
  console.log("-------- v5: perform");
  type GetValueEff = {
    eff: "getValue";
    payload: undefined;
  };
  type DoubleEff = {
    eff: "double";
    payload: number;
  };
  type Eff = DoubleEff | GetValueEff;
  type HandlerMap = {
    double: (payload: number) => Promise<number>;
    getValue: () => Promise<number>;
  };

  // Handler を通るはずの yield の結果(TNext)を Return に入れ替える
  // Eff => T は Handler 側で行われる前提で、かなり弱い制約。
  // any to number の cast になっている
  async function* double(payload: number): AsyncGenerator<DoubleEff, number> {
    return yield {
      eff: "double",
      payload,
    };
  }
  async function* getValue(): AsyncGenerator<GetValueEff, number> {
    return yield {
      eff: "getValue",
      payload: undefined,
    };
  }
  async function* f(): AsyncGenerator<Eff, void, any> {
    const v = yield* getValue();
    console.log("[val]", v);
    const ret = yield* double(v);
    console.log("[f]", ret);
  }

  async function perform(
    generator: AsyncGenerator<Eff, void>,
    handlers: HandlerMap
  ) {
    let next = await generator.next();
    while (!next.done) {
      const result = await handlers[next.value.eff](next.value.payload as any);
      next = await generator.next(result);
    }
  }
  async function main() {
    const handlers: HandlerMap = {
      double: async (payload: number) => {
        console.log("[double handler]", payload);
        return payload * 2;
      },
      getValue: async () => {
        console.log("[getValue handler]");
        return 42; // 固定値を返す
      },
    } as const;
    await perform(f(), handlers);
  }

  await main();
  /**
[getValue handler]
[val] 42
[double handler] 42
[f] 84
   */
}
