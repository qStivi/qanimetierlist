/** Formats a seconds estimate as "~Ns" / "~Nm Ss", or a placeholder while unknown. */
export function formatEta(seconds: number | null): string {
  if (seconds === null) return 'estimating…';
  if (seconds <= 1) return 'almost done';
  if (seconds < 60) return `~${Math.ceil(seconds)}s left`;

  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `~${minutes}m ${secs}s left`;
}
