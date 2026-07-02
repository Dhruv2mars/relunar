import type { Issue, RepoSlug } from "./types";

export class GitHubClient {
  constructor(private readonly token: string, private readonly fetchImpl: typeof fetch = fetch) {}

  async listIssues(repo: RepoSlug, state: "open" | "closed" | "all", options: { limit?: number } = {}): Promise<Issue[]> {
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
    const issue = await this.request<GitHubIssue>(`/repos/${repo}/issues/${issueNumber}`, { method: "GET" });
    return {
      number: issue.number,
      title: issue.title,
      body: issue.body ?? "",
      state: issue.state,
      url: issue.html_url,
    };
  }

  async createComment(repo: RepoSlug, issueNumber: number, body: string): Promise<string> {
    const response = await this.request<GitHubComment>(`/repos/${repo}/issues/${issueNumber}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    return response.html_url;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
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

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitHub API ${response.status} ${response.statusText}: ${body}`);
    }

    return (await response.json()) as T;
  }
}

type GitHubIssue = {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  html_url: string;
  pull_request?: unknown;
};

type GitHubComment = {
  html_url: string;
};
