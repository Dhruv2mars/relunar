export type ParsedArgs = {
  positionals: string[];
  flags: Record<string, string | boolean>;
};

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }

    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const withoutPrefix = arg.slice(2);
    const equalsIndex = withoutPrefix.indexOf("=");
    if (equalsIndex >= 0) {
      const key = withoutPrefix.slice(0, equalsIndex);
      flags[key] = withoutPrefix.slice(equalsIndex + 1);
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      flags[withoutPrefix] = next;
      index += 1;
      continue;
    }

    flags[withoutPrefix] = true;
  }

  return { positionals, flags };
}

export function flagString(flags: Record<string, string | boolean>, name: string): string | undefined {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

export function flagNeedsValue(flags: Record<string, string | boolean>, name: string): boolean {
  return flags[name] === true;
}

export function flagPositiveInteger(flags: Record<string, string | boolean>, name: string): number | null | undefined {
  if (flagNeedsValue(flags, name)) {
    return null;
  }

  const value = flagString(flags, name);
  if (value === undefined) {
    return undefined;
  }

  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  return Number.parseInt(value, 10);
}

export function flagBoolean(flags: Record<string, string | boolean>, name: string): boolean {
  return flags[name] === true;
}
