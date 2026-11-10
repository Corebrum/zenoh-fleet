import { join } from "node:path";
import { homedir } from "node:os";

import { formatCloudPullFailure, pullZenohFleetFromCloud } from "./cloud.js";
import { getCloudApiToken, hostFromEndpoint } from "./detect.js";
import { DEFAULT_FLEET_NAME } from "./types.js";
import { runInit, type InitFlags } from "./wizard.js";

export interface PullFlags {
  out?: string;
  synapse?: boolean;
  corebrum?: boolean;
  bridge?: boolean;
  rmwZenoh?: boolean;
}

export async function runPull(
  flags: PullFlags,
  opts?: { fetchImpl?: typeof fetch; token?: string },
): Promise<string> {
  const token = opts?.token ?? getCloudApiToken();
  if (!token) {
    throw new Error(
      "Corebrum Cloud login required. Run `synapse login`, then `zenoh-fleet pull` again.",
    );
  }

  const result = await pullZenohFleetFromCloud(token, opts?.fetchImpl);
  if (!result.ok) {
    throw new Error(formatCloudPullFailure(result.status, result.detail));
  }
  const record = result.record;
  if (!record?.hubEndpoints?.length) {
    throw new Error(
      "Corebrum Cloud has no hub endpoints yet. Run `zenoh-fleet init --role hub` on the hub and publish to Corebrum Cloud.",
    );
  }

  const hubIp = hostFromEndpoint(record.hubEndpoints[0]);
  if (!hubIp) {
    throw new Error(`Could not parse hub address from ${record.hubEndpoints[0]}`);
  }

  const outDir = flags.out ?? join(homedir(), DEFAULT_FLEET_NAME);
  const initFlags: InitFlags = {
    yes: true,
    role: "member",
    name: record.name,
    hubIp,
    isolation: record.isolation,
    tcpPort: record.tcpPort,
    wsPort: record.wsPort,
    out: outDir,
    synapse: flags.synapse,
    corebrum: flags.corebrum ?? true,
    bridge: flags.bridge,
    rmwZenoh: flags.rmwZenoh ?? true,
    cloud: false,
  };

  await runInit(initFlags, { ...opts, token });
  process.stdout.write(
    `\nMember configs written to ${outDir}. On Corebrum OS run: sudo corebrum zenoh fleet sync ${outDir}\n`,
  );
  return outDir;
}
