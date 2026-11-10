import { Command } from "commander";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { INIT_ROLE_HELP, ROUTING_HELP } from "./help.js";
import { runPublish } from "./publish.js";
import { runPull } from "./pull.js";
import { runInit, type InitFlags } from "./wizard.js";

export function readVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function triFlag(argv: string[], on: string, off: string): boolean | undefined {
  const onAt = argv.lastIndexOf(on);
  const offAt = argv.lastIndexOf(off);
  if (onAt < 0 && offAt < 0) return undefined;
  return onAt > offAt;
}

function synapseTriFlag(argv: string[]): boolean | undefined {
  const modern = triFlag(argv, "--synapse", "--no-synapse");
  if (modern !== undefined) return modern;
  return triFlag(argv, "--agenticros", "--no-agenticros");
}

function cloudOptOut(argv: string[]): boolean | undefined {
  if (argv.includes("--no-cloud") || argv.includes("--no-arc")) return false;
  return undefined;
}

function initFlagsFromOpts(opts: Record<string, unknown>, argv: string[]): InitFlags {
  return {
    name: opts.name as string | undefined,
    role: opts.role as string | undefined,
    join: opts.join as string | undefined,
    hubIp: opts.hubIp as string | undefined,
    isolation: opts.isolation as string | undefined,
    tcpPort: opts.tcpPort !== undefined ? Number(opts.tcpPort) : undefined,
    wsPort: opts.wsPort !== undefined ? Number(opts.wsPort) : undefined,
    out: opts.out as string | undefined,
    namespace: opts.namespace as string | undefined,
    synapse: synapseTriFlag(argv),
    corebrum: triFlag(argv, "--corebrum", "--no-corebrum"),
    bridge: triFlag(argv, "--bridge", "--no-bridge"),
    rmwZenoh: triFlag(argv, "--rmw-zenoh", "--no-rmw-zenoh"),
    cloud: cloudOptOut(argv),
    yes: Boolean(opts.yes),
  };
}

export function createProgram(): Command {
  const program = new Command();
  program
    .name("zenoh-fleet")
    .description(
      "Generate compatible Zenoh JSON5 for a fleet hub or member. Run with no arguments for the wizard.",
    )
    .version(readVersion(), "-V, --version", "Print the zenoh-fleet CLI version")
    .showHelpAfterError("(use 'zenoh-fleet --help' for routing and commands)")
    .addHelpText("after", `\n${ROUTING_HELP}\n`);

  const initCmd = program
    .command("init")
    .description("Generate Zenoh JSON5 for this machine (wizard unless --yes).")
    .option("--name <name>", "Fleet name (default local-fleet)")
    .option("--role <role>", INIT_ROLE_HELP)
    .option("--join <fleet.json>", "Load fleet identity and hub endpoints from a fleet.json")
    .option("--hub-ip <ip>", "Hub IPv4/hostname other machines can reach (not 127.0.0.1)")
    .option("--isolation <mode>", "public (multicast) or private (explicit hub)")
    .option("--tcp-port <port>", "Native Zenoh / Corebrum / bridge TCP port")
    .option("--ws-port <port>", "Corebrum Synapse WebSocket (remote-api) port")
    .option("--out <dir>", "Output directory (default ./<fleet-name>/)")
    .option("--namespace <ns>", "Robot namespace for cmd_vel allow-list")
    .option("--synapse", "Enable the WebSocket remote-api notes (Synapse Mode D)")
    .option("--no-synapse", "Skip Corebrum Synapse WebSocket plugin / deploy notes")
    .option("--no-corebrum", "Skip Corebrum OS; write zenohd.json5 on the hub")
    .option("--bridge", "Write zenoh-bridge-ros2dds for a member")
    .option("--no-bridge", "Skip zenoh-bridge-ros2dds member file")
    .option("--rmw-zenoh", "Write the rmw_zenoh client session (default)")
    .option("--no-rmw-zenoh", "Skip the rmw_zenoh session file")
    .option("--no-cloud", "Do not call Corebrum Cloud even if logged in")
    .option("--yes", "Non-interactive: accept defaults and flags (Enter-through)")
    .addHelpText("after", `\n${ROUTING_HELP}\n`)
    .action(async (opts: Record<string, unknown>) => {
      await runInit(initFlagsFromOpts(opts, process.argv));
    });

  program
    .command("pull")
    .description(
      "Pull org Zenoh fleet from Corebrum Cloud and write member configs (needs synapse login).",
    )
    .option("--out <dir>", `Output directory (default ~/${"local-fleet"})`)
    .option("--synapse", "Include Corebrum Synapse WebSocket deploy notes")
    .option("--no-corebrum", "Skip Corebrum OS rmw_zenoh session file")
    .option("--bridge", "Write zenoh-bridge-ros2dds for a member")
    .option("--no-rmw-zenoh", "Skip the rmw_zenoh session file")
    .action(async (opts: Record<string, unknown>) => {
      const argv = process.argv;
      await runPull(
        {
          out: opts.out as string | undefined,
          synapse: synapseTriFlag(argv),
          corebrum: triFlag(argv, "--corebrum", "--no-corebrum"),
          bridge: triFlag(argv, "--bridge", "--no-bridge"),
          rmwZenoh: triFlag(argv, "--rmw-zenoh", "--no-rmw-zenoh"),
        },
      );
    });

  program
    .command("publish")
    .description(
      "Publish local hub fleet.json endpoints to Corebrum Cloud for this organization.",
    )
    .argument("[fleet.json]", "Path to fleet.json (default ./local-fleet/fleet.json)")
    .action(async (fleetJson: string | undefined) => {
      await runPublish(fleetJson);
    });

  return program;
}

export async function run(argv: string[] = process.argv): Promise<void> {
  const program = createProgram();
  const userArgs = argv.slice(2);
  if (userArgs.length === 0) {
    await runInit({ yes: !process.stdin.isTTY });
    return;
  }
  await program.parseAsync(argv);
}
