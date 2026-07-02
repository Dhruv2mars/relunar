import { describe, expect, test } from "bun:test";
import { GitHubClient } from "../src/github";

describe("GitHubClient", () => {
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

    const issues = await new GitHubClient("token", fetchImpl as typeof fetch).listIssues("owner/repo", "open");

    expect(issues.map((issue) => issue.number)).toEqual([...Array.from({ length: 99 }, (_, index) => index + 1), 101]);
    expect(requests).toHaveLength(2);
    expect(requests[0]).toContain("per_page=100&page=1");
    expect(requests[1]).toContain("per_page=100&page=2");
  });

  test("stops paginating after requested issue limit", async () => {
    const requests: string[] = [];
    const fetchImpl = async (url: string | URL | Request) => {
      const href = String(url);
      requests.push(href);
      return jsonResponse(Array.from({ length: 100 }, (_, index) => githubIssue(index + 1)));
    };

    const issues = await new GitHubClient("token", fetchImpl as typeof fetch).listIssues("owner/repo", "open", { limit: 3 });

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
