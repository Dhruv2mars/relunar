import { link, open, readFile, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

/** Atomically publishes a complete owner record without exposing a partial lock file. */
export async function tryCreateOwnedLock(path: string): Promise<boolean> {
  const temp = `${path}.owner-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temp, `${process.pid} ${new Date().toISOString()}\n`, { encoding: "utf8", flag: "wx" });
    try {
      await link(temp, path);
      return true;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") return false;
      throw error;
    }
  } finally {
    await unlink(temp).catch(() => undefined);
  }
}

/** A lock is reclaimable only when its recorded owner no longer exists. */
export async function lockOwnerIsDead(path: string): Promise<boolean> {
  try {
    const [pidText, timestamp] = (await readFile(path, "utf8")).trim().split(/\s+/, 2);
    const pid = Number(pidText);
    const recordedAt = Date.parse(timestamp ?? "");
    if (!Number.isInteger(pid) || pid <= 0 || !Number.isFinite(recordedAt)) return true;
    try {
      process.kill(pid, 0);
      return false;
    } catch (error) {
      return error instanceof Error && "code" in error && error.code === "ESRCH";
    }
  } catch (error) {
    // A lock that vanished normally was released, not proven stale. Returning
    // false prevents this reclaimer from deleting a successor created between
    // this read and its unlink; the caller simply retries acquisition.
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

/** Serializes stale-owner checks so an observer can never remove a successor's live lock. */
export async function reclaimDeadLock(path: string): Promise<boolean> {
  const reclaimPath = `${path}.reclaim`;
  let handle;
  try {
    handle = await open(reclaimPath, "wx");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") return false;
    throw error;
  }
  try {
    if (!(await lockOwnerIsDead(path))) return false;
    await unlink(path).catch((error: unknown) => {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    });
    return true;
  } finally {
    await handle.close();
    await unlink(reclaimPath).catch(() => undefined);
  }
}
