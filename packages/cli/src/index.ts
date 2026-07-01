import { runCli } from "./cli";

const exitCode = await runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  io: {
    stdout: (message) => process.stdout.write(message),
    stderr: (message) => process.stderr.write(message),
  },
});

process.exitCode = exitCode;
