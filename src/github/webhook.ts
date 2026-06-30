import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { CreateIssueJobInput } from "../domain/types";

const accountSchema = z.object({
  login: z.string(),
  type: z.string().default("User"),
});

const githubIdSchema = z.union([z.number(), z.string()]).transform(String);

const repositorySchema = z.object({
  id: githubIdSchema,
  name: z.string(),
  full_name: z.string(),
  private: z.boolean().default(false),
  default_branch: z.string().optional(),
  clone_url: z.string().optional(),
  html_url: z.string().optional(),
  owner: accountSchema,
}).passthrough();

const issueSchema = z.object({
  id: githubIdSchema,
  number: z.coerce.number(),
  title: z.string(),
  body: z.string().nullable().optional(),
  user: accountSchema.nullable().optional(),
  state: z.string().default("open"),
}).passthrough();

const installationSchema = z.object({
  id: githubIdSchema,
  account: accountSchema.nullable().optional(),
}).passthrough();

const issueOpenedPayloadSchema = z.object({
  action: z.string(),
  installation: installationSchema,
  repository: repositorySchema,
  issue: issueSchema,
}).passthrough();

export type ParsedIssueOpenedWebhook =
  | {
      supported: true;
      jobInput: CreateIssueJobInput;
    }
  | {
      supported: false;
      reason: "invalid_json";
      malformed: true;
    }
  | {
      supported: false;
      reason: string;
      diagnostics?: unknown;
      malformed?: false;
    };

export function verifyGitHubSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const actualBuffer = Buffer.from(signatureHeader, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function parseIssueOpenedWebhook(input: {
  eventName: string | null;
  deliveryId: string | null;
  rawBody: string;
}): ParsedIssueOpenedWebhook {
  if (input.eventName !== "issues") {
    return { supported: false, reason: "unsupported_event" };
  }

  if (!input.deliveryId) {
    return { supported: false, reason: "missing_delivery_id" };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(input.rawBody) as unknown;
  } catch {
    return { supported: false, reason: "invalid_json", malformed: true };
  }
  const parsed = issueOpenedPayloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      supported: false,
      reason: "unsupported_action_or_payload",
      diagnostics: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  const payload = parsed.data;
  if (payload.action !== "opened") {
    return { supported: false, reason: "unsupported_action" };
  }

  if (payload.repository.private) {
    return { supported: false, reason: "private_repository" };
  }

  const account = payload.installation.account ?? payload.repository.owner;
  const [owner, name] = splitRepositoryFullName(payload.repository.full_name);
  const htmlUrl = payload.repository.html_url ?? `https://github.com/${payload.repository.full_name}`;
  const cloneUrl = payload.repository.clone_url ?? `${htmlUrl}.git`;
  const issueAuthor = payload.issue.user?.login ?? "unknown";

  return {
    supported: true,
    jobInput: {
      githubDeliveryId: input.deliveryId,
      installation: {
        githubInstallationId: payload.installation.id,
        accountLogin: account.login,
        accountType: account.type,
      },
      repository: {
        githubRepositoryId: payload.repository.id,
        owner,
        name,
        fullName: payload.repository.full_name,
        defaultBranch: payload.repository.default_branch ?? "main",
        cloneUrl,
        htmlUrl,
        isPrivate: payload.repository.private,
      },
      issue: {
        githubIssueId: payload.issue.id,
        number: payload.issue.number,
        title: payload.issue.title,
        body: payload.issue.body ?? "",
        authorLogin: issueAuthor,
        state: payload.issue.state,
      },
    },
  };
}

function splitRepositoryFullName(fullName: string): [string, string] {
  const [owner, name] = fullName.split("/");
  if (!owner || !name) {
    throw new Error(`invalid repository full_name: ${fullName}`);
  }
  return [owner, name];
}
