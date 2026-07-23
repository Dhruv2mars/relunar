import { describe, expect, test } from "bun:test";
import { GitHubClient } from "../src/github";

describe("GitHubClient", () => {
  test("retries transient failures then succeeds", async () => {
    let attempts = 0;
    const fetchImpl = async () => {
      attempts += 1;
      if (attempts < 3)
        return new Response("temporary", {
          status: 503,
          statusText: "Unavailable",
        });
      return new Response(JSON.stringify(githubIssue(7)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const client = new GitHubClient(
      "token",
      fetchImpl as unknown as typeof fetch,
      { sleep: async () => undefined },
    );
    expect((await client.getIssue("owner/repo", 7)).number).toBe(7);
    expect(attempts).toBe(3);
  });

  test("does not retry permanent client errors", async () => {
    let attempts = 0;
    const fetchImpl = async () => {
      attempts += 1;
      return new Response("bad", { status: 404, statusText: "Not Found" });
    };
    const client = new GitHubClient(
      "token",
      fetchImpl as unknown as typeof fetch,
      { sleep: async () => undefined },
    );
    await expect(client.getIssue("owner/repo", 7)).rejects.toThrow(
      "GitHub API 404",
    );
    expect(attempts).toBe(1);
  });
  test("fetches maintainer issue context including labels, comments, and attachments", async () => {
    const fetchImpl = async (url: string | URL | Request) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith("/comments")) {
        return jsonResponse([
          {
            user: { login: "maintainer" },
            body: "Trace: https://example.com/trace.log",
            created_at: "2026-01-02T00:00:00Z",
            html_url: "https://github.com/o/r/issues/1#issuecomment-1",
          },
        ]);
      }
      return jsonResponse({
        ...githubIssue(1),
        labels: [{ name: "bug" }],
        body: "Repro https://example.com/repro.ts",
      });
    };
    const context = await new GitHubClient(
      "token",
      fetchImpl as typeof fetch,
    ).getIssueContext("owner/repo", 1);
    expect(context.labels).toEqual(["bug"]);
    expect(context.comments?.[0]).toMatchObject({
      author: "maintainer",
      body: "Trace: https://example.com/trace.log",
    });
    expect(context.attachments).toEqual([
      "https://example.com/repro.ts",
      "https://example.com/trace.log",
    ]);
  });
  test("ignores local service URLs and trims Markdown punctuation from attachments", async () => {
    const fetchImpl = async (url: string | URL | Request) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith("/comments")) return jsonResponse([]);
      return jsonResponse({
        ...githubIssue(1),
        body: "Use `http://127.0.0.1:4317/health`. Download https://example.com/repro.ts`.",
      });
    };
    const context = await new GitHubClient(
      "token",
      fetchImpl as typeof fetch,
    ).getIssueContext("owner/repo", 1);
    expect(context.attachments).toEqual(["https://example.com/repro.ts"]);
  });
  test("paginates issues and filters pull requests", async () => {
    const requests: string[] = [];
    const fetchImpl = async (url: string | URL | Request) => {
      const href = String(url);
      requests.push(href);
      const page = new URL(href).searchParams.get("page");

      if (page === "1") {
        return jsonResponse([
          ...Array.from({ length: 99 }, (_, index) => githubIssue(index + 1)),
          { ...githubIssue(100), pull_request: {} },
        ]);
      }

      if (page === "2") {
        return jsonResponse([githubIssue(101)]);
      }

      throw new Error(`unexpected url: ${href}`);
    };

    const issues = await new GitHubClient(
      "token",
      fetchImpl as typeof fetch,
    ).listIssues("owner/repo", "open");

    expect(issues.map((issue) => issue.number)).toEqual([
      ...Array.from({ length: 99 }, (_, index) => index + 1),
      101,
    ]);
    expect(requests).toHaveLength(2);
    expect(requests[0]).toContain("per_page=100&page=1");
    expect(requests[1]).toContain("per_page=100&page=2");
  });

  test("stops paginating after requested issue limit", async () => {
    const requests: string[] = [];
    const fetchImpl = async (url: string | URL | Request) => {
      const href = String(url);
      requests.push(href);
      return jsonResponse(
        Array.from({ length: 100 }, (_, index) => githubIssue(index + 1)),
      );
    };

    const issues = await new GitHubClient(
      "token",
      fetchImpl as typeof fetch,
    ).listIssues("owner/repo", "open", { limit: 3 });

    expect(issues.map((issue) => issue.number)).toEqual([1, 2, 3]);
    expect(requests).toHaveLength(1);
  });
});

function githubIssue(number: number) {
  return {
    number,
    title: `Issue ${number}`,
    body: `Body ${number}`,
    state: "open",
    html_url: `https://github.com/owner/repo/issues/${number}`,
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}
