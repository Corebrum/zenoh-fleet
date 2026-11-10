import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateFiles } from "../generate.js";
import type { GenerateInput } from "../types.js";

function hubPublic(): GenerateInput {
  return {
    role: "hub",
    advertisedIp: "192.168.0.241",
    listenEndpoint: "tcp/0.0.0.0:7447",
    robotNamespace: "",
    integrations: {
      synapse: true,
      corebrum: true,
      ros2ddsBridge: true,
      rmwZenoh: false,
    },
    identity: {
      name: "warehouse-01",
      isolation: "public",
      tcpPort: 7447,
      wsPort: 10000,
      hubEndpoints: ["tcp/192.168.0.241:7447"],
      wsEndpoint: "ws://192.168.0.241:10000",
    },
  };
}

describe("generateFiles", () => {
  it("hub public on Corebrum OS does not write a second zenohd", () => {
    const files = generateFiles(hubPublic());
    assert.equal(files["zenohd.json5"], undefined);
    assert.ok(files["fleet.json"]);
    assert.ok(files["README.md"]);
    assert.equal(files["zenoh-bridge-ros2dds-robot.json5"], undefined);
    const fleet = JSON.parse(files["fleet.json"]);
    assert.equal(fleet.name, "warehouse-01");
    assert.deepEqual(fleet.hubEndpoints, ["tcp/192.168.0.241:7447"]);
    assert.match(files["README.md"], /corebrum-zenoh-router\.service/);
    assert.doesNotMatch(files["README.md"], /zenohd -c zenohd\.json5/);
    const fleetRole = JSON.parse(files["fleet.json"]);
    assert.equal(fleetRole.role, "hub");
    assert.equal(fleetRole.corebrumOs, true);
  });

  it("hub private disables multicast when zenohd is the router", () => {
    const input = hubPublic();
    input.integrations.corebrum = false;
    input.identity.isolation = "private";
    const z = generateFiles(input)["zenohd.json5"];
    assert.match(z, /enabled: false/);
  });

  it("non-OS hub still writes zenohd and the remote-api plugin", () => {
    const input = hubPublic();
    input.integrations.corebrum = false;
    const z = generateFiles(input)["zenohd.json5"];
    assert.match(z, /mode: "router"/);
    assert.match(z, /websocket_port: "10000"/);
  });

  it("member public writes bridge client with optional empty connect", () => {
    const input = hubPublic();
    input.role = "member";
    input.identity.hubEndpoints = [];
    input.identity.wsEndpoint = null;
    const files = generateFiles(input);
    assert.equal(files["zenohd.json5"], undefined);
    assert.ok(files["zenoh-bridge-ros2dds-robot.json5"]);
    const b = files["zenoh-bridge-ros2dds-robot.json5"];
    assert.match(b, /mode: "client"/);
    assert.match(b, /DO NOT use this file with zenohd/);
    assert.match(b, /enabled: true/);
    assert.match(b, /cmd_vel/);
    assert.equal(files["rmw-zenoh-session.json5"], undefined);
    assert.match(files["README.md"], /Do \*\*not\*\* run a second/);
  });

  it("member private requires hub endpoints in bridge connect", () => {
    const input = hubPublic();
    input.role = "member";
    input.identity.isolation = "private";
    input.integrations.rmwZenoh = true;
    const files = generateFiles(input);
    assert.match(
      files["zenoh-bridge-ros2dds-robot.json5"],
      /"tcp\/192\.168\.0\.241:7447"/,
    );
    assert.match(files["zenoh-bridge-ros2dds-robot.json5"], /enabled: false/);
    assert.ok(files["rmw-zenoh-session.json5"]);
    assert.match(files["rmw-zenoh-session.json5"], /mode: "client"/);
    assert.match(files["README.md"], /Multicast scouting is off/);
    assert.match(files["README.md"], /cortex daemon --zenoh-router tcp:\/\/192\.168\.0\.241:7447/);
    assert.match(files["README.md"], /ws:\/\/192\.168\.0\.241:10000/);
  });

  it("member namespace extends cmd_vel allow-list", () => {
    const input = hubPublic();
    input.role = "member";
    input.robotNamespace = "robot-a";
    const b = generateFiles(input)["zenoh-bridge-ros2dds-robot.json5"];
    assert.match(b, /"robot-a\/cmd_vel"/);
  });

  it("member without bridge omits bridge file", () => {
    const input = hubPublic();
    input.role = "member";
    input.integrations.ros2ddsBridge = false;
    const files = generateFiles(input);
    assert.equal(files["zenoh-bridge-ros2dds-robot.json5"], undefined);
  });
});
