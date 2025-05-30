import { ok, err, assertErr, assertOk, type Result } from "../src/mod.ts";

function getValue(v: number): Result<string, string> {
  if (v > 0) {
    return ok("Value is positive");
  }
  return err("Value must be positive");
}

Deno.test("Result", () => {
  const result: Result<string, string> = getValue(5);
  if (result.ok) {
    const _: string = result.value;
  } else {
    const _: string = result.error;
  }
});

Deno.test("Result: ok case", () => {
  const result = getValue(10);
  // @ts-expect-error
  result.value;
  assertOk(result);
  console.log(result.value);
});

Deno.test("Result: err case", () => {
  const result = getValue(-5);
  // @ts-expect-error
  result.error;
  assertErr(result);
  console.log(result.error);
});
