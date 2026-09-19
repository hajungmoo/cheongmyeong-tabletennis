import { safeURL } from './site-content.js?v=3.1.0';

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

const publicName = name => {
  const value=normalizeName(name);
  return value.includes('○') ? value : value.length>=3 ? value[0]+'○'+value.at(-1) : value;
};

export function portraitForPlayer(player, roster = []) {
  const direct=byName.get(normalizeName(player?.name));
  if(direct)return direct;
  // Legacy records may use a different internal spelling. The user supplied
  // the portraits for the eight existing public cards, whose masked labels
  // are unique. Never infer this match when two roster cards share a label.
  const label=publicName(player?.name), candidate=byName.get(label);
  if(!candidate||roster.filter(item=>publicName(item?.name)===label).length!==1)return null;
  return candidate;
}

export function orderPlayersForHomepage(players) {
  // Stable sorting keeps the existing order of newly added, unmatched players.
  return [...players].sort((a, b) =>
    Number(portraitForPlayer(a, players)?.number ?? 999) - Number(portraitForPlayer(b, players)?.number ?? 999)
  );
}

export function playerImageFor(player, roster = []) {
  const portrait = portraitForPlayer(player, roster);
  const uploaded = safeURL(player?.photoUrl);
  return { src: uploaded || portrait?.src || '', fallbackSrc: portrait?.src || '', custom: !!uploaded };
}
