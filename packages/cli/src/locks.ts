import { readFile } from "node:fs/promises";

/** A lock is reclaimable only when its recorded owner no longer exists. */
export async function lockOwnerIsDead(path: string): Promise<boolean> {
  try {
    const [pidText, timestamp] = (await readFile(path, "utf8")).trim().split(/\s+/, 2);
    const pid = Number(pidText);
    const recordedAt = Date.parse(timestamp ?? "");
    if (!Number.isInteger(pid) || pid <= 0 || !Number.isFinite(recordedAt)) return false;
    try {
      process.kill(pid, 0);
      return false;
    } catch (error) {
      return error instanceof Error && "code" in error && error.code === "ESRCH";
    }
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
  }
}
