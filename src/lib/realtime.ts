export function createRealtimeChannelId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.();

  if (uuid) {
    return `${prefix}_${uuid}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}