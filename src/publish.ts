import { join } from "node:path";
import { homedir } from "node:os";

import { publishZenohFleet, formatCloudPublishFailure } from "./cloud.js";
import { findLocalFleetPath, getCloudApiToken, getCloudRobotId, loadFleetJson } from "./detect.js";
import type { CloudZenohFleet } from "./types.js";
import { DEFAULT_FLEET_NAME } from "./types.js";

function resolveFleetJsonPath(path?: string): string {
  if (path) return path;
  const local = findLocalFleetPath();
  if (local) return local;
  return join(homedir(), DEFAULT_FLEET_NAME, "fleet.json");
}

export async function runPublish(
  fleetJsonPath: string | undefined,
  opts?: { fetchImpl?: typeof fetch; token?: string },
): Promise<void> {
  const token = opts?.token ?? getCloudApiToken();
  if (!token) {
    throw new Error(
      "Corebrum Cloud login required. Run `synapse login`, then `zenoh-fleet publish` again.",
    );
  }

  const file = resolveFleetJsonPath(fleetJsonPath);
  const identity = loadFleetJson(file);
  const record: CloudZenohFleet = {
    name: identity.name,
    isolation: identity.isolation,
    tcpPort: identity.tcpPort,
    wsPort: identity.wsPort,
    hubEndpoints: identity.hubEndpoints,
    wsEndpoint: identity.wsEndpoint,
    updatedAt: new Date().toISOString(),
    hubRobotId: getCloudRobotId() ?? null,
  };

  if (!record.hubEndpoints.length) {
    throw new Error(
      "fleet.json has no hubEndpoints. Run `zenoh-fleet init --role hub` with a LAN IP first.",
    );
  }

  const result = await publishZenohFleet(token, record, opts?.fetchImpl);
  if (!result.ok) {
    throw new Error(formatCloudPublishFailure(result.status, result.detail));
  }
  process.stdout.write(
    "Published Zenoh fleet endpoints to Corebrum Cloud for this organization.\n",
  );
}
