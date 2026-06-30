import { describe, expect, test } from "bun:test";
import { parseRelunarConfig } from "../src/domain/relunar-config";

describe("Relunar config", () => {
  test("parses setup commands from .relunar.yml", () => {
    const config = parseRelunarConfig("setup:\n  - bun run generate\n  - bun run db:prepare\n");

    expect(config).toEqual({
      setupCommands: ["bun run generate", "bun run db:prepare"],
    });
  });

  test("treats empty config as no setup commands", () => {
    expect(parseRelunarConfig("")).toEqual({ setupCommands: [] });
  });

  test("rejects non-array setup config", () => {
    expect(() => parseRelunarConfig("setup: bun run generate\n")).toThrow();
  });

  test("rejects blank setup commands", () => {
    expect(() => parseRelunarConfig("setup:\n  - '   '\n")).toThrow();
  });
});
