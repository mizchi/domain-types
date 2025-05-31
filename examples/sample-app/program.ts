import { query, log, ProgramEffect, read, timeout, write } from "./effects.ts";

export async function* program(): AsyncGenerator<ProgramEffect, void> {
  yield* log("Starting complex workflow...");

  // ファイル読み込み
  const config = yield* read("config.json");
  yield* log(`Config loaded: ${config}`);

  // データベースクエリ
  const users = yield* query("SELECT * FROM users");
  yield* log(`Found ${users.length} users`);

  // 遅延
  yield* timeout(500);

  // 結果をファイルに保存
  const report = `Report: ${users.length} users processed`;
  yield* write("report.txt", report);
  yield* timeout(500);
}
