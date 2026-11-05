const nf = new Intl.NumberFormat('he-IL');

export function formatNumber(n: number): string {
  return nf.format(n);
}

export function formatSeconds(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return String(s);
}

export function rankEmoji(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
}
