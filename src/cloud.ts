import type { CloudZenohFleet } from "./types.js";

export const DEFAULT_CLOUD_URL = "https://cloud.corebrum.com";

export function cloudBaseUrl(): string {
  return (
    process.env.ZENOH_FLEET_CLOUD_URL ||
    process.env.COREBRUM_CLOUD ||
    process.env.ZENOH_FLEET_ARC_URL ||
    process.env.AGENTICROS_CLOUD ||
    DEFAULT_CLOUD_URL
  ).replace(/\/$/, "");
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    api_token: token,
    "Content-Type": "application/json",
  };
}

export async function pullZenohFleet(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CloudZenohFleet | null> {
  const res = await fetchImpl(`${cloudBaseUrl()}/orgs/current/zenoh-fleet`, {
    headers: headers(token),
  });
  if (res.status === 404 || res.status === 401) return null;
  if (!res.ok) return null;
  const body = (await res.json()) as CloudZenohFleet | null;
  if (!body || typeof body !== "object" || !body.name) return null;
  return body;
}

export interface CloudPublishResult {
  ok: boolean;
  status: number;
  detail: string;
}

export function formatCloudPublishFailure(status: number, body: string): string {
  if (status === 404 || /Cannot PUT/i.test(body)) {
    return "Corebrum Cloud does not expose PUT /orgs/current/zenoh-fleet yet (cloud returned 404). Configs still work locally — copy fleet.json or pass --join / --hub-ip on other machines until that API is deployed.";
  }
  if (status === 401) {
    return "Corebrum Cloud rejected the API token. Run `synapse login` again.";
  }
  if (/Not in an organization/i.test(body)) {
    return "This login is not in an organization. Create or join an org on https://cloud.corebrum.com, then retry.";
  }
  const snippet = body.replace(/\s+/g, " ").trim().slice(0, 200);
  return `Corebrum Cloud publish failed (HTTP ${status})${snippet ? `: ${snippet}` : ""}.`;
}

export async function publishZenohFleet(
  token: string,
  record: CloudZenohFleet,
  fetchImpl: typeof fetch = fetch,
): Promise<CloudPublishResult> {
  const res = await fetchImpl(`${cloudBaseUrl()}/orgs/current/zenoh-fleet`, {
    method: "PUT",
    headers: headers(token),
    body: JSON.stringify(record),
  });
  const detail = await res.text();
  if (res.ok) {
    return { ok: true, status: res.status, detail };
  }
  return {
    ok: false,
    status: res.status,
    detail: formatCloudPublishFailure(res.status, detail),
  };
}
