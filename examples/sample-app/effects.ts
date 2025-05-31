import { defineEffect, type EffectFor } from "../../src/mod.ts";

// Define effects
export const read = defineEffect<"read", [path: string], string>("read");
export const write = defineEffect<
  "write",
  [path: string, content: string],
  void
>("write");
export const timeout = defineEffect<"timer", [ms: number], void>("timer");
export const query = defineEffect<
  "query",
  [query: string, params?: any[]],
  any[]
>("query");

export const log = defineEffect<"log", [message: string], void>("log");

export type ProgramEffect =
  | EffectFor<typeof log>
  | EffectFor<typeof read>
  | EffectFor<typeof timeout>
  | EffectFor<typeof query>
  | EffectFor<typeof write>;
