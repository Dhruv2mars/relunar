import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const supportedSkills = ["codex", "cursor", "claude"] as const;
export type SupportedSkill = (typeof supportedSkills)[number];

export function isSupportedSkill(value: string): value is SupportedSkill {
  return (supportedSkills as readonly string[]).includes(value);
}

function skillsDir(): string {
  return fileURLToPath(new URL("../skills/", import.meta.url));
}

export async function getSkill(agent: SupportedSkill): Promise<string> {
  if (agent === "cursor") {
    return await readFile(join(skillsDir(), "cursor", "SKILL.md"), "utf8");
  }

  const codexSkill = await readFile(join(skillsDir(), "codex.md"), "utf8");
  if (agent === "codex") {
    return codexSkill;
  }

  return codexSkill.replace("# Relunar Agent Skill", `# Relunar Agent Skill for ${agent}`);
}

export async function installSkill(cwd: string, agent: SupportedSkill): Promise<string> {
  if (agent === "cursor") {
    const destDir = join(cwd, ".cursor", "skills", "relunar");
    await mkdir(destDir, { recursive: true });
    const skillSrc = join(skillsDir(), "cursor", "SKILL.md");
    const refSrc = join(skillsDir(), "cursor", "reference.md");
    await copyFile(skillSrc, join(destDir, "SKILL.md"));
    await copyFile(refSrc, join(destDir, "reference.md"));
    return join(destDir, "SKILL.md");
  }

  const path = join(cwd, ".relunar", "skills", `${agent}.md`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, await getSkill(agent), "utf8");
  return path;
}
