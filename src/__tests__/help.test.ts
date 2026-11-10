import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { createProgram, readVersion } from "../cli.js";
import { PEER_ROLE_ERROR, ROUTING_HELP } from "../help.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const bin = join(root, "dist", "index.js");

test("routing copy names hub, member, peer, public LAN, and private mesh", () => {
  assert.match(ROUTING_HELP, /Hub \(router\)/);
  assert.match(ROUTING_HELP, /Member \(client\)/);
  assert.match(ROUTING_HELP, /Peer mesh/);
  assert.match(ROUTING_HELP, /rmw_zenohd/);
  assert.match(ROUTING_HELP, /cortex daemon/);
  assert.match(ROUTING_HELP, /Public LAN/);
  assert.match(ROUTING_HELP, /Private mesh/);
  assert.match(PEER_ROLE_ERROR, /peer mesh is not generated yet/i);
});

test("root --help prints routing and version flag -V", () => {
  const result = spawnSync(process.execPath, [bin, "--help"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage: zenoh-fleet/);
  assert.match(result.stdout, /Hub \(router\)/);
  assert.match(result.stdout, /Peer mesh/);
  assert.match(result.stdout, /-V, --version/);
  assert.doesNotMatch(result.stdout, /-v, --version/);
});

test("init --help documents role, join, hub-ip, and name", () => {
  const result = spawnSync(process.execPath, [bin, "init", "--help"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--role/);
  assert.match(result.stdout, /--join/);
  assert.match(result.stdout, /--hub-ip/);
  assert.match(result.stdout, /--name/);
  assert.match(result.stdout, /Peer mesh/);
});

test("--version prints package version", () => {
  const result = spawnSync(process.execPath, [bin, "--version"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/);
  assert.equal(result.stdout.trim(), readVersion());
});

test("createProgram exposes --version as -V", () => {
  const program = createProgram();
  const help = program.helpInformation();
  assert.match(help, /-V, --version/);
  assert.doesNotMatch(help, /-v, --version/);
});
