import { createHash } from "node:crypto";
import { mkdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { runStoreDir } from "./runs";
import type { RunReport, SandboxSession } from "./types";

type ArtifactRecord = NonNullable<RunReport["artifacts"]>[number];

export async function collectArtifacts(input: {
  cwd: string;
  runId: string;
  sandbox: SandboxSession;
  patterns: string[];
  timeoutSeconds: number;
}): Promise<ArtifactRecord[]> {
  if (input.patterns.length === 0) return [];
  if (!input.sandbox.download) throw new Error("Sandbox adapter does not support artifact downloads.");
  for (const pattern of input.patterns) {
    if (!/^[A-Za-z0-9_./*?\[\]-]+$/.test(pattern) || pattern.startsWith("/") || pattern.includes("..")) {
      throw new Error(`Unsafe artifact pattern: ${pattern}`);
    }
  }

  const name = "artifacts.tar.gz";
  const remotePath = `/tmp/relunar-${input.runId}-artifacts.tar.gz`;
  const command = `tar -czf '${remotePath}' -- ${input.patterns.join(" ")}`;
  const archived = await input.sandbox.run(command, "repo", input.timeoutSeconds);
  if (archived.exitCode !== 0) {
    throw new Error(`Artifact collection failed: ${archived.stderr || archived.stdout || "tar failed"}`);
  }

  const artifactDir = join(runStoreDir(input.cwd), input.runId, "artifacts");
  await mkdir(artifactDir, { recursive: true });
  const localPath = join(artifactDir, name);
  await input.sandbox.download(remotePath, localPath);
  const [bytes, metadata] = await Promise.all([readFile(localPath), stat(localPath)]);
  return [{
    name,
    remotePath,
    localPath,
    sizeBytes: metadata.size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  }];
}
