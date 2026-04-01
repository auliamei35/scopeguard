// src/lib/velocity-tracker.ts

// Map: agentId → list of timestamp (ms)
const actionTimestamps = new Map<string, number[]>();

export function recordAction(agentId: string): void {
  const now = Date.now();
  const timestamps = actionTimestamps.get(agentId) ?? [];

  // Tambah timestamp baru, buang yang sudah lebih dari 60 detik
  const recent = timestamps.filter((t) => now - t < 60_000);
  recent.push(now);
  actionTimestamps.set(agentId, recent);
}

export function countRecentActions(agentId: string): number {
  const now = Date.now();
  const timestamps = actionTimestamps.get(agentId) ?? [];
  return timestamps.filter((t) => now - t < 60_000).length;
}

export function resetAgent(agentId: string): void {
  actionTimestamps.delete(agentId);
}