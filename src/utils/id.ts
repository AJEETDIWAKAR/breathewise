let counter = 0;

export function createEntryId(prefix: string): string {
  counter = (counter + 1) % 100_000;
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now()}-${counter}`;
}
