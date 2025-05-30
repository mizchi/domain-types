import {
  Eff,
  eff,
  perform,
  defineHandlers,
  AsyncTask,
  performResult,
  assertErr,
  assertOk,
} from "../src/mod.ts";
import { expect } from "@std/expect";

type PrintEffect = Eff<"print", string>;
function print(message: string): PrintEffect {
  return eff("print", message);
}

Deno.test("Eff Example", async () => {
  type FsReadEffect = Eff<"fsRead", { path: string }>;
  type FsWriteEffect = Eff<"fsWrite", { path: string; content: string }>;
  type TimerEffect = Eff<"timer", number>;
  type DatabaseEffect = Eff<"database", { query: string; params?: any[] }>;

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
    PrintEffect | FsReadEffect | TimerEffect | DatabaseEffect | FsWriteEffect
  > {
    yield print("Starting complex workflow...");

    // ファイル読み込み
    const config = yield* readFileTask("config.json");
    yield print(`Config loaded: ${config}`);

    // データベースクエリ
    const users = yield dbQuery("SELECT * FROM users");
    yield print(`Found ${users.length} users`);

    // 遅延
    yield delay(500);

    // 結果をファイルに保存
    const report = `Report: ${users.length} users processed`;
    yield* writeFileTask("report.txt", report);
    yield delay(500);
  }

  // Effect型の定義（プログラムで使用される全てのエフェクト）
  type ProgramEffect =
    | PrintEffect
    | FsReadEffect
    | TimerEffect
    | DatabaseEffect
    | FsWriteEffect;

  // 型推論可能なハンドラーの作成
  const handlers = defineHandlers<ProgramEffect>({
    async print(payload) {
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
  await perform(program(), handlers);

  // 同期プログラムの例
  function* syncProgram(): Generator<PrintEffect | TimerEffect> {
    yield print("同期プログラム開始");
    yield delay(100);
    yield print("同期プログラム完了");
  }

  // 同期プログラムの実行
  console.log("\n=== 同期プログラムの実行 ===");
  await perform(syncProgram(), handlers);
});

Deno.test("performResult", async () => {
  type ProgramEffect = PrintEffect;
  const handlers = defineHandlers<ProgramEffect>({
    async print(payload) {
      console.log(`[CONSOLE] ${payload}`);
      return payload; // コンソール出力の結果を返す
    },
  });
  const program = async function* (): AsyncTask<ProgramEffect, number> {
    yield print("A");
    yield print("B");
    return 1;
  };
  const result = await performResult(program(), handlers);
  assertOk(result);
  expect(result.value).toBe(1);
  expect(result.steps).toEqual([
    { eff: "print", payload: "A" },
    { eff: "print", payload: "B" },
  ]);
});

Deno.test("performResult with error", async () => {
  type ProgramEffect = PrintEffect;
  const handlers = defineHandlers<ProgramEffect>({
    async print(payload) {
      console.log(`[CONSOLE] ${payload}`);
      return payload; // コンソール出力の結果を返す
    },
  });
  const program = async function* (): AsyncTask<ProgramEffect, number> {
    yield print("A");
    let flag: boolean = true;
    if (flag) {
      throw new Error("Stop");
    }
    yield print("B");
    return 1;
  };
  const result = await performResult(program(), handlers);

  assertErr(result);
  expect(result.steps).toEqual([{ eff: "print", payload: "A" }]);
  expect(result.error).toBeInstanceOf(Error);
});
