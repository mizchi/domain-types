import {
  defineEffect,
  type EffectFor,
  type AsyncHandlersFor,
  performAsync,
  type ResultStep,
} from "../src/mod.ts";
import { expect } from "@std/expect";

Deno.test("Effect Example", async () => {
  const print = defineEffect<"print", [message: string], void>("print");
  const readFile = defineEffect<"fsRead", [path: string], string>("fsRead");
  const writeFile = defineEffect<
    "fsWrite",
    [path: string, content: string],
    void
  >("fsWrite");
  const delay = defineEffect<"timer", [ms: number], void>("timer");
  const dbQuery = defineEffect<
    "database",
    [query: string, params?: any[]],
    any[]
  >("database");

  type ProgramEffect =
    | EffectFor<typeof print>
    | EffectFor<typeof readFile>
    | EffectFor<typeof writeFile>
    | EffectFor<typeof delay>
    | EffectFor<typeof dbQuery>;

  // 複雑なワークフロー
  async function* program(): AsyncGenerator<ProgramEffect> {
    yield* print("Starting complex workflow...");

    // ファイル読み込み
    const config = yield* readFile("config.json");
    yield* print(`Config loaded: ${config}`);

    // データベースクエリ
    const users = yield* dbQuery("SELECT * FROM users");
    yield* print(`Found ${users.length} users`);

    // 遅延
    yield* delay(100);

    // 結果をファイルに保存
    const report = `Report: ${users.length} users processed`;
    yield* writeFile("report.txt", report);
    yield* delay(100);
  }

  // Effect型の定義（プログラムで使用される全てのエフェクト）

  // 型推論可能なハンドラーの作成
  const handlers: AsyncHandlersFor<ProgramEffect> = {
    async [print.t](message) {
      return undefined;
    },
    async [readFile.t](path) {
      // ファイル読み込みをシミュレート
      await new Promise((resolve) => setTimeout(resolve, 0));
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
    [writeFile.t]: async (path, content) => {
      // ファイル書き込みをシミュレート
      await new Promise((resolve) => setTimeout(resolve, 0));
      return undefined;
    },

    [delay.t]: async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    },
    [dbQuery.t]: async (query, params) => {
      return [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Charlie" },
      ];
    },
  };

  const xs = await Array.fromAsync(performAsync(program(), handlers));
  const expected: ResultStep<ProgramEffect>[] = [
    ["print", ["Starting complex workflow..."], undefined],
    [
      "fsRead",
      ["config.json"],
      JSON.stringify(
        {
          type: "config",
          path: "config.json",
          data: { setting1: "value1", setting2: "value2" },
        },
        null,
        2
      ),
    ],
    [
      "print",
      [
        `Config loaded: ${JSON.stringify(
          {
            type: "config",
            path: "config.json",
            data: { setting1: "value1", setting2: "value2" },
          },
          null,
          2
        )}`,
      ],
      undefined,
    ],
    [
      "database",
      ["SELECT * FROM users"],
      [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Charlie" },
      ],
    ],
    ["print", ["Found 3 users"], undefined],
    ["timer", [100], undefined],
    ["fsWrite", ["report.txt", "Report: 3 users processed"], undefined],
    ["timer", [100], undefined],
  ];

  expect(xs).toEqual(expected);
});
