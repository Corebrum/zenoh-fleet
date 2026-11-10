export type Role = "hub" | "member";
export type Isolation = "public" | "private";

export interface Integrations {
  synapse: boolean;
  corebrum: boolean;
  ros2ddsBridge: boolean;
  rmwZenoh: boolean;
}

export interface FleetIdentity {
  name: string;
  isolation: Isolation;
  tcpPort: number;
  wsPort: number;
  hubEndpoints: string[];
  wsEndpoint: string | null;
}

export interface GenerateInput {
  role: Role;
  identity: FleetIdentity;
  /** Address this hub advertises to members. Never 127.0.0.1 for other hosts. */
  advertisedIp: string | null;
  listenEndpoint: string;
  integrations: Integrations;
  robotNamespace: string;
}

export interface CloudZenohFleet {
  name: string;
  isolation: Isolation;
  tcpPort: number;
  wsPort: number;
  hubEndpoints: string[];
  wsEndpoint: string | null;
  updatedAt?: string;
  hubRobotId?: string | null;
}

export const DEFAULT_FLEET_NAME = "local-fleet";
export const DEFAULT_TCP_PORT = 7447;
export const DEFAULT_WS_PORT = 10000;

export const DEFAULT_INTEGRATIONS: Integrations = {
  synapse: false,
  corebrum: true,
  ros2ddsBridge: false,
  rmwZenoh: true,
};
