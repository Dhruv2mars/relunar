import { describe, expect, test } from "bun:test";
import { buildCommand, detectPackageManager, testCommand } from "../src/domain/package-manager";

describe("package manager detection", () => {
  test("uses milestone lockfile priority", () => {
    expect(detectPackageManager(["package.json", "package-lock.json", "bun.lock"])?.packageManager).toBe("bun");
    expect(detectPackageManager(["package.json", "yarn.lock", "pnpm-lock.yaml"])?.packageManager).toBe("pnpm");
    expect(detectPackageManager(["package.json", "yarn.lock"])?.installCommand).toBe("yarn install --frozen-lockfile");
    expect(detectPackageManager(["package.json"])?.installCommand).toBe("npm install");
    expect(detectPackageManager([])).toBeNull();
  });

  test("chooses package manager specific build and test commands", () => {
    expect(buildCommand("bun")).toBe("bun run build");
    expect(testCommand("bun")).toBe("bun test");
    expect(buildCommand("pnpm")).toBe("pnpm run build");
    expect(testCommand("pnpm")).toBe("pnpm test");
    expect(buildCommand("yarn")).toBe("yarn build");
    expect(testCommand("yarn")).toBe("yarn test");
    expect(buildCommand("npm")).toBe("npm run build");
    expect(testCommand("npm")).toBe("npm test");
  });
});
