import type { PackageManager } from "./types";

export type PackageDetection = {
  packageManager: PackageManager;
  reason: string;
  installCommand: string;
};

const lockfileOrder: Array<{ file: string; packageManager: PackageManager; installCommand: string }> = [
  { file: "bun.lockb", packageManager: "bun", installCommand: "bun install" },
  { file: "bun.lock", packageManager: "bun", installCommand: "bun install" },
  { file: "pnpm-lock.yaml", packageManager: "pnpm", installCommand: "pnpm install --frozen-lockfile" },
  { file: "yarn.lock", packageManager: "yarn", installCommand: "yarn install --frozen-lockfile" },
  { file: "package-lock.json", packageManager: "npm", installCommand: "npm ci" },
];

export function detectPackageManager(files: readonly string[]): PackageDetection | null {
  const fileSet = new Set(files);
  for (const candidate of lockfileOrder) {
    if (fileSet.has(candidate.file)) {
      return {
        packageManager: candidate.packageManager,
        reason: candidate.file,
        installCommand: candidate.installCommand,
      };
    }
  }

  if (fileSet.has("package.json")) {
    return {
      packageManager: "npm",
      reason: "package.json",
      installCommand: "npm install",
    };
  }

  return null;
}

export function buildCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case "bun":
      return "bun run build";
    case "pnpm":
      return "pnpm run build";
    case "yarn":
      return "yarn build";
    case "npm":
      return "npm run build";
  }
}

export function testCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case "bun":
      return "bun test";
    case "pnpm":
      return "pnpm test";
    case "yarn":
      return "yarn test";
    case "npm":
      return "npm test";
  }
}
