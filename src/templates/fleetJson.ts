import type { GenerateInput } from "../types.js";

export function renderFleetJson(input: GenerateInput): string {
  const identity = input.identity;
  return `${JSON.stringify(
    {
      name: identity.name,
      role: input.role,
      isolation: identity.isolation,
      tcpPort: identity.tcpPort,
      wsPort: identity.wsPort,
      hubEndpoints: identity.hubEndpoints,
      wsEndpoint: identity.wsEndpoint,
      corebrumOs: input.integrations.corebrum,
    },
    null,
    2,
  )}\n`;
}
