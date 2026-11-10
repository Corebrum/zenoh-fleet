import { existsSync, readFileSync } from "node:fs";
import { homedir, networkInterfaces } from "node:os";
import { join } from "node:path";

import type { FleetIdentity, Isolation } from "./types.js";

/** First non-loopback IPv4, or null. */
export function detectLanIpv4(): string | null {
  const ifaces = networkInterfaces();
  for (const addrs of Object.values(ifaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      const family = addr.family as string | number;
      const isV4 = family === "IPv4" || family === 4;
      if (isV4 && !addr.internal) {
        return addr.address;
      }
    }
  }
  return null;
}

export function isLoopbackIp(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === "localhost";
}

export function findLocalFleetPath(cwd = process.cwd()): string | null {
  const direct = join(cwd, "fleet.json");
  if (existsSync(direct)) return direct;
  return null;
}

export function loadFleetJson(path: string): FleetIdentity {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<FleetIdentity> & {
    isolation?: string;
  };
  const isolation: Isolation = raw.isolation === "private" ? "private" : "public";
  if (!raw.name || typeof raw.name !== "string") {
    throw new Error(`${path} is missing name`);
  }
  return {
    name: raw.name,
    isolation,
    tcpPort: Number(raw.tcpPort) || 7447,
    wsPort: Number(raw.wsPort) || 10000,
    hubEndpoints: Array.isArray(raw.hubEndpoints)
      ? raw.hubEndpoints.filter((e): e is string => typeof e === "string")
      : [],
    wsEndpoint: typeof raw.wsEndpoint === "string" ? raw.wsEndpoint : null,
  };
}

function readConfigstoreToken(name: string): string | undefined {
  const file = join(homedir(), ".config", "configstore", `${name}.json`);
  if (!existsSync(file)) return undefined;
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as { API_TOKEN?: string };
    return typeof data.API_TOKEN === "string" && data.API_TOKEN ? data.API_TOKEN : undefined;
  } catch {
    return undefined;
  }
}

function readConfigstoreRobotId(name: string): string | undefined {
  const file = join(homedir(), ".config", "configstore", `${name}.json`);
  if (!existsSync(file)) return undefined;
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as { ROBOT_ID?: string };
    return typeof data.ROBOT_ID === "string" && data.ROBOT_ID ? data.ROBOT_ID : undefined;
  } catch {
    return undefined;
  }
}

/** Same token `synapse login` stores (configstore `synapse`; legacy `agenticros`, `robotics`). */
export function getCloudApiToken(): string | undefined {
  return (
    readConfigstoreToken("synapse") ??
    readConfigstoreToken("agenticros") ??
    readConfigstoreToken("robotics")
  );
}

export function getCloudRobotId(): string | undefined {
  return (
    readConfigstoreRobotId("synapse") ??
    readConfigstoreRobotId("agenticros") ??
    readConfigstoreRobotId("robotics")
  );
}

export function zenohTcpEndpoint(host: string, port: number): string {
  return `tcp/${host}:${port}`;
}

export function corebrumTcpUrl(host: string, port: number): string {
  return `tcp://${host}:${port}`;
}

export function wsUrl(host: string, port: number): string {
  return `ws://${host}:${port}`;
}

/** Host from `tcp/192.168.0.241:7447` or `tcp://192.168.0.241:7447`. */
export function hostFromEndpoint(endpoint: string | null | undefined): string | null {
  if (!endpoint) return null;
  const m = endpoint.match(/^(?:tcp:\/\/|tcp\/|ws:\/\/|wss:\/\/)([^/:]+)(?::\d+)?/);
  return m ? m[1] : null;
}
