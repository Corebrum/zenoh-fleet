import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { runPull } from "../pull.js";

test("pull writes member files from Corebrum Cloud record", async () => {
  const out = mkdtempSync(join(tmpdir(), "zenoh-fleet-pull-"));
  const fetchImpl = async (input: RequestInfo | URL) => {
    assert.match(String(input), /\/orgs\/current\/zenoh-fleet$/);
    return new Response(
      JSON.stringify({
        name: "lab",
        isolation: "private",
        tcpPort: 7447,
        wsPort: 10000,
        hubEndpoints: ["tcp/192.168.8.196:7447"],
        wsEndpoint: "ws://192.168.8.196:10000",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const dir = await runPull({ out }, { fetchImpl, token: "test-token" });
  assert.equal(dir, out);
  const { readFileSync, existsSync } = await import("node:fs");
  assert.ok(existsSync(join(out, "fleet.json")));
  assert.ok(existsSync(join(out, "rmw-zenoh-session.json5")));
  const fleet = JSON.parse(readFileSync(join(out, "fleet.json"), "utf8")) as {
    role: string;
    hubEndpoints: string[];
  };
  assert.equal(fleet.role, "member");
  assert.deepEqual(fleet.hubEndpoints, ["tcp/192.168.8.196:7447"]);
});
