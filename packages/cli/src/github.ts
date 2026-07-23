import type { Issue, RepoSlug } from "./types";

export class GitHubClient {
  constructor(
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly retry: {
      maxAttempts?: number;
      sleep?: (milliseconds: number) => Promise<void>;
    } = {},
  ) {}

  async listIssues(
    repo: RepoSlug,
    state: "open" | "closed" | "all",
    options: { limit?: number } = {},
  ): Promise<Issue[]> {
    const issues: Issue[] = [];
    let page = 1;

    while (true) {
      const data = await this.request<GitHubIssue[]>(
        `/repos/${repo}/issues?state=${encodeURIComponent(state)}&per_page=100&page=${page}`,
        { method: "GET" },
      );

      for (const issue of data) {
        if ("pull_request" in issue) {
          continue;
        }

        issues.push({
          number: issue.number,
          title: issue.title,
          body: issue.body ?? "",
          state: issue.state,
          url: issue.html_url,
        });

        if (options.limit && issues.length >= options.limit) {
          return issues;
        }
      }

      if (data.length < 100) {
        return issues;
      }

      page += 1;
    }
  }

  async getIssue(repo: RepoSlug, issueNumber: number): Promise<Issue> {
    const issue = await this.request<GitHubIssue>(
      `/repos/${repo}/issues/${issueNumber}`,
      { method: "GET" },
    );
    return {
      number: issue.number,
      title: issue.title,
      body: issue.body ?? "",
      state: issue.state,
      url: issue.html_url,
    };
  }

  async getIssueContext(repo: RepoSlug, issueNumber: number): Promise<Issue> {
    const [issue, comments] = await Promise.all([
      this.request<GitHubIssue>(`/repos/${repo}/issues/${issueNumber}`, {
        method: "GET",
      }),
      this.request<GitHubIssueComment[]>(
        `/repos/${repo}/issues/${issueNumber}/comments?per_page=100`,
        { method: "GET" },
      ),
    ]);
    const normalizedComments = comments.map((comment) => ({
      author: comment.user?.login ?? "unknown",
      body: comment.body ?? "",
      createdAt: comment.created_at,
      url: comment.html_url,
    }));
    return {
      number: issue.number,
      title: issue.title,
      body: issue.body ?? "",
      state: issue.state,
      url: issue.html_url,
      labels: (issue.labels ?? [])
        .map((label) => (typeof label === "string" ? label : label.name))
        .filter((name): name is string => Boolean(name)),
      comments: normalizedComments,
      attachments: extractUrls([
        issue.body ?? "",
        ...normalizedComments.map((comment) => comment.body),
      ]),
    };
  }

  async createComment(
    repo: RepoSlug,
    issueNumber: number,
    body: string,
  ): Promise<string> {
    const response = await this.request<GitHubComment>(
      `/repos/${repo}/issues/${issueNumber}/comments`,
      {
        method: "POST",
        body: JSON.stringify({ body }),
      },
    );
    return response.html_url;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const maxAttempts = this.retry.maxAttempts ?? 3;
    const sleep =
      this.retry.sleep ??
      ((milliseconds: number) =>
        new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await this.fetchImpl(`https://api.github.com${path}`, {
          ...init,
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            ...init.headers,
          },
        });

        if (response.ok) return (await response.json()) as T;
        const body = await response.text();
        if (!isTransient(response.status) || attempt === maxAttempts) {
          throw new Error(
            `GitHub API ${response.status} ${response.statusText}: ${body}`,
          );
        }
        const retryAfter = Number.parseInt(
          response.headers.get("Retry-After") ?? "",
          10,
        );
        await sleep(
          Number.isFinite(retryAfter)
            ? retryAfter * 1000
            : 250 * 2 ** (attempt - 1),
        );
      } catch (error) {
        if (isGithubResponseError(error) || attempt === maxAttempts)
          throw error;
        await sleep(250 * 2 ** (attempt - 1));
      }
    }
    throw new Error("GitHub request exhausted retries.");
  }
}

function isTransient(status: number): boolean {
  return status === 429 || status >= 500;
}

function isGithubResponseError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("GitHub API ");
}

type GitHubIssue = {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  html_url: string;
  pull_request?: unknown;
  labels?: Array<string | { name: string | null }>;
};

type GitHubIssueComment = {
  user: { login: string } | null;
  body: string | null;
  created_at: string;
  html_url: string;
};

type GitHubComment = {
  html_url: string;
};

function extractUrls(values: string[]): string[] {
  const urls = values
    .flatMap((value) => value.match(/https?:\/\/[^\s<>)\]]+/g) ?? [])
    .map((value) => value.replace(/[.,;:!?`'"}]+$/g, ""))
    .filter((value) => {
      try {
        const hostname = new URL(value).hostname;
        return (
          hostname !== "localhost" &&
          hostname !== "127.0.0.1" &&
          hostname !== "::1"
        );
      } catch {
        return false;
      }
    });
  return [...new Set(urls)];
}
