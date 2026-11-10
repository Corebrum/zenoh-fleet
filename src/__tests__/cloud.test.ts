import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatCloudPullFailure,
  pullZenohFleet,
  pullZenohFleetFromCloud,
  publishZenohFleet,
} from "../cloud.js";

describe("Corebrum Cloud client", () => {
  it("GET returns null on 404/401 without throwing", async () => {
    const fetch404: typeof fetch = async () =>
      new Response(null, { status: 404 });
    assert.equal(await pullZenohFleet("tok", fetch404), null);
    const fetch401: typeof fetch = async () =>
      new Response(null, { status: 401 });
    assert.equal(await pullZenohFleet("tok", fetch401), null);
  });

  it("GET returns a fleet record when Corebrum Cloud is up", async () => {
    const body = {
      name: "warehouse-01",
      isolation: "public",
      tcpPort: 7447,
      wsPort: 10000,
      hubEndpoints: ["tcp/192.168.0.241:7447"],
      wsEndpoint: "ws://192.168.0.241:10000",
    };
    const fetchOk: typeof fetch = async (url, init) => {
      assert.match(String(url), /\/orgs\/current\/zenoh-fleet$/);
      assert.equal((init?.headers as Record<string, string>).api_token, "tok");
      return new Response(JSON.stringify(body), { status: 200 });
    };
    const got = await pullZenohFleet("tok", fetchOk);
    assert.equal(got?.name, "warehouse-01");
  });

  it("PUT sends the hub record", async () => {
    let captured: string | undefined;
    const fetchOk: typeof fetch = async (_url, init) => {
      assert.equal(init?.method, "PUT");
      captured = String(init?.body);
      return new Response("{}", { status: 200 });
    };
    const ok = await publishZenohFleet(
      "tok",
      {
        name: "warehouse-01",
        isolation: "public",
        tcpPort: 7447,
        wsPort: 10000,
        hubEndpoints: ["tcp/10.0.0.1:7447"],
        wsEndpoint: "ws://10.0.0.1:10000",
      },
      fetchOk,
    );
    assert.equal(ok.ok, true);
    assert.match(captured ?? "", /10\.0\.0\.1/);
  });

  it("explains a live-cloud 404 instead of blaming the token", async () => {
    const { formatCloudPublishFailure } = await import("../cloud.js");
    assert.match(
      formatCloudPublishFailure(404, "Cannot PUT /orgs/current/zenoh-fleet"),
      /does not expose PUT/,
    );
  });

  it("GET 404 yields a member-friendly pull message", () => {
    assert.match(formatCloudPullFailure(404, ""), /no Zenoh fleet/);
  });

  it("pullZenohFleetFromCloud surfaces HTTP errors", async () => {
    const fetch404: typeof fetch = async () =>
      new Response("missing", { status: 404 });
    const result = await pullZenohFleetFromCloud("tok", fetch404);
    assert.equal(result.ok, false);
    assert.equal(result.status, 404);
  });
});
