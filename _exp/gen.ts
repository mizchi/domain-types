type Cmd =
  | {
      type: "print";
      payload?: string;
    }
  | {
      type: "increment";
    }
  | {
      type: "init";
    };

type State = {
  count: number;
};
// type Effect = "print" | "increment";
type Handler = (s: State, cmd: Cmd) => Effect;
type Reducer = (s: State, cmd: Cmd) => [Cmd[], State];
type Effect = [tag: string, cmd: Cmd[]];

async function* app(): AsyncGenerator<Cmd, void, State> {
  // initial: State,
  // handler: Handler
  yield {
    type: "increment",
  };

  // // let state: State = initial;
  // const cmds1 = yield {
  //   type: "print",
  //   payload: "Hello from generator",
  // };

  // // console.log("next", x); // 3
  // state = yield handler(state, {
  //   type: "increment",
  // });
  // console.log("next", y); // undefined
  // yield 2;
}

const handler: Handler = (_state: State, cmd: Cmd) => {
  switch (cmd.type) {
    case "print":
      console.log(cmd.payload);
      return ["print", []];
    case "increment":
      return ["increment", [cmd]];
    case "init": {
      return ["init", []];
    }
    default: {
      throw new Error(`Unknown command type: ${cmd}`);
    }
  }
};

const reducer = (s: State, cmd: Cmd): [Cmd[], State] => {
  switch (cmd.type) {
    case "increment": {
      return [[], { count: s.count + 1 }];
    }
  }
  return [[], s];
};

async function run() {
  const g = app();

  // let sum = 0;
  let state = { count: 0 };
  let cmds: Cmd[] = [];
  [state, cmds] = await g.next(state);
  // console.log("Next:", next);
  // console.log("Yielded effect:", next.value);
  // console.log("State:", state);
  while (!next.done) {
    const cmd = next.value;
    state = reducer(state, cmd);
    // console.log("Yielded effect:", next.value);
    // next = await g.next(state);
    // const v = await g.next("sum:" + state.count.toString());
  }
  console.log("Done:", state);
}
await run();
// for await (const v of g) {
//   console.log(v);
// }
