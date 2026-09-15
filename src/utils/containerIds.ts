export const CONTAINER_PREFIX = 'container:';
export const POOL_CONTAINER_ID = `${CONTAINER_PREFIX}pool`;

export function containerIdForTier(tierId: string): string {
  return `${CONTAINER_PREFIX}${tierId}`;
}

export function toContainerKey(tierId: string | null): string {
  return tierId ?? 'pool';
}

export function fromContainerKey(key: string): string | null {
  return key === 'pool' ? null : key;
}
