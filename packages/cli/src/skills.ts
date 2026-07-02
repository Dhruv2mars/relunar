import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

export const supportedSkills = ["codex", "cursor", "claude"] as const;
export type SupportedSkill = (typeof supportedSkills)[number];

export function isSupportedSkill(value: string): value is SupportedSkill {
  return (supportedSkills as readonly string[]).includes(value);
}

export async function getSkill(agent: SupportedSkill): Promise<string> {
  const codexSkill = await readFile(new URL("../skills/codex.md", import.meta.url), "utf8");
  if (agent === "codex") {
    return codexSkill;
  }

  return codexSkill.replace("# Relunar Agent Skill", `# Relunar Agent Skill for ${agent}`);
}

export async function installSkill(cwd: string, agent: SupportedSkill): Promise<string> {
  const path = join(cwd, ".relunar", "skills", `${agent}.md`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, await getSkill(agent), "utf8");
  return path;
}
