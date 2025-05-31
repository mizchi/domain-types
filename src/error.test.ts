import { assertErrorInstance } from "./error.ts";
Deno.test("assertError", () => {
  class MyError extends Error {}
  const e = new MyError("test error") as any;
  assertErrorInstance(e, MyError);
  const _: MyError = e; // should not throw
});
