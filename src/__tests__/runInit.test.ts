import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { runInit } from "../wizard.js";

describe("runInit --yes", () => {
  it("writes hub files without calling ARC", async () => {
    const out = mkdtempSync(join(tmpdir(), "zenoh-fleet-out-"));
    const plan = await runInit(
      {
        yes: true,
        role: "hub",
        name: "lab",
        hubIp: "192.168.10.4",
        out,
        arc: false,
      },
      { token: undefined },
    );
    assert.equal(plan.input.role, "hub");
    const fleet = JSON.parse(readFileSync(join(out, "fleet.json"), "utf8"));
    assert.deepEqual(fleet.hubEndpoints, ["tcp/192.168.10.4:7447"]);
    assert.equal(existsSync(join(out, "zenohd.json5")), false);
    assert.equal(fleet.role, "hub");
    assert.match(readFileSync(join(out, "README.md"), "utf8"), /corebrum-zenoh-router\.service/);
  });

  it("stdout next-step uses the output directory path", async () => {
    const { renderNextSteps } = await import("../printDeploy.js");
    const text = renderNextSteps(
      {
        role: "hub",
        advertisedIp: "10.0.0.1",
        listenEndpoint: "tcp/0.0.0.0:7447",
        robotNamespace: "",
        integrations: {
          agenticros: true,
          corebrum: true,
          ros2ddsBridge: true,
          rmwZenoh: false,
        },
        identity: {
          name: "lab",
          isolation: "public",
          tcpPort: 7447,
          wsPort: 10000,
          hubEndpoints: ["tcp/10.0.0.1:7447"],
          wsEndpoint: "ws://10.0.0.1:10000",
        },
      },
      "./local-fleet",
    );
    assert.match(text, /corebrum zenoh fleet apply \/.*\/local-fleet/);
    assert.match(text, /corebrum-fleet-dir: \/.*\/local-fleet/);
  });
});
