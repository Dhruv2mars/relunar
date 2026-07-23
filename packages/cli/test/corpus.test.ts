import { describe, expect, test } from "bun:test";
import corpus from "./fixtures/terminal-corpus.json";

describe("real issue regression corpus", () => {
  test("keeps a bounded cross-ecosystem set with explicit expected outcomes", () => {
    expect(corpus.length).toBeGreaterThanOrEqual(20);
    expect(
      new Set(corpus.map((entry) => `${entry.repo}#${entry.issue}`)).size,
    ).toBe(corpus.length);
    expect(new Set(corpus.map((entry) => entry.ecosystem))).toEqual(
      new Set([
        "rust",
        "typescript",
        "python",
        "go",
        "c",
        "java",
        "javascript",
        "shell",
      ]),
    );
    expect(
      corpus.every((entry) =>
        ["reproduced", "not-reproduced", "blocked"].includes(
          entry.expectedOutcome,
        ),
      ),
    ).toBe(true);
    expect(new Set(corpus.map((entry) => entry.expectedOutcome))).toEqual(
      new Set(["reproduced", "not-reproduced", "blocked"]),
    );
    expect(corpus.some((entry) => entry.kind === "bug")).toBe(true);
    expect(corpus.some((entry) => entry.kind === "enhancement")).toBe(true);
  });
});
