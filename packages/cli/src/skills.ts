import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

export const supportedSkills = ["codex", "cursor", "claude"] as const;
export type SupportedSkill = (typeof supportedSkills)[number];

export function isSupportedSkill(value: string): value is SupportedSkill {
  return (supportedSkills as readonly string[]).includes(value);
}

export async function getSkill(agent: SupportedSkill): Promise<string> {
  if (agent === "codex") {
    return codexSkill;
  }

  const codex = await getSkill("codex");
  return codex.replace("# Relunar Agent Skill", `# Relunar Agent Skill for ${agent}`);
}

export async function installSkill(cwd: string, agent: SupportedSkill): Promise<string> {
  const path = join(cwd, ".relunar", "skills", `${agent}.md`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, await getSkill(agent), "utf8");
  return path;
}

const codexSkill = `# Relunar Agent Skill

Use Relunar when a maintainer asks you to reproduce GitHub issues in a repository.

## Rules

- Start with \`relunar doctor\`.
- Use JSON output when planning: \`relunar issues list --state open --json\`.
- Prefer one issue first: \`relunar repro 123\`.
- Do not post GitHub comments unless the user asks, or the command includes \`--comment\`.
- For batch work, keep limits small first: \`relunar repro --all-open --limit 3\`.
- Treat Relunar as the deterministic harness. You decide issue priority, extra context needs, and whether the report is useful.

## Commands

\`\`\`sh
relunar init
relunar doctor
relunar auth github
relunar auth daytona
relunar repo link owner/repo
relunar issues list --state open --json
relunar repro 123
relunar repro 123 --comment
relunar repro --all-open --limit 5
relunar runs list
relunar runs show <run-id>
\`\`\`
`;
