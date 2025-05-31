import { none, performAsync, ResultStep, returns } from "../../src/mod.ts";
import { query, log, ProgramEffect, read, timeout, write } from "./effects.ts";
import { program } from "./program.ts";
import { expect } from "@std/expect";

Deno.test("Sample App Program Test", async () => {
  const steps = await Array.fromAsync(
    performAsync(program(), {
      [log.t]: none,
      [read.t]: returns("mocked"),
      [write.t]: none,
      [timeout.t]: none,
      [query.t]: returns([]),
    })
  );
  const expected: ResultStep<ProgramEffect>[] = [
    [log.t, ["Starting complex workflow..."], undefined],
    [read.t, ["config.json"], "mocked"],
    [log.t, ["Config loaded: mocked"], undefined],
    [query.t, ["SELECT * FROM users"], []],
    [log.t, ["Found 0 users"], undefined],
    [timeout.t, [500], undefined],
    [write.t, ["report.txt", "Report: 0 users processed"], undefined],
    [timeout.t, [500], undefined],
  ];
  expect(steps).toEqual(expected);
});
