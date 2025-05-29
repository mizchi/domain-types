type Eff<T extends string, P = void> = {
  type: T;
  payload: P;
};

function eff<T extends string, P = void>(type: T, payload: P): Eff<T, P> {
  return { type, payload };
}

// Handler型の定義
type Handler<E extends Eff<any, any>, R> = (effect: E) => Promise<R> | R;

// Effect System の核となる実行エンジン
async function runEff<TEffect extends Eff<any, any>, TResult>(
  generator: AsyncGenerator<TEffect, TResult, any>,
  handlers: {
    [K in TEffect["type"]]: Handler<Extract<TEffect, { type: K }>, any>;
  }
): Promise<TResult> {
  let result = await generator.next();

  while (!result.done) {
    const effect = result.value;
    // @ts-ignore
    const handler = handlers[effect.type];

    if (!handler) {
      throw new Error(`No handler found for effect type: ${effect.type}`);
    }

    // Handlerを実行して結果を取得
    const handlerResult = await handler(effect);

    // 結果をgeneratorに送り返す
    result = await generator.next(handlerResult);
  }

  return result.value;
}

async function* waitFor<T, R, TResult>(
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

// -----

type FsReadEffect = Eff<"fsRead", { path: string }>;
type FsWriteEffect = Eff<"fsWrite", { path: string; content: string }>;
type TimerEffect = Eff<"timer", number>;
type DatabaseEffect = Eff<"database", { query: string; params?: any[] }>;
type ConsoleEffect = Eff<"console", string>;

function print(message: string): ConsoleEffect {
  return eff("console", message);
}
function readFile(path: string): FsReadEffect {
  return eff("fsRead", { path });
}
function writeFile(path: string, content: string): FsWriteEffect {
  return eff("fsWrite", { operation: "write", path, content });
}
function delay(ms: number): TimerEffect {
  return eff("timer", ms);
}
function dbQuery(query: string, params?: any[]): DatabaseEffect {
  return eff("database", { query, params });
}

async function* readFileTask(
  path: string
): AsyncGenerator<FsReadEffect, string> {
  return yield readFile(path);
}

async function* writeFileTask(
  path: string,
  content: string
): AsyncGenerator<FsWriteEffect, void> {
  yield writeFile(path, content);
}

// 複雑なワークフロー
async function* program(): AsyncGenerator<
  ConsoleEffect | FsReadEffect | TimerEffect | DatabaseEffect | FsWriteEffect
> {
  yield print("Starting complex workflow...");

  // ファイル読み込み
  const config = yield* waitFor(readFileTask("config.json"));
  yield print(`Config loaded: ${config}`);

  // データベースクエリ
  const users = yield dbQuery("SELECT * FROM users");
  yield print(`Found ${users.length} users`);

  // 遅延
  yield delay(500);

  // 結果をファイルに保存
  const report = `Report: ${users.length} users processed`;
  yield* waitFor(writeFileTask("report.txt", report));
  yield delay(500);
}

{
  // with handlers
  const handlers = {
    console: async (effect: ConsoleEffect) => {
      console.log(`[CONSOLE] ${effect.payload}`);
      return effect.payload; // コンソール出力の結果を返す
    },

    fsRead: async (effect: FsReadEffect) => {
      const { path } = effect.payload;
      console.log(`[FILE READ] ${path}`);

      // ファイル読み込みをシミュレート
      await new Promise((resolve) => setTimeout(resolve, 500));
      return JSON.stringify(
        {
          type: "config",
          path,
          data: { setting1: "value1", setting2: "value2" },
        },
        null,
        2
      );
    },

    fsWrite: async (effect: FsWriteEffect) => {
      const { path, content } = effect.payload;
      // ファイル書き込みをシミュレート
      await new Promise((resolve) => setTimeout(resolve, 300));
      console.log(`[FILE WRITE] ${path}: ${content}`);
      return undefined;
    },

    timer: async (effect: TimerEffect) => {
      console.log(`[TIMER] Waiting ${effect.payload}ms...`);
      await new Promise((resolve) => setTimeout(resolve, effect.payload));
      console.log(`[TIMER] Wait completed`);
    },

    database: async (effect: DatabaseEffect) => {
      const { query, params } = effect.payload;
      console.log(`[DB] Executing: ${query}`, params);
      await new Promise((resolve) => setTimeout(resolve, 800));
      // モックデータを返す
      return [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Charlie" },
      ];
    },
  } as const;

  // 実行
  await runEff(program(), handlers);
}
