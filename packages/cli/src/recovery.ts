import { listRuns } from "./runs";
import type { SandboxProvider } from "./types";

export type SandboxInspection = {
  id: string;
  runId: string | null;
  state: string;
  orphaned: boolean;
};

export async function inspectSandboxes(cwd: string, provider: SandboxProvider): Promise<SandboxInspection[]> {
  if (!provider.listRelunarSandboxes) throw new Error("Sandbox provider does not support listing Relunar sandboxes.");
  const [sandboxes, runs] = await Promise.all([provider.listRelunarSandboxes(), listRuns(cwd)]);
  const referenced = new Set(
    runs
      .filter((run) => run.status === "environment_ready" || run.cleanup?.status === "pending" || run.cleanup?.status === "failed")
      .map((run) => run.sandbox.id)
      .filter((id): id is string => Boolean(id)),
  );
  return sandboxes
    .map((sandbox) => ({ ...sandbox, orphaned: !referenced.has(sandbox.id) }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export async function gcOrphanSandboxes(
  cwd: string,
  provider: SandboxProvider,
  options: { dryRun: boolean },
): Promise<{ wouldDelete: string[]; deleted: string[] }> {
  const orphans = (await inspectSandboxes(cwd, provider)).filter((sandbox) => sandbox.orphaned).map((sandbox) => sandbox.id);
  if (options.dryRun) return { wouldDelete: orphans, deleted: [] };
  if (!provider.deleteSandbox) throw new Error("Sandbox provider does not support deleting orphaned sandboxes.");
  const deleted: string[] = [];
  for (const id of orphans) {
    await provider.deleteSandbox(id);
    deleted.push(id);
  }
  return { wouldDelete: orphans, deleted };
}
