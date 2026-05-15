#!/usr/bin/env node
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function listSkills() {
  return readdirSync(PACKAGE_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .filter((d) => existsSync(join(PACKAGE_ROOT, d.name, "SKILL.md")))
    .map((d) => d.name)
    .sort();
}

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

function parseTarget(args) {
  const i = args.indexOf("--path");
  if (i !== -1) {
    if (!args[i + 1]) {
      console.error("error: --path requires a directory argument");
      process.exit(2);
    }
    return resolve(args[i + 1]);
  }
  if (args.includes("--project")) {
    return resolve(process.cwd(), ".cursor", "skills");
  }
  return join(homedir(), ".cursor", "skills");
}

function cmdList() {
  const skills = listSkills();
  console.log(`Bundled skills (${skills.length}):`);
  for (const s of skills) console.log(`  - ${s}`);
}

function cmdInstall(args) {
  const target = parseTarget(args);
  const force = args.includes("--force");
  const skills = listSkills();

  mkdirSync(target, { recursive: true });
  console.log(`Installing ${skills.length} skill(s) -> ${target}`);

  for (const skill of skills) {
    const dest = join(target, skill);
    if (existsSync(dest)) {
      if (!force) {
        console.log(`  - ${skill} (skipped, already exists; pass --force to overwrite)`);
        continue;
      }
      rmSync(dest, { recursive: true, force: true });
    }
    copyDir(join(PACKAGE_ROOT, skill), dest);
    console.log(`  + ${skill}`);
  }
}

function usage(code = 0) {
  console.log(`Usage:
  sobear list
  sobear install [--project] [--path <dir>] [--force]

Default install target: ~/.cursor/skills/
  --project              install to <cwd>/.cursor/skills/
  --path <dir>           install to <dir>
  --force                overwrite existing skill directories`);
  process.exit(code);
}

const [, , cmd, ...rest] = process.argv;
switch (cmd) {
  case "list":
    cmdList();
    break;
  case "install":
    cmdInstall(rest);
    break;
  case undefined:
  case "-h":
  case "--help":
    usage(0);
    break;
  default:
    console.error(`error: unknown command '${cmd}'`);
    usage(1);
}
