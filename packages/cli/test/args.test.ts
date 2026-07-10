import { describe, expect, test } from "bun:test";
import { parseArgs } from "../src/args";

describe("CLI arguments", () => {
  test("preserves command arguments after separator", () => {
    expect(parseArgs(["repro", "exec", "run-1", "--", "bun", "test", "--watch=false"])).toEqual({
      positionals: ["repro", "exec", "run-1"],
      flags: {},
      passthrough: ["bun", "test", "--watch=false"],
    });
  });
});
