// Simple in-memory mock store tracking timestamps for the 24-hour rate limit throttle
export const exportThrottleStore = new Map<string, number>();

// Helper utility exposed to clear mock states during testing execution runs
export function resetThrottleRegistry() {
  exportThrottleStore.clear();
}
