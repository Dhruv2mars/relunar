import type { CommandEvidence, RelunarConfig, RunReport, SandboxSession } from "./types";

type EnvironmentFingerprint = NonNullable<RunReport["environment"]>;

export type PreparedTerminalEnvironment = {
  workdir: string;
  commandEnv: Record<string, string>;
  fingerprint: EnvironmentFingerprint;
  commands: CommandEvidence[];
};

export async function prepareTerminalEnvironment(input: {
  sandbox: SandboxSession;
  config: RelunarConfig;
  hostEnv: NodeJS.ProcessEnv;
  timeoutSeconds: number;
}): Promise<PreparedTerminalEnvironment> {
  const commandEnv = resolveCommandEnv(input.config, input.hostEnv);
  const workdir = resolveWorkdir(input.config.workspace?.workdir);
  const commands: CommandEvidence[] = [];

  if (input.config.workspace?.checkout) {
    const ref = shellQuote(input.config.workspace.checkout);
    const depth = input.config.workspace.fetchDepth;
    const fetch = depth && depth > 0 ? `git fetch --depth ${depth} origin ${ref}` : `git fetch origin ${ref}`;
    commands.push(await runRequired(input.sandbox, "workspace", `${fetch} && git checkout --detach FETCH_HEAD`, "repo", input.timeoutSeconds, commandEnv));
  }
  if (input.config.workspace?.submodules) {
    commands.push(await runRequired(input.sandbox, "workspace", "git submodule update --init --recursive", "repo", input.timeoutSeconds, commandEnv));
  }
  if (input.config.workspace?.lfs) {
    commands.push(await runRequired(input.sandbox, "workspace", "git lfs pull", "repo", input.timeoutSeconds, commandEnv));
  }

  for (const service of input.config.services ?? []) {
    commands.push(await runRequired(input.sandbox, "service_start", service.start, workdir, input.timeoutSeconds, commandEnv));
    let ready: CommandEvidence | null = null;
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      ready = await runEvidence(input.sandbox, "service_ready", service.ready, workdir, input.timeoutSeconds, commandEnv);
      if (ready.status === "passed") break;
      if (attempt < 20) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    commands.push(ready!);
    if (ready?.status !== "passed") throw new Error(`Service ${service.name} did not become ready: ${ready?.stderr || ready?.stdout}`);
  }

  let fingerprintOutput = "";
  try {
    const fingerprintResult = await input.sandbox.run(fingerprintCommand(), workdir, input.timeoutSeconds, commandEnv);
    fingerprintOutput = fingerprintResult.stdout;
  } catch {
    fingerprintOutput = "";
  }
  const fingerprint = parseFingerprint(
    fingerprintOutput,
    workdir,
    Object.keys(commandEnv).sort(),
    (input.config.services ?? []).map((service) => service.name),
  );
  return { workdir, commandEnv, fingerprint, commands };
}

export function resolveCommandEnv(config: RelunarConfig, hostEnv: NodeJS.ProcessEnv): Record<string, string> {
  const env = { ...(config.environment?.variables ?? {}) };
  for (const name of config.environment?.passthrough ?? []) {
    const value = hostEnv[name];
    if (value === undefined || value === "") throw new Error(`Missing environment passthrough variable: ${name}`);
    env[name] = value;
  }
  return env;
}

export function resolveWorkdir(relative: string | undefined): string {
  if (!relative || relative === ".") return "repo";
  if (relative.startsWith("/") || relative.split("/").includes("..")) throw new Error(`Unsafe workspace.workdir: ${relative}`);
  return `repo/${relative.replace(/^\.\//, "").replace(/\/$/, "")}`;
}

async function runRequired(
  sandbox: SandboxSession,
  name: string,
  command: string,
  cwd: string,
  timeoutSeconds: number,
  env: Record<string, string>,
): Promise<CommandEvidence> {
  const evidence = await runEvidence(sandbox, name, command, cwd, timeoutSeconds, env);
  if (evidence.status !== "passed") throw new Error(`${command} failed: ${evidence.stderr || evidence.stdout}`);
  return evidence;
}

async function runEvidence(
  sandbox: SandboxSession,
  name: string,
  command: string,
  cwd: string,
  timeoutSeconds: number,
  env: Record<string, string>,
): Promise<CommandEvidence> {
  const started = Date.now();
  const result = await sandbox.run(command, cwd, timeoutSeconds, env);
  return {
    name,
    command,
    status: result.timedOut ? "timed_out" : result.exitCode === 0 ? "passed" : "failed",
    exitCode: result.exitCode,
    durationMs: Date.now() - started,
    stdout: redact(result.stdout, Object.values(env)),
    stderr: redact(result.stderr, Object.values(env)),
    cwd,
    envNames: Object.keys(env).sort(),
    startedAt: new Date(started).toISOString(),
    finishedAt: new Date().toISOString(),
  };
}

function fingerprintCommand(): string {
  return "echo RELUNAR_FINGERPRINT >/dev/null; printf 'os=%s\\n' \"$(uname -s 2>/dev/null || echo unknown)\"; printf 'arch=%s\\n' \"$(uname -m 2>/dev/null || echo unknown)\"; for tool in node bun python3 go rustc cargo; do if command -v \"$tool\" >/dev/null 2>&1; then printf 'runtime:%s=' \"$tool\"; \"$tool\" --version 2>&1 | head -n 1; fi; done";
}

function parseFingerprint(
  output: string,
  workingDirectory: string,
  variableNames: string[],
  services: string[],
): EnvironmentFingerprint {
  const runtimes: Record<string, string> = {};
  let os = "unknown";
  let architecture = "unknown";
  for (const line of output.split("\n")) {
    if (line.startsWith("os=")) os = line.slice(3).trim() || "unknown";
    if (line.startsWith("arch=")) architecture = line.slice(5).trim() || "unknown";
    const match = /^runtime:([^=]+)=(.*)$/.exec(line);
    if (match?.[1] && match[2] !== undefined) runtimes[match[1]] = match[2].trim();
  }
  return { os, architecture, runtimes, workingDirectory, variableNames, services };
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function redact(value: string, secrets: string[]): string {
  return secrets.filter(Boolean).reduce((current, secret) => current.split(secret).join("[redacted]"), value);
}
