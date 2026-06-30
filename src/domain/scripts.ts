export type PackageScripts = {
  hasBuild: boolean;
  hasTest: boolean;
};

const placeholderTestPatterns = [
  /no test specified/i,
  /no tests? specified/i,
  /echo ['"]?error: no test/i,
  /exit 1\s*$/i,
];

export function detectRunnableScripts(packageJsonText: string): PackageScripts {
  const parsed = JSON.parse(packageJsonText) as { scripts?: Record<string, unknown> };
  const scripts = parsed.scripts ?? {};
  const build = typeof scripts.build === "string" ? scripts.build.trim() : "";
  const test = typeof scripts.test === "string" ? scripts.test.trim() : "";

  return {
    hasBuild: build.length > 0,
    hasTest: test.length > 0 && !placeholderTestPatterns.some((pattern) => pattern.test(test)),
  };
}
