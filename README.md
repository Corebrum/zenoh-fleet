# zenoh-fleet

Enter-to-accept CLI that writes **compatible Zenoh JSON5** for every machine on a robot fleet. Each box runs the same command, picks **hub** or **member**, and gets the files it should actually start — not a copy-and-tweak of Eclipse `DEFAULT_CONFIG.json5`.

```bash
npx zenoh-fleet                      # wizard (same CLI as @corebrum/zenoh-fleet)
npx @corebrum/zenoh-fleet            # scoped name; also works
zenoh-fleet --help                   # routing + commands
zenoh-fleet --version
zenoh-fleet init --role member --yes
```

Run `npx` from any directory **except** a source checkout unless you have run `npm install` there (npm otherwise looks for a local `zenoh-fleet` bin that is not linked). From this repo you can also run `node dist/index.js`.

Apache-2.0. Node ≥ 20. No dependency on Corebrum or `@corebrum/synapse`.

## Routing

Hub (router)
: One `zenohd` on this machine. Listens on TCP 7447 (and WebSocket 10000 if Corebrum Synapse Mode D is enabled). Other machines connect here. Default when no fleet exists yet. v1 writes `zenohd.json5`.

Member (client)
: A robot, Corebrum worker, or Corebrum Synapse laptop. Does **not** run a second router. Connects to the hub (`zenoh-bridge-ros2dds`, `rmw_zenoh` session, or `corebrum --zenoh-router`). v1 writes client/bridge files.

Peer mesh
: Every node is a router and lists the others in `connect.endpoints`. No single hub. **Not generated in v1** (Synapse clients stay members, not a second `zenohd`). Use `--role hub` or `--role member`. `--role peer` is an error.

Public LAN
: Multicast scouting on. Members on the same L2 can join without a hub IP.

Private mesh
: Multicast off. Members need the hub endpoint (`--join`, `--hub-ip`, or a Corebrum Cloud pull after the hub publishes).

## Defaults (hit Enter)

Name the fleet (or keep `local-fleet`) and press Enter through the rest:

- Isolation: public LAN
- Ports: `7447` / `10000` (10000 only when Corebrum Synapse Mode D is selected)
- Integrations: Corebrum OS + rmw_zenoh client session. DDS bridge and WebSocket are off until asked
- Advertised IP: first non-loopback IPv4
- Role: hub if no fleet exists yet, otherwise member
- Corebrum Cloud: yes only if `synapse login` already stored an API token

## Independent machines

```bash
# laptop / edge box
zenoh-fleet init --role hub --name warehouse-01 --yes

# robot (copy fleet.json, or pull from Corebrum Cloud)
zenoh-fleet init --role member --name warehouse-01 --join ./warehouse-01/fleet.json --yes
```

Hub output: `fleet.json`, `zenohd.json5`, `README.md`. Start the router from the **parent** directory (or `cd` into the output folder first):

```bash
zenohd -c /absolute/path/to/warehouse-01/zenohd.json5
```

Member output (by integration): `fleet.json`, `zenoh-bridge-ros2dds-robot.json5`, optional `rmw-zenoh-session.json5`, `README.md`.

## Corebrum Cloud

Optional. If you are logged in (`synapse login`), the hub can **PUT** its advertised `tcp/<lan-ip>:7447` and `ws://<lan-ip>:10000` to `https://cloud.corebrum.com/orgs/current/zenoh-fleet`. Members **GET** that record so they can Enter-through without copying IPs.

Corebrum Cloud does not discover LAN addresses and cannot punch NAT. Cross-site private meshes still need a VPN (Tailscale, etc.) or a public hub. Robots do not publish their own IPs in v1.

## Deploy notes

- Hub on Corebrum OS: `sudo corebrum zenoh fleet apply .` keeps `rmw_zenohd`. Do not start a second `zenohd`.
- Corebrum Synapse, only with `--synapse`: `zenoh.routerEndpoint` = `ws://<hub>:10000` (never `tcp/...`).
- Cortex: `cortex daemon --zenoh-router tcp://<hub>:7447`.
- Robot: `zenoh-bridge-ros2dds -c zenoh-bridge-ros2dds-robot.json5`, then `nc -zv <hub> 7447`.

## License

Apache License 2.0.
