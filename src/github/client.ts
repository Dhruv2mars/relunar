import { App } from "@octokit/app";

export interface GitHubIssueCommenter {
  createIssueComment(input: {
    installationId: string;
    owner: string;
    repo: string;
    issueNumber: number;
    body: string;
  }): Promise<{ id: string }>;
}

export class GitHubAppClient implements GitHubIssueCommenter {
  private readonly app: App;

  constructor(input: { appId: number; privateKey: string }) {
    this.app = new App({
      appId: input.appId,
      privateKey: input.privateKey.replaceAll("\\n", "\n"),
    });
  }

  async createIssueComment(input: {
    installationId: string;
    owner: string;
    repo: string;
    issueNumber: number;
    body: string;
  }): Promise<{ id: string }> {
    const octokit = await this.app.getInstallationOctokit(Number(input.installationId));
    const response = await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
      owner: input.owner,
      repo: input.repo,
      issue_number: input.issueNumber,
      body: input.body,
    });

    return { id: String(response.data.id) };
  }
}
