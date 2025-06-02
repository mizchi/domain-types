import { nope, performAsync, returns } from "../../src/mod.ts";
import { query, log, ProgramEffect, read, timeout, write } from "./effects.ts";
import { program } from "./program.ts";
import { expect } from "@std/expect";

Deno.test("Sample App Program Test", async () => {
  const steps = await Array.fromAsync(
    performAsync(program(), {
      [log.t]: nope,
      [read.t]: returns("mocked"),
      [write.t]: nope,
      [timeout.t]: nope,
      [query.t]: returns([]),
    })
  );
  const expected: ProgramEffect[] = [
    log.of(["Starting complex workflow..."], undefined),
    read.of(["config.json"], "mocked"),
    log.of(["Config loaded: mocked"], undefined),
    query.of(["SELECT * FROM users"], []),
    log.of(["Found 0 users"], undefined),
    timeout.of([500], undefined),
    write.of(["report.txt", "Report: 0 users processed"], undefined),
    timeout.of([500], undefined),
  ];
  expect(steps).toEqual(expected);
});
