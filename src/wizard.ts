import { checkbox, confirm, input as promptInput, select } from "@inquirer/prompts";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { pullZenohFleet, publishZenohFleet } from "./arc.js";
import {
  detectLanIpv4,
  findLocalFleetPath,
  getArcApiToken,
  getArcRobotId,
  isLoopbackIp,
  loadFleetJson,
  zenohTcpEndpoint,
  wsUrl,
} from "./detect.js";
import { generateFiles } from "./generate.js";
import { PEER_ROLE_ERROR } from "./help.js";
import { printDeploy } from "./printDeploy.js";
import type {
  ArcZenohFleet,
  FleetIdentity,
  GenerateInput,
  Integrations,
  Isolation,
  Role,
} from "./types.js";
import {
  DEFAULT_FLEET_NAME,
  DEFAULT_INTEGRATIONS,
  DEFAULT_TCP_PORT,
  DEFAULT_WS_PORT,
} from "./types.js";

export interface InitFlags {
  name?: string;
  role?: string;
  join?: string;
  hubIp?: string;
  isolation?: string;
  tcpPort?: number;
  wsPort?: number;
  out?: string;
  namespace?: string;
  agenticros?: boolean;
  corebrum?: boolean;
  bridge?: boolean;
  rmwZenoh?: boolean;
  arc?: boolean;
  yes?: boolean;
}

export interface InitPlan {
  input: GenerateInput;
  outDir: string;
  useArc: boolean;
  warnings: string[];
}

export function parseRole(raw: string | undefined): Role | undefined {
  if (!raw) return undefined;
  const r = raw.toLowerCase();
  if (r === "hub" || r === "member") return r;
  if (r === "peer") {
    throw new Error(PEER_ROLE_ERROR);
  }
  throw new Error(`unknown --role ${raw}; use hub or member`);
}

export function parseIsolation(raw: string | undefined): Isolation | undefined {
  if (!raw) return undefined;
  const v = raw.toLowerCase();
  if (v === "public" || v === "private") return v;
  throw new Error(`unknown --isolation ${raw}; use public or private`);
}

function sanitizeFleetName(name: string): string {
  const trimmed = name.trim() || DEFAULT_FLEET_NAME;
  return trimmed.replace(/[/\\]/g, "-");
}

function stdinIsTty(): boolean {
  return Boolean(process.stdin.isTTY);
}

export interface WizardContext {
  localFleet: FleetIdentity | null;
  arcFleet: ArcZenohFleet | null;
  token?: string;
  lanIp: string | null;
}

export async function gatherContext(
  flags: InitFlags,
  opts?: { fetchImpl?: typeof fetch; token?: string | undefined },
): Promise<WizardContext> {
  const token = opts && "token" in opts ? opts.token : getArcApiToken();
  let localFleet: FleetIdentity | null = null;
  if (flags.join) {
    localFleet = loadFleetJson(flags.join);
  } else {
    const path = findLocalFleetPath();
    if (path) localFleet = loadFleetJson(path);
  }

  let arcFleet: ArcZenohFleet | null = null;
  if (token) {
    try {
      arcFleet = await pullZenohFleet(token, opts?.fetchImpl);
    } catch {
      arcFleet = null;
    }
  }

  return {
    localFleet,
    arcFleet,
    token,
    lanIp: detectLanIpv4(),
  };
}

export async function resolveInitPlan(
  flags: InitFlags,
  ctx: WizardContext,
  interactive: boolean,
): Promise<InitPlan> {
  const warnings: string[] = [];
  const existing = ctx.localFleet ?? ctx.arcFleet;
  const defaultName = sanitizeFleetName(
    flags.name || existing?.name || DEFAULT_FLEET_NAME,
  );
  const defaultRole: Role = existing ? "member" : "hub";

  let name = defaultName;
  let role = parseRole(flags.role) ?? defaultRole;
  let isolation: Isolation =
    parseIsolation(flags.isolation) ?? existing?.isolation ?? "public";
  let tcpPort = flags.tcpPort ?? existing?.tcpPort ?? DEFAULT_TCP_PORT;
  let wsPort = flags.wsPort ?? existing?.wsPort ?? DEFAULT_WS_PORT;
  let namespace = flags.namespace ?? "";
  let advertisedIp = flags.hubIp ?? ctx.lanIp;
  if (advertisedIp && isLoopbackIp(advertisedIp)) {
    warnings.push(
      "Advertised IP is loopback; members on other hosts cannot connect. Pass --hub-ip with a LAN or VPN address.",
    );
    advertisedIp = null;
  }

  const integrations: Integrations = {
    agenticros: flags.agenticros ?? DEFAULT_INTEGRATIONS.agenticros,
    corebrum: flags.corebrum ?? DEFAULT_INTEGRATIONS.corebrum,
    ros2ddsBridge: flags.bridge ?? DEFAULT_INTEGRATIONS.ros2ddsBridge,
    rmwZenoh: flags.rmwZenoh ?? DEFAULT_INTEGRATIONS.rmwZenoh,
  };

  const defaultOut = flags.out ?? `./${defaultName}`;
  let outDir = defaultOut;
  const hasToken = Boolean(ctx.token);
  let useArc = flags.arc ?? hasToken;

  if (interactive) {
    name = sanitizeFleetName(
      await promptInput({
        message: "Fleet name",
        default: defaultName,
      }),
    );
    role = await select({
      message: "This machine",
      default: role,
      choices: [
        { name: "Hub (router) — this Corebrum OS machine keeps rmw_zenohd", value: "hub" as const },
        {
          name: "Member (client) — robot, Corebrum, or AgenticROS laptop",
          value: "member" as const,
        },
      ],
    });
    isolation = await select({
      message: "Isolation",
      default: isolation,
      choices: [
        {
          name: "Public LAN — multicast; members do not need a hub IP",
          value: "public" as const,
        },
        {
          name: "Private mesh — no multicast; members need the hub endpoint",
          value: "private" as const,
        },
      ],
    });
    tcpPort = Number(
      await promptInput({
        message: "TCP port (native Zenoh / Corebrum / bridge)",
        default: String(tcpPort),
      }),
    );
    wsPort = Number(
      await promptInput({
        message: "WebSocket port (AgenticROS zenoh-ts)",
        default: String(wsPort),
      }),
    );
    if (role === "hub") {
      advertisedIp =
        (
          await promptInput({
            message: "Hub advertised IP (LAN or VPN, not 127.0.0.1)",
            default: advertisedIp ?? "",
          })
        ).trim() || null;
      if (advertisedIp && isLoopbackIp(advertisedIp)) {
        warnings.push("Refusing to advertise loopback to other hosts.");
        advertisedIp = null;
      }
    }
    const selected = await checkbox({
      message: "Integrations",
      choices: [
        { name: "AgenticROS (WebSocket remote-api)", value: "agenticros", checked: integrations.agenticros },
        { name: "Corebrum", value: "corebrum", checked: integrations.corebrum },
        { name: "ROS 2 DDS bridge (zenoh-bridge-ros2dds)", value: "bridge", checked: integrations.ros2ddsBridge },
        { name: "rmw_zenoh session file", value: "rmw", checked: integrations.rmwZenoh },
      ],
    });
    integrations.agenticros = selected.includes("agenticros");
    integrations.corebrum = selected.includes("corebrum");
    integrations.ros2ddsBridge = selected.includes("bridge");
    integrations.rmwZenoh = selected.includes("rmw");
    namespace = await promptInput({
      message: "Robot namespace (empty = generic cmd_vel allow-list)",
      default: namespace,
    });
    outDir = await promptInput({
      message: "Output directory",
      default: flags.out ?? `./${name}`,
    });
    if (hasToken) {
      useArc = await confirm({
        message: "Share hub endpoints with AgenticROS Cloud (ARC) for other machines?",
        default: useArc,
      });
    } else {
      useArc = false;
    }
  }

  let hubEndpoints = existing?.hubEndpoints?.slice() ?? [];
  let wsEndpoint = existing?.wsEndpoint ?? null;

  if (role === "hub" && advertisedIp) {
    hubEndpoints = [zenohTcpEndpoint(advertisedIp, tcpPort)];
    wsEndpoint = wsUrl(advertisedIp, wsPort);
  } else if (flags.hubIp && !isLoopbackIp(flags.hubIp)) {
    hubEndpoints = [zenohTcpEndpoint(flags.hubIp, tcpPort)];
    wsEndpoint = wsUrl(flags.hubIp, wsPort);
    advertisedIp = flags.hubIp;
  }

  if (role === "member" && isolation === "private" && hubEndpoints.length === 0) {
    if (interactive) {
      const typed = (
        await promptInput({
          message: "Hub IP (required for private mesh)",
          default: "",
        })
      ).trim();
      if (typed && !isLoopbackIp(typed)) {
        hubEndpoints = [zenohTcpEndpoint(typed, tcpPort)];
        wsEndpoint = wsUrl(typed, wsPort);
        advertisedIp = typed;
      }
    }
    if (hubEndpoints.length === 0) {
      warnings.push(
        "Private member has no hub endpoint. Run this on the hub first, pass --join fleet.json, --hub-ip, or log in so ARC can supply the hub.",
      );
    }
  }

  if (!advertisedIp && role === "hub") {
    warnings.push(
      "No LAN IP detected; hub will listen on all interfaces but members need --hub-ip or multicast on a public LAN.",
    );
  }

  const identity: FleetIdentity = {
    name,
    isolation,
    tcpPort,
    wsPort,
    hubEndpoints,
    wsEndpoint,
  };

  const generated: GenerateInput = {
    role,
    identity,
    advertisedIp: advertisedIp && !isLoopbackIp(advertisedIp) ? advertisedIp : null,
    listenEndpoint: zenohTcpEndpoint("0.0.0.0", tcpPort),
    integrations,
    robotNamespace: namespace.trim(),
  };

  return { input: generated, outDir, useArc: useArc && hasToken, warnings };
}

export async function runInit(
  flags: InitFlags,
  opts?: { fetchImpl?: typeof fetch; token?: string | undefined },
): Promise<InitPlan> {
  parseRole(flags.role);
  parseIsolation(flags.isolation);

  const ctx = await gatherContext(flags, opts);
  const interactive = Boolean(!flags.yes && stdinIsTty());
  const plan = await resolveInitPlan(flags, ctx, interactive);

  for (const w of plan.warnings) {
    process.stderr.write(`warning: ${w}\n`);
  }

  mkdirSync(plan.outDir, { recursive: true });
  const files = generateFiles(plan.input);
  for (const [fileName, content] of Object.entries(files)) {
    writeFileSync(join(plan.outDir, fileName), content, "utf8");
  }

  process.stdout.write(`Wrote ${Object.keys(files).length} files to ${plan.outDir}\n\n`);
  printDeploy(plan.input, plan.outDir);

  if (plan.useArc && ctx.token && plan.input.role === "hub") {
    const record: ArcZenohFleet = {
      name: plan.input.identity.name,
      isolation: plan.input.identity.isolation,
      tcpPort: plan.input.identity.tcpPort,
      wsPort: plan.input.identity.wsPort,
      hubEndpoints: plan.input.identity.hubEndpoints,
      wsEndpoint: plan.input.identity.wsEndpoint,
      updatedAt: new Date().toISOString(),
      hubRobotId: getArcRobotId() ?? null,
    };
    try {
      const result = await publishZenohFleet(ctx.token, record, opts?.fetchImpl);
      if (result.ok) {
        process.stdout.write(
          "\nPublished hub endpoints to ARC. Other machines: `npx zenoh-fleet` while logged in (`agenticros login`).\n",
        );
      } else {
        process.stderr.write(`warning: ${result.detail}\n`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`warning: ARC publish failed; continuing offline (${message}).\n`);
    }
  }

  return plan;
}
