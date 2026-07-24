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
  const commandSecrets = resolveCommandSecrets(input.config, commandEnv);
  const workdir = resolveWorkdir(input.config.workspace?.workdir);
  const commands: CommandEvidence[] = [];

  if (input.config.workspace?.checkout) {
    const ref = shellQuote(input.config.workspace.checkout);
    const depth = input.config.workspace.fetchDepth;
    const fetch = depth && depth > 0 ? `git fetch --depth ${depth} origin ${ref}` : `git fetch origin ${ref}`;
    commands.push(await runRequired(input.sandbox, "workspace", `${fetch} && git checkout --detach FETCH_HEAD`, "repo", input.timeoutSeconds, commandEnv, commandSecrets));
  }
  if (input.config.workspace?.submodules) {
    commands.push(await runRequired(input.sandbox, "workspace", "git submodule update --init --recursive", "repo", input.timeoutSeconds, commandEnv, commandSecrets));
  }
  if (input.config.workspace?.lfs) {
    commands.push(await runRequired(input.sandbox, "workspace", "git lfs pull", "repo", input.timeoutSeconds, commandEnv, commandSecrets));
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

export async function startTerminalServices(input: {
  sandbox: SandboxSession;
  config: RelunarConfig;
  commandEnv: Record<string, string>;
  workdir: string;
  timeoutSeconds: number;
}): Promise<{ commands: CommandEvidence[]; failure: string | null }> {
  const commands: CommandEvidence[] = [];
  const commandSecrets = resolveCommandSecrets(input.config, input.commandEnv);
  for (const service of input.config.services ?? []) {
    const start = await runEvidence(
      input.sandbox,
      "service_start",
      serviceLaunchCommand(service.name, service.start),
      input.workdir,
      input.timeoutSeconds,
      input.commandEnv,
      commandSecrets,
      service.start,
    );
    commands.push(start);
    if (start.status !== "passed") {
      return { commands, failure: `${service.start} failed: ${start.stderr || start.stdout}` };
    }
    let ready: CommandEvidence | null = null;
    const attempts = Math.min(20, Math.max(1, input.timeoutSeconds));
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      ready = await runEvidence(input.sandbox, "service_ready", service.ready, input.workdir, Math.min(input.timeoutSeconds, 10), input.commandEnv, commandSecrets);
      if (ready.status === "passed") break;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    commands.push(ready!);
    if (ready?.status !== "passed") {
      return { commands, failure: `Service ${service.name} did not become ready: ${ready?.stderr || ready?.stdout}` };
    }
  }
  return { commands, failure: null };
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

export function resolveCommandSecrets(config: RelunarConfig, commandEnv: Record<string, string>): string[] {
  return (config.environment?.passthrough ?? [])
    .map((name) => commandEnv[name])
    .filter((value): value is string => Boolean(value));
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
  secrets: string[],
  displayCommand?: string,
): Promise<CommandEvidence> {
  const evidence = await runEvidence(sandbox, name, command, cwd, timeoutSeconds, env, secrets, displayCommand);
  if (evidence.status !== "passed") throw new Error(`${displayCommand ?? command} failed: ${evidence.stderr || evidence.stdout}`);
  return evidence;
}

async function runEvidence(
  sandbox: SandboxSession,
  name: string,
  command: string,
  cwd: string,
  timeoutSeconds: number,
  env: Record<string, string>,
  secrets: string[],
  displayCommand = command,
): Promise<CommandEvidence> {
  const started = Date.now();
  const result = await sandbox.run(command, cwd, timeoutSeconds, env);
  return {
    name,
    command: redact(displayCommand, secrets),
    status: result.timedOut ? "timed_out" : result.exitCode === 0 ? "passed" : "failed",
    exitCode: result.exitCode,
    durationMs: Date.now() - started,
    stdout: redact(result.stdout, secrets),
    stderr: redact(result.stderr, secrets),
    cwd,
    envNames: Object.keys(env).sort(),
    startedAt: new Date(started).toISOString(),
    finishedAt: new Date().toISOString(),
  };
}

function serviceLaunchCommand(name: string, command: string): string {
  const stem = name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "service";
  const log = `.relunar/services/${stem}.log`;
  const pid = `.relunar/services/${stem}.pid`;
  return `mkdir -p .relunar/services || exit $?; nohup sh -c ${shellQuote(command)} > ${shellQuote(log)} 2>&1 < /dev/null & relunar_service_pid=$!; printf '%s\\n' "$relunar_service_pid" > ${shellQuote(pid)}`;
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
