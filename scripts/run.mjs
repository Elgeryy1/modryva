import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(rootDir, "..");
const cmdShell = process.platform === "win32" ? "cmd.exe" : undefined;

const escapeCmdArg = (arg) => {
  if (!/[ \t"]/u.test(arg)) {
    return arg;
  }

  return `"${arg.replaceAll('"', '\\"')}"`;
};

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const needsCmd = process.platform === "win32" && command.endsWith(".cmd");
    const finalCommand = needsCmd && cmdShell ? cmdShell : command;
    const finalArgs =
      needsCmd && cmdShell
        ? ["/d", "/s", "/c", [command, ...args.map(escapeCmdArg)].join(" ")]
        : args;

    const child = spawn(finalCommand, finalArgs, {
      cwd: repoRoot,
      stdio: "inherit",
      shell: false,
      ...options,
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} failed${signal ? ` with signal ${signal}` : ` with code ${code}`}`,
        ),
      );
    });
  });

const runNode = (args, options = {}) => run(process.execPath, args, options);

const runTypecheck = (workspacePath) =>
  runNode([
    "node_modules/typescript/bin/tsc",
    "-p",
    `${workspacePath}/tsconfig.json`,
    "--noEmit",
  ]);

const runTsx = (entrypoint, extraArgs = []) =>
  runNode([
    "node_modules/tsx/dist/cli.mjs",
    ...extraArgs,
    "--tsconfig",
    "tsconfig.base.json",
    entrypoint,
  ]);

const typecheckWorkspaces = [
  "packages/shared",
  "packages/domain",
  "packages/telegram",
  "packages/auth",
  "packages/data",
  "modules/core",
  "modules/security",
  "modules/guardian",
  "modules/community",
  "modules/support",
  "modules/automation",
  "modules/files",
  "modules/games",
  "modules/ai",
  "modules/payments",
  "apps/bot",
  "apps/api",
  "apps/worker",
  "apps/web",
];

const runAllTypechecks = async () => {
  for (const workspace of typecheckWorkspaces) {
    await runTypecheck(workspace);
  }
};

const main = async () => {
  const task = process.argv[2];

  switch (task) {
    case "dev":
      await Promise.all([
        runTsx("apps/bot/src/index.ts", ["watch"]),
        runTsx("apps/api/src/index.ts", ["watch"]),
        runTsx("apps/worker/src/index.ts", ["watch"]),
        runNode(
          [
            path.join(repoRoot, "node_modules/next/dist/bin/next"),
            "dev",
            "-p",
            "3003",
          ],
          {
            cwd: path.join(repoRoot, "apps/web"),
          },
        ),
      ]);
      break;
    case "typecheck":
      await runAllTypechecks();
      break;
    case "build":
      await runAllTypechecks();
      await runNode(
        [path.join(repoRoot, "node_modules/next/dist/bin/next"), "build"],
        {
          cwd: path.join(repoRoot, "apps/web"),
        },
      );
      break;
    case "db:generate":
      await runNode([
        "node_modules/prisma/build/index.js",
        "generate",
        "--schema",
        "packages/data/prisma/schema.prisma",
      ]);
      break;
    case "db:push":
      await runNode([
        "node_modules/prisma/build/index.js",
        "db",
        "push",
        "--schema",
        "packages/data/prisma/schema.prisma",
      ]);
      break;
    case "db:migrate":
      await runNode([
        "node_modules/prisma/build/index.js",
        "migrate",
        "dev",
        "--schema",
        "packages/data/prisma/schema.prisma",
      ]);
      break;
    case "db:deploy":
      await runNode([
        "node_modules/prisma/build/index.js",
        "migrate",
        "deploy",
        "--schema",
        "packages/data/prisma/schema.prisma",
      ]);
      break;
    default:
      throw new Error(`Unknown task: ${task}`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
