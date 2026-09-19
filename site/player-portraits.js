// Homepage artwork and display order only. Player records stay in Firestore.
export const PLAYER_PORTRAITS = Object.freeze([
  { name: '강다윤', number: '01' },
  { name: '팡제이', number: '02' },
  { name: '이수빈', number: '03' },
  { name: '이효은', number: '04' },
  { name: '천윤슬', number: '05' },
  { name: '서예은', number: '06' },
  { name: '양하은', number: '07' },
  { name: '임수아', number: '08' },
].map(player => Object.freeze({
  ...player,
  src: `site/assets/players/player-${player.number}.webp`,
})));

const normalizeName = name => String(name ?? '').normalize('NFC').replace(/\s+/gu, '');
// Some existing public roster records already contain the masked name.
// Only exact full names or these explicitly derived masked names can match.
const byName = new Map(PLAYER_PORTRAITS.flatMap(player => [
  [player.name, player],
  [player.name[0] + '○' + player.name.at(-1), player],
]));

export function portraitForPlayer(player) {
  return byName.get(normalizeName(player?.name)) ?? null;
}

export function orderPlayersForHomepage(players) {
  // Stable sorting keeps the existing order of newly added, unmatched players.
  return [...players].sort((a, b) =>
    Number(portraitForPlayer(a)?.number ?? 999) - Number(portraitForPlayer(b)?.number ?? 999)
  );
}
