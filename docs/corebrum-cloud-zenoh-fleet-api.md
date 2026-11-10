# Corebrum Cloud — org Zenoh fleet API

Machines that share a **Corebrum Cloud organization** use this JSON document as the source of truth for hub TCP/WebSocket endpoints. The `@corebrum/zenoh-fleet` CLI and `corebrum zenoh fleet pull` call these routes.

## Authentication

Same as other Corebrum Cloud REST APIs:

- Header `api_token: <token>` (from `synapse login`)
- Or `Authorization: Bearer <token>`

The token must belong to a user in an organization. Route: **current org** for that user (same semantics as `GET /orgs/current`).

## `GET /orgs/current/zenoh-fleet`

Returns the fleet record for the organization.

**200** — body:

```json
{
  "name": "local-fleet",
  "isolation": "public",
  "tcpPort": 7447,
  "wsPort": 10000,
  "hubEndpoints": ["tcp/192.168.8.196:7447"],
  "wsEndpoint": "ws://192.168.8.196:10000",
  "updatedAt": "2026-11-10T18:00:00.000Z",
  "hubRobotId": "optional-robot-id-from-hub"
}
```

**404** — no record yet (members should fall back to `--hub-ip` or local `fleet.json`).

**401** — invalid token.

## `PUT /orgs/current/zenoh-fleet`

Hub machines replace the org record (full document).

**Body:** same shape as GET response. `updatedAt` is set by the client; server may overwrite with server time.

**200** — stored.

**401** — invalid token.

**403** — user not allowed to update org fleet (optional).

## Storage model (implementation note)

- One record per organization (not per robot).
- The hub overwrites on each `zenoh-fleet publish` or hub wizard with cloud enabled.
- Members never PUT in v1.
- Corebrum Cloud does not probe LAN reachability; the hub must publish an address other machines can route to.

## Clients

| Client | Action |
|--------|--------|
| `zenoh-fleet publish` | `PUT` from local `fleet.json` |
| `zenoh-fleet pull` | `GET` then `init --role member` locally |
| `corebrum zenoh fleet join` | `zenoh-fleet pull` + `corebrum zenoh fleet sync` |
