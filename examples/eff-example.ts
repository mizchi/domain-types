import { Eff, eff, runEff, createHandlers, waitFor } from "../src/mod.ts";

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
  // Effect型の定義（プログラムで使用される全てのエフェクト）
  type ProgramEffect =
    | ConsoleEffect
    | FsReadEffect
    | TimerEffect
    | DatabaseEffect
    | FsWriteEffect;

  // 型推論可能なハンドラーの作成
  const handlers = createHandlers<ProgramEffect>({
    async console(payload) {
      console.log(`[CONSOLE] ${payload}`);
      return payload; // コンソール出力の結果を返す
    },
    async fsRead(payload) {
      const { path } = payload;
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
    fsWrite: async (payload) => {
      const { path, content } = payload;
      // ファイル書き込みをシミュレート
      await new Promise((resolve) => setTimeout(resolve, 300));
      console.log(`[FILE WRITE] ${path}: ${content}`);
      return undefined;
    },

    timer: async (payload) => {
      console.log(`[TIMER] Waiting ${payload}ms...`);
      await new Promise((resolve) => setTimeout(resolve, payload));
      console.log(`[TIMER] Wait completed`);
    },

    database: async (payload) => {
      const { query, params } = payload;
      console.log(`[DB] Executing: ${query}`, params);
      await new Promise((resolve) => setTimeout(resolve, 800));
      // モックデータを返す
      return [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Charlie" },
      ];
    },
  });

  // 非同期プログラムの実行
  console.log("=== 非同期プログラムの実行 ===");
  await runEff(program(), handlers);

  // 同期プログラムの例
  function* syncProgram(): Generator<ConsoleEffect | TimerEffect> {
    yield print("同期プログラム開始");
    yield delay(100);
    yield print("同期プログラム完了");
  }

  // 同期プログラムの実行
  console.log("\n=== 同期プログラムの実行 ===");
  await runEff(syncProgram(), handlers);
}
