/** Routing copy shared by `--help` and README. Keep these strings in sync. */

export const ROUTING_HELP = `
Routing
  Hub (router)
    On Corebrum OS this machine's corebrum-zenoh-router.service (rmw_zenohd on
    TCP 7447) is the hub. The generator does not write a second zenohd config.
    Other machines connect here. Default when no fleet exists yet.

  Member (client)
    A robot or another Corebrum machine. Does not run a router. Writes an
    rmw_zenoh client session and the cortex daemon --zenoh-router line.
    WebSocket port 10000 is only for --synapse. The DDS bridge is --bridge.

  Peer mesh
    Every node is a router and lists the others in connect.endpoints. No single
    hub. Not generated in v1 (Synapse clients stay members, not a second
    zenohd). Use --role hub or --role member. --role peer is an error.

  Public LAN
    Multicast scouting on. Members on the same L2 can join without a hub IP.

  Private mesh
    Multicast off. Members need the hub endpoint (--join, --hub-ip, or a
    Corebrum Cloud pull after the hub publishes).
`.trim();

export const INIT_ROLE_HELP =
  "This machine's role: hub (router) or member (client). Peer mesh is not generated yet.";

export const PEER_ROLE_ERROR =
  "use hub or member; peer mesh is not generated yet.";
