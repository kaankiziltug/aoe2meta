import { GameMode } from "./api/types";

export const GAME_MODES: {
  id: GameMode;
  label: string;
  shortLabel: string;
}[] = [
  { id: "rm-1v1", label: "Random Map 1v1", shortLabel: "RM 1v1" },
  { id: "rm-team", label: "Random Map Team", shortLabel: "RM Team" },
  { id: "ew-1v1", label: "Empire Wars 1v1", shortLabel: "EW 1v1" },
  { id: "ew-team", label: "Empire Wars Team", shortLabel: "EW Team" },
  { id: "dm-1v1", label: "Death Match 1v1", shortLabel: "DM 1v1" },
  { id: "dm-team", label: "Death Match Team", shortLabel: "DM Team" },
  { id: "ror-1v1", label: "Return of Rome 1v1", shortLabel: "RoR 1v1" },
  { id: "ror-team", label: "Return of Rome Team", shortLabel: "RoR Team" },
];

export const CIVILIZATIONS = [
  { id: 1, name: "Britons" },
  { id: 2, name: "Franks" },
  { id: 3, name: "Goths" },
  { id: 4, name: "Teutons" },
  { id: 5, name: "Japanese" },
  { id: 6, name: "Chinese" },
  { id: 7, name: "Byzantines" },
  { id: 8, name: "Persians" },
  { id: 9, name: "Saracens" },
  { id: 10, name: "Turks" },
  { id: 11, name: "Vikings" },
  { id: 12, name: "Mongols" },
  { id: 13, name: "Celts" },
  { id: 14, name: "Spanish" },
  { id: 15, name: "Aztecs" },
  { id: 16, name: "Mayans" },
  { id: 17, name: "Huns" },
  { id: 18, name: "Koreans" },
  { id: 19, name: "Italians" },
  { id: 20, name: "Hindustanis" },
  { id: 21, name: "Incas" },
  { id: 22, name: "Magyars" },
  { id: 23, name: "Slavs" },
  { id: 24, name: "Portuguese" },
  { id: 25, name: "Ethiopians" },
  { id: 26, name: "Malians" },
  { id: 27, name: "Berbers" },
  { id: 28, name: "Khmer" },
  { id: 29, name: "Malay" },
  { id: 30, name: "Burmese" },
  { id: 31, name: "Vietnamese" },
  { id: 32, name: "Bulgarians" },
  { id: 33, name: "Cumans" },
  { id: 34, name: "Lithuanians" },
  { id: 35, name: "Tatars" },
  { id: 36, name: "Burgundians" },
  { id: 37, name: "Sicilians" },
  { id: 38, name: "Poles" },
  { id: 39, name: "Bohemians" },
  { id: 40, name: "Dravidians" },
  { id: 41, name: "Bengalis" },
  { id: 42, name: "Gurjaras" },
  { id: 43, name: "Romans" },
  { id: 44, name: "Armenians" },
  { id: 45, name: "Georgians" },
] as const;

export const MAPS = [
  "Arabia",
  "Arena",
  "Black Forest",
  "Islands",
  "Nomad",
  "Hideout",
  "Runestones",
  "Four Lakes",
  "Golden Pit",
  "Megarandom",
  "Steppe",
  "Team Islands",
  "Continental",
  "Migration",
  "Baltic",
  "Scandinavia",
  "Yucatan",
  "Ghost Lake",
  "Mongolia",
  "Socotra",
] as const;

export const COUNTRIES: Record<string, string> = {
  NO: "Norway",
  CA: "Canada",
  DE: "Germany",
  AT: "Austria",
  CN: "China",
  FI: "Finland",
  VN: "Vietnam",
  AR: "Argentina",
  BR: "Brazil",
  ES: "Spain",
  FR: "France",
  US: "United States",
  GB: "United Kingdom",
  JP: "Japan",
  KR: "South Korea",
  RU: "Russia",
  TR: "Turkey",
  AU: "Australia",
  SE: "Sweden",
  PL: "Poland",
};

export function getCountryFlag(code: string): string {
  const codePoints = code
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp * 1000) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function formatWinRate(wins: number, total: number): string {
  if (total === 0) return "0%";
  return `${((wins / total) * 100).toFixed(1)}%`;
}

// Normalize civ name variants (aocref uses "Maya"/"Inca", CDN uses "mayans"/"incas")
const CIV_SLUG_OVERRIDES: Record<string, string> = {
  maya:  "mayans",
  inca:  "incas",
};

/** Returns the AoE2Companion CDN URL for a civilization icon */
export function getCivImageUrl(civName: string): string {
  const raw  = civName.toLowerCase().replace(/\s+/g, "_");
  const slug = CIV_SLUG_OVERRIDES[raw] ?? raw;
  return `https://backend.cdn.aoe2companion.com/public/aoe2/de/civilizations/${slug}.png`;
}
