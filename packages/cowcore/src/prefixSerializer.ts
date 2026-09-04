type StablePrefixInput = {
  securityContractVersion: string;
  systemContract: Record<string, unknown>;
  capabilities: Array<{ capabilityId: string; schema: Record<string, unknown> }>;
  taskMode: string;
  volatile?: unknown;
};

export function serializeStablePrefix(input: StablePrefixInput): { text: string; digest: string } {
  const canonical = {
    securityContractVersion: input.securityContractVersion,
    systemContract: sortJson(input.systemContract),
    capabilities: [...input.capabilities]
      .sort((a, b) => a.capabilityId.localeCompare(b.capabilityId))
      .map((capability) => ({ capabilityId: capability.capabilityId, schema: sortJson(capability.schema) })),
    taskMode: input.taskMode
  };
  const text = JSON.stringify(canonical);
  // ponytail: non-security observability digest; WP2 securityContractHash uses JCS+SHA-256.
  return { text, digest: stableHash(text) };
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortJson(item)]));
}

function stableHash(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}
