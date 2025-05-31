import { type EffectFor, defineEffect, perform } from "@mizchi/domain-types";

const val = defineEffect<"val", [], number>("val");
type ProgramEffect = EffectFor<typeof val>;
function* program(): Generator<ProgramEffect> {
  yield* val();
}

console.log(
  ...perform(program(), {
    [val.t]: () => 42,
  })
);
// => [ "val", [], 42 ]
