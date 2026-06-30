import { createHmac } from "node:crypto";
import { createLogger } from "../src/logger";

export function signBody(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function testLogger() {
  return createLogger("fatal");
}

export function issueOpenedPayload(overrides?: {
  action?: string;
  privateRepository?: boolean;
  body?: string | null;
}) {
  return {
    action: overrides?.action ?? "opened",
    installation: {
      id: 123,
      account: {
        login: "maintainer",
        type: "User",
      },
    },
    repository: {
      id: 456,
      name: "demo",
      full_name: "maintainer/demo",
      private: overrides?.privateRepository ?? false,
      default_branch: "main",
      clone_url: "https://github.com/maintainer/demo.git",
      html_url: "https://github.com/maintainer/demo",
      owner: {
        login: "maintainer",
        type: "User",
      },
    },
    issue: {
      id: 789,
      number: 42,
      title: "Fails on clean install",
      body: overrides?.body ?? "It fails.",
      user: {
        login: "reporter",
        type: "User",
      },
      state: "open",
    },
  };
}
