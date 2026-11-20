export interface LeaderboardEntry {
  name: string;
  score: number;
  nights_won: number;
  achieved_at: string;
  seed: number;
}

export interface LeaderboardFile {
  entries: LeaderboardEntry[];
}

export const LEADERBOARD_MAX_ENTRIES = 10;

// 3-12 chars: ASCII [A-Za-z0-9_] plus Unicode letters (supports Vietnamese diacritics)
const NAME_REGEX = /^[\p{L}\p{N}_]{3,12}$/u;

export function isValidLeaderboardName(name: string): boolean {
  const normalized = name.trim().normalize('NFC');
  return NAME_REGEX.test(normalized);
}

export function formatIsoWithTimezone(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMin);
  const offH = pad(Math.floor(absOffset / 60));
  const offM = pad(absOffset % 60);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${offH}:${offM}`;
}

export function sortLeaderboardEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ta = Date.parse(a.achieved_at);
      const tb = Date.parse(b.achieved_at);
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) {
        return ta - tb;
      }
      return a.achieved_at < b.achieved_at ? -1 : a.achieved_at > b.achieved_at ? 1 : 0;
    })
    .slice(0, LEADERBOARD_MAX_ENTRIES);
}

export function addLeaderboardEntry(
  entries: LeaderboardEntry[],
  candidate: Omit<LeaderboardEntry, 'achieved_at'> & { achieved_at?: string }
): LeaderboardEntry[] {
  const cleanName = candidate.name.trim().normalize('NFC');
  if (!isValidLeaderboardName(cleanName)) {
    throw new Error('Tên phải dài 3–12 ký tự (chữ cái, số hoặc dấu gạch dưới _).');
  }
  const entry: LeaderboardEntry = {
    name: cleanName,
    score: Math.max(0, Math.floor(candidate.score)),
    nights_won: Math.max(0, Math.min(3, Math.floor(candidate.nights_won))),
    achieved_at: candidate.achieved_at ?? formatIsoWithTimezone(),
    seed: candidate.seed | 0,
  };
  return sortLeaderboardEntries([...entries, entry]);
}

