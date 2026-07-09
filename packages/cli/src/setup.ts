import { execFile } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { promisify } from "node:util";
import { isRepoSlug, linkRepo, readGlobalConfig, writeGlobalConfig } from "./config";
import { resolveDaytonaApiKey, resolveGithubToken, writeSecret, type SecretBackend, type SecretName } from "./credentials";
import type { RepoSlug } from "./types";

const execFileAsync = promisify(execFile);

export type SetupPrompter = {
  text(message: string, options?: { defaultValue?: string; secret?: boolean }): Promise<string>;
  confirm(message: string, defaultValue?: boolean): Promise<boolean>;
  close?(): void;
};

export type SetupIO = {
  stdout(message: string): void;
  stderr(message: string): void;
};

export type SetupOptions = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  configPath: string;
  io: SetupIO;
  prompt?: SetupPrompter | undefined;
  secretWriter?: ((name: SecretName, value: string) => Promise<SecretBackend | void>) | undefined;
};

export type SetupStatus = {
  github: boolean;
  daytona: boolean;
  repoLinked: boolean;
};

export async function readSetupStatus(options: Pick<SetupOptions, "cwd" | "env" | "configPath">): Promise<SetupStatus> {
  const config = await readGlobalConfig(options.configPath);
  return {
    github: (await resolveGithubToken(options.env)) !== null,
    daytona: (await resolveDaytonaApiKey(options.env)) !== null,
    repoLinked: config.repoLinks[options.cwd] !== undefined,
  };
}

export async function runInteractiveSetup(options: SetupOptions): Promise<boolean> {
  const prompt = options.prompt ?? createNodePrompter();
  const secretWriter = options.secretWriter ?? writeSecret;
  const config = await readGlobalConfig(options.configPath);
  let changed = false;
  let githubReady = (await resolveGithubToken(options.env)) !== null;
  let daytonaReady = (await resolveDaytonaApiKey(options.env)) !== null;

  try {
    options.io.stdout("Relunar setup\n");

    if (githubReady) {
      options.io.stdout("ok GitHub auth available\n");
    } else {
      options.io.stdout("GitHub token not found. Run `gh auth login`, set RELUNAR_GITHUB_TOKEN, or paste a token now.\n");
      const token = await prompt.text("GitHub token", { secret: true });
      if (!token.trim()) {
        options.io.stderr("Skipped GitHub auth\n");
      } else {
        await secretWriter("github-token", token.trim());
        changed = true;
        githubReady = true;
        options.io.stdout("Saved GitHub token\n");
      }
    }

    if (daytonaReady) {
      options.io.stdout("ok Daytona auth available\n");
    } else {
      const apiKey = await prompt.text("Daytona API key", { secret: true });
      if (!apiKey.trim()) {
        options.io.stderr("Skipped Daytona auth\n");
      } else {
        await secretWriter("daytona-api-key", apiKey.trim());
        changed = true;
        daytonaReady = true;
        options.io.stdout("Saved Daytona API key\n");
      }
    }

    const currentApiUrl = options.env.RELUNAR_DAYTONA_API_URL ?? config.daytona?.apiUrl ?? "https://app.daytona.io/api";
    const currentTarget = options.env.RELUNAR_DAYTONA_TARGET ?? config.daytona?.target ?? "";
    const apiUrl = await prompt.text("Daytona API URL", { defaultValue: currentApiUrl });
    const target = await prompt.text("Daytona target (optional)", { defaultValue: currentTarget });
    await writeGlobalConfig(
      {
        ...config,
        daytona: {
          ...(apiUrl.trim() ? { apiUrl: apiUrl.trim() } : {}),
          ...(target.trim() ? { target: target.trim() } : {}),
        },
      },
      options.configPath,
    );
    changed = true;

    const existingRepo = config.repoLinks[options.cwd];
    if (existingRepo) {
      options.io.stdout(`ok linked repo ${existingRepo}\n`);
    } else {
      const detected = await detectGitHubRepo(options.cwd);
      const shouldLink = detected ? await prompt.confirm(`Link current directory to ${detected}?`, true) : false;
      let repo: RepoSlug | null = shouldLink && detected ? detected : null;
      if (!repo) {
        const entered = await prompt.text("Repo to link now (owner/repo, optional)");
        const trimmed = entered.trim();
        repo = isRepoSlug(trimmed) ? trimmed : null;
      }
      if (repo) {
        await linkRepo(options.cwd, repo, options.configPath);
        changed = true;
        options.io.stdout(`Linked ${repo}\n`);
      }
    }

    if (githubReady && daytonaReady) {
      options.io.stdout("Relunar setup complete\n");
      return true;
    }

    if (!changed) {
      options.io.stderr("Relunar setup incomplete\n");
    } else {
      options.io.stderr("Relunar setup saved, but required auth is still unavailable in this shell\n");
    }
    return false;
  } finally {
    if (!options.prompt) {
      prompt.close?.();
    }
  }
}

function createNodePrompter(): SetupPrompter {
  return {
    text: async (message, options) => {
      if (options?.secret) {
        return questionSecret(message);
      }
      return questionText(message, options?.defaultValue);
    },
    confirm: async (message, defaultValue = false) => {
      const answer = (await questionText(`${message} [${defaultValue ? "Y/n" : "y/N"}]`)).trim().toLowerCase();
      if (!answer) {
        return defaultValue;
      }
      return answer === "y" || answer === "yes";
    },
    close: () => undefined,
  };
}

async function questionText(message: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const suffix = defaultValue ? ` (${defaultValue})` : "";
    const answer = await rl.question(`${message}${suffix}: `);
    return answer.trim() || defaultValue || "";
  } finally {
    rl.close();
  }
}

async function questionSecret(message: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== "function") {
    return questionText(`${message} (hidden input unavailable)`);
  }

  return new Promise((resolve, reject) => {
    let value = "";
    let escapeMode: "none" | "esc" | "csi" = "none";
    const input = process.stdin;
    const wasRaw = input.isRaw;

    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode(wasRaw);
      input.pause();
    };

    const finish = () => {
      process.stdout.write("\n");
      cleanup();
      resolve(value);
    };

    const cancel = () => {
      process.stdout.write("\n");
      cleanup();
      reject(new Error("Input cancelled."));
    };

    const onData = (chunk: Buffer | string) => {
      for (const char of chunk.toString("utf8")) {
        if (escapeMode === "csi") {
          if (char >= "@" && char <= "~") {
            escapeMode = "none";
          }
          continue;
        }
        if (escapeMode === "esc") {
          escapeMode = char === "[" ? "csi" : "none";
          continue;
        }
        if (char === "\u0003") {
          cancel();
          return;
        }
        if (char === "\u001b") {
          escapeMode = "esc";
          continue;
        }
        if (char === "\r" || char === "\n") {
          finish();
          return;
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (char >= " ") {
          value += char;
        }
      }
    };

    process.stdout.write(`${message}: `);
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

async function detectGitHubRepo(cwd: string): Promise<RepoSlug | null> {
  try {
    const { stdout } = await execFileAsync("git", ["config", "--get", "remote.origin.url"], { cwd });
    return parseGitHubRemote(stdout.trim());
  } catch {
    return null;
  }
}

function parseGitHubRemote(remote: string): RepoSlug | null {
  const match = remote.match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  return `${match[1]}/${match[2]}`;
}
