import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { generateFiles } from "../generate.js";
import { PEER_ROLE_ERROR } from "../help.js";
import {
  parseRole,
  resolveInitPlan,
  type WizardContext,
} from "../wizard.js";
import type { FleetIdentity } from "../types.js";

const emptyCtx = (): WizardContext => ({
  localFleet: null,
  arcFleet: null,
  lanIp: "10.0.0.5",
});

describe("wizard plan", () => {
  it("rejects --role peer instead of mapping it to hub", () => {
    assert.equal(parseRole("hub"), "hub");
    assert.equal(parseRole("member"), "member");
    assert.throws(() => parseRole("peer"), { message: PEER_ROLE_ERROR });
  });

  it("new fleet defaults to hub on a public LAN with detected IP", async () => {
    const plan = await resolveInitPlan({ yes: true }, emptyCtx(), false);
    assert.equal(plan.input.role, "hub");
    assert.equal(plan.input.identity.name, "local-fleet");
    assert.equal(plan.input.identity.isolation, "public");
    assert.deepEqual(plan.input.identity.hubEndpoints, ["tcp/10.0.0.5:7447"]);
    assert.equal(plan.input.identity.wsEndpoint, "ws://10.0.0.5:10000");
    assert.equal(plan.input.listenEndpoint, "tcp/0.0.0.0:7447");
    assert.equal(plan.input.integrations.agenticros, false);
    assert.equal(plan.input.integrations.rmwZenoh, true);
    assert.equal(plan.input.integrations.ros2ddsBridge, false);
    const files = generateFiles(plan.input);
    assert.equal(files["zenohd.json5"], undefined);
    assert.match(files["README.md"], /corebrum-zenoh-router\.service/);
  });

  it("existing fleet.json defaults role to member and joins hub endpoints", async () => {
    const identity: FleetIdentity = {
      name: "warehouse-01",
      isolation: "private",
      tcpPort: 7447,
      wsPort: 10000,
      hubEndpoints: ["tcp/192.168.0.241:7447"],
      wsEndpoint: "ws://192.168.0.241:10000",
    };
    const plan = await resolveInitPlan(
      { yes: true },
      { localFleet: identity, arcFleet: null, lanIp: "10.0.0.8" },
      false,
    );
    assert.equal(plan.input.role, "member");
    assert.equal(plan.input.identity.name, "warehouse-01");
    assert.equal(plan.input.identity.isolation, "private");
    assert.deepEqual(plan.input.identity.hubEndpoints, ["tcp/192.168.0.241:7447"]);
    const files = generateFiles(plan.input);
    assert.equal(files["zenohd.json5"], undefined);
    assert.equal(files["zenoh-bridge-ros2dds-robot.json5"], undefined);
    assert.match(files["rmw-zenoh-session.json5"], /tcp\/192\.168\.0\.241:7447/);
    assert.match(files["README.md"], /cortex daemon --zenoh-router tcp:\/\/192\.168\.0\.241:7447/);
  });

  it("joins from a fleet.json path via --join", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zenoh-fleet-"));
    const path = join(dir, "fleet.json");
    writeFileSync(
      path,
      JSON.stringify({
        name: "lab",
        isolation: "public",
        tcpPort: 7447,
        wsPort: 10000,
        hubEndpoints: ["tcp/192.168.1.9:7447"],
        wsEndpoint: "ws://192.168.1.9:10000",
      }),
    );
    const { loadFleetJson } = await import("../detect.js");
    const localFleet = loadFleetJson(path);
    const plan = await resolveInitPlan(
      { yes: true, join: path, role: "member" },
      { localFleet, arcFleet: null, lanIp: null },
      false,
    );
    assert.equal(plan.input.role, "member");
    assert.deepEqual(plan.input.identity.hubEndpoints, ["tcp/192.168.1.9:7447"]);
  });

  it("ARC pull fills defaults so a member can enter-through", async () => {
    const plan = await resolveInitPlan(
      { yes: true },
      {
        localFleet: null,
        arcFleet: {
          name: "org-fleet",
          isolation: "private",
          tcpPort: 7447,
          wsPort: 10000,
          hubEndpoints: ["tcp/10.1.2.3:7447"],
          wsEndpoint: "ws://10.1.2.3:10000",
        },
        lanIp: "10.1.2.9",
        token: "tok",
      },
      false,
    );
    assert.equal(plan.input.role, "member");
    assert.equal(plan.input.identity.name, "org-fleet");
    assert.deepEqual(plan.input.identity.hubEndpoints, ["tcp/10.1.2.3:7447"]);
    assert.equal(plan.useArc, true);
  });

  it("does not advertise 127.0.0.1 as the hub connect address", async () => {
    const plan = await resolveInitPlan(
      { yes: true, role: "hub", hubIp: "127.0.0.1" },
      { localFleet: null, arcFleet: null, lanIp: "127.0.0.1" },
      false,
    );
    assert.equal(plan.input.advertisedIp, null);
    assert.deepEqual(plan.input.identity.hubEndpoints, []);
    assert.ok(plan.warnings.length > 0);
  });

  it("skips ARC when --no-arc even if a token exists", async () => {
    const plan = await resolveInitPlan(
      { yes: true, role: "hub", arc: false },
      { localFleet: null, arcFleet: null, lanIp: "10.0.0.1", token: "tok" },
      false,
    );
    assert.equal(plan.useArc, false);
  });
});
