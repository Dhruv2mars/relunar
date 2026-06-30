import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const jobStateEnum = pgEnum("job_state", ["queued", "running", "completed", "failed"]);
export const jobResultEnum = pgEnum("job_result", [
  "baseline_passed",
  "baseline_failed",
  "blocked",
  "run_failed",
]);
export const errorCategoryEnum = pgEnum("error_category", [
  "webhook_verification_error",
  "queue_error",
  "github_auth_error",
  "github_api_error",
  "sandbox_create_error",
  "clone_error",
  "package_detection_error",
  "command_timeout",
  "command_failed",
  "report_post_error",
]);
export const packageManagerEnum = pgEnum("package_manager", ["bun", "pnpm", "yarn", "npm"]);
export const commandPhaseEnum = pgEnum("command_phase", ["clone", "inspect", "install", "build", "test"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const installations = pgTable("installations", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubInstallationId: text("github_installation_id").notNull().unique(),
  accountLogin: text("account_login").notNull(),
  accountType: text("account_type").notNull(),
  ...timestamps,
});

export const repositories = pgTable("repositories", {
  id: uuid("id").primaryKey().defaultRandom(),
  installationId: uuid("installation_id")
    .notNull()
    .references(() => installations.id, { onDelete: "cascade" }),
  githubRepositoryId: text("github_repository_id").notNull().unique(),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull(),
  defaultBranch: text("default_branch").notNull(),
  cloneUrl: text("clone_url").notNull(),
  htmlUrl: text("html_url").notNull(),
  isPrivate: boolean("is_private").notNull().default(false),
  ...timestamps,
});

export const issues = pgTable("issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  repositoryId: uuid("repository_id")
    .notNull()
    .references(() => repositories.id, { onDelete: "cascade" }),
  githubIssueId: text("github_issue_id").notNull().unique(),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  authorLogin: text("author_login").notNull(),
  state: text("state").notNull(),
  ...timestamps,
});

export const reproJobs = pgTable("repro_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueId: uuid("issue_id")
    .notNull()
    .references(() => issues.id, { onDelete: "cascade" }),
  repositoryId: uuid("repository_id")
    .notNull()
    .references(() => repositories.id, { onDelete: "cascade" }),
  installationId: uuid("installation_id")
    .notNull()
    .references(() => installations.id, { onDelete: "cascade" }),
  state: jobStateEnum("state").notNull().default("queued"),
  result: jobResultEnum("result"),
  errorCategory: errorCategoryEnum("error_category"),
  errorMessage: text("error_message"),
  queueJobId: text("queue_job_id"),
  githubDeliveryId: text("github_delivery_id").notNull(),
  sandboxId: text("sandbox_id"),
  sandboxTarget: text("sandbox_target"),
  commitSha: text("commit_sha"),
  packageManager: packageManagerEnum("package_manager"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  ...timestamps,
});

export const commandRuns = pgTable("command_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => reproJobs.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  phase: commandPhaseEnum("phase").notNull(),
  command: text("command").notNull(),
  cwd: text("cwd").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
  durationMs: integer("duration_ms").notNull(),
  exitCode: integer("exit_code"),
  timedOut: boolean("timed_out").notNull().default(false),
  stdoutExcerpt: text("stdout_excerpt").notNull(),
  stderrExcerpt: text("stderr_excerpt").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const issueComments = pgTable("issue_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  repositoryId: uuid("repository_id")
    .notNull()
    .references(() => repositories.id, { onDelete: "cascade" }),
  issueId: uuid("issue_id")
    .notNull()
    .references(() => issues.id, { onDelete: "cascade" }),
  jobId: uuid("job_id")
    .notNull()
    .references(() => reproJobs.id, { onDelete: "cascade" }),
  githubCommentId: text("github_comment_id").notNull(),
  bodyHash: text("body_hash").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
