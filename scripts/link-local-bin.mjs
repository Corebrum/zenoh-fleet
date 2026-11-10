#!/usr/bin/env node
/**
 * Link this package's CLI into node_modules/.bin so `npx @corebrum/zenoh-fleet`
 * works from the source checkout. Skip when installed as a dependency (npm already
 * creates the bin).
 */
import { chmodSync, existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
if (root.split(sep).includes("node_modules")) {
  process.exit(0);
}

const dest = join(root, "dist", "index.js");
if (!existsSync(dest)) {
  process.exit(0);
}

const binDir = join(root, "node_modules", ".bin");
mkdirSync(binDir, { recursive: true });
const link = join(binDir, "zenoh-fleet");
try {
  rmSync(link);
} catch {
  // no existing link
}
symlinkSync(relative(binDir, dest), link);
chmodSync(dest, 0o755);
