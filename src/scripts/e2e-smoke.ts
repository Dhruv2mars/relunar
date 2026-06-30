import { z } from "zod";

const envSchema = z.object({
  E2E_GITHUB_TOKEN: z.string().min(1),
  E2E_REPOSITORY: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
  E2E_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(600),
  E2E_POLL_SECONDS: z.coerce.number().int().positive().default(10),
});

const config = envSchema.parse(process.env);
const [owner, repo] = config.E2E_REPOSITORY.split("/") as [string, string];
const apiBase = "https://api.github.com";

const issue = await githubRequest<{
  number: number;
  html_url: string;
}>(
  `/repos/${owner}/${repo}/issues`,
  {
    method: "POST",
    body: JSON.stringify({
      title: `Relunar smoke ${new Date().toISOString()}`,
      body: [
        "Relunar milestone 1 smoke issue.",
        "",
        "Expected behavior:",
        "Relunar posts one baseline report comment from a clean Daytona sandbox.",
        "",
        "This issue was created by `bun run smoke:e2e`.",
      ].join("\n"),
    }),
  },
);

console.log(`created issue ${issue.html_url}`);

const deadline = Date.now() + config.E2E_TIMEOUT_SECONDS * 1000;
while (Date.now() < deadline) {
  const comments = await githubRequest<
    Array<{
      id: number;
      body: string | null;
      html_url: string;
    }>
  >(`/repos/${owner}/${repo}/issues/${issue.number}/comments`, { method: "GET" });

  const report = comments.find((comment) => comment.body?.includes("## Relunar baseline report"));
  if (report) {
    console.log(`found Relunar baseline report ${report.html_url}`);
    console.log(report.body);
    process.exit(0);
  }

  console.log(`waiting for Relunar report on issue ${issue.number}`);
  await sleep(config.E2E_POLL_SECONDS * 1000);
}

throw new Error(`timed out waiting for Relunar baseline report on ${issue.html_url}`);

async function githubRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${config.E2E_GITHUB_TOKEN}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${init.method} ${path} failed with ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
