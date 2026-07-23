import { describe, expect, test } from "bun:test";
import { resolveSandboxLifecycleTimeout } from "../src/daytona";

describe("Daytona lifecycle", () => {
  test("allows cold image pulls at least five minutes and honors longer config", () => {
    expect(resolveSandboxLifecycleTimeout()).toBe(300);
    expect(resolveSandboxLifecycleTimeout(120)).toBe(300);
    expect(resolveSandboxLifecycleTimeout(900)).toBe(900);
  });
});
