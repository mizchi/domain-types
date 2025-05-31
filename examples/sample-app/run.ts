import { performAsync, type AsyncHandlersFor } from "../../src/mod.ts";
import { query, log, ProgramEffect, read, timeout, write } from "./effects.ts";
import { program } from "./program.ts";

// ハンドラーの作成
const handlers: AsyncHandlersFor<ProgramEffect> = {
  [log.t]: async (payload) => {
    console.log(`[CONSOLE] ${payload}`);
  },
  [read.t]: async (path) => {
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
  [write.t]: async (path, content) => {
    // ファイル書き込みをシミュレート
    await new Promise((resolve) => setTimeout(resolve, 300));
  },
  [timeout.t]: async (ms) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  },
  [query.t]: async (query, params) => {
    return [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
      { id: 3, name: "Charlie" },
    ];
  },
};

// 非同期プログラムの実行
console.log("=== 非同期プログラムの実行 ===");
const steps = await Array.fromAsync(performAsync(program(), handlers));
console.log("Program steps:", steps);
