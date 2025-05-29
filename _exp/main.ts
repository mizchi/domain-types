// type Reducer<S, A> = (state: S, action: A) => S;

// type AppState = {
//   count: number;
// };

// type Action =
//   | {
//       type: "increment";
//     }
//   | {
//       type: "decrement";
//     }
//   | {
//       type: "set";
//       count: number;
//     };

// const counter: Reducer<AppState, Action> = (state = { count: 0 }, action) => {
//   switch (action.type) {
//     case "set": {
//       return { count: action.count };
//     }
//     case "increment":
//       return { count: state.count + 1 };
//     case "decrement":
//       return { count: state.count - 1 };
//     default:
//       return state;
//   }
// };
// const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// const handler = (state: AppState) => {};

// async function* generateInput() {
//   let i = 0;
//   while (i < 10) {
//     i++;
//     await wait(1000);
//     yield { type: "increment" } as const;
//   }
// }

// async function* keyStream(): AsyncGenerator<string> {
//   const decoder = new TextDecoder();
//   for await (const chunk of Deno.stdin.readable) {
//     const text = decoder.decode(chunk);
//     yield text;
//   }
// }

// // async function mergeIterators<T>(
// //   ...iterators: AsyncGenerator<T>[]
// // ): AsyncIte {
// // const promises = iterators.map((it) => it.next());

// async function* runApp(): AsyncGenerator<AppState> {
//   let state: AppState = { count: 0 };
//   for await (const key of keyStream()) {
//     console.log("Key pressed:", key);
//   }

//   for await (const action of generateInput()) {
//     state = counter(state, action);
//     yield state;
//   }
//   // let state = counter(undefined, {} as any);
//   // while (true) {
//   //   const action = yield state;
//   //   state = counter(state, action);
//   // }
// }

// // Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
// if (import.meta.main) {
//   for await (const state of runApp()) {
//     console.log("Current state:", state);
//   }
//   // console.log("Add 2 + 3 =", add(2, 3));
// }
async function* combineAsyncWithErrorHandling<T>(
  iterators: AsyncIterator<T>[]
): AsyncGenerator<T> {
  const pending = new Map();
  let nextId = 0;

  const startTask = async (iterator: AsyncIterator<T>, id: number) => {
    try {
      const result = await iterator.next();
      return { id, result, error: null };
    } catch (error) {
      return { id, result: { done: true }, error };
    }
  };

  // 初期タスク開始
  for (const iterator of iterators) {
    const id = nextId++;
    pending.set(id, { iterator, promise: startTask(iterator, id) });
  }

  while (pending.size > 0) {
    const promises = Array.from(pending.values()).map(({ promise }) => promise);
    const completed = await Promise.race(promises);

    const { id, result, error } = completed;
    const { iterator } = pending.get(id);

    if (error) {
      console.error(`Generator ${id} error:`, error);
      pending.delete(id);
      continue;
    }

    if (result.done) {
      pending.delete(id);
    } else {
      yield result.value;
      pending.set(id, { iterator, promise: startTask(iterator, id) });
    }
  }
}
async function* mapAsyncIterator<T, U>(
  iterator: AsyncGenerator<T>,
  mapper: (value: T) => U
): AsyncGenerator<U> {
  for await (const value of iterator) {
    yield mapper(value);
  }
}

// 使用例
async function* slowGen(): AsyncGenerator<number> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  yield 1;
  await new Promise((resolve) => setTimeout(resolve, 500));
  yield 2;
}

async function* fastGen(): AsyncGenerator<number> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  yield 3;
  await new Promise((resolve) => setTimeout(resolve, 400));
  yield 4;
}

async function* main() {
  yield* combineAsyncWithErrorHandling([
    slowGen(),
    fastGen(),
    mapAsyncIterator(slowGen(), (x) => x * 10),
  ]);
}

for await (const value of main()) {
  console.log(value);
}
