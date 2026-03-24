import { MetadataRoute } from "next";

const GAME_MODES = ["rm-1v1", "rm-team", "ew-1v1", "ew-team", "dm-1v1", "dm-team"];

const ALL_CIVS = [
  "armenians", "aztecs", "bengalis", "berbers", "bohemians", "britons",
  "bulgarians", "burgundians", "burmese", "byzantines", "celts", "chinese",
  "cumans", "dravidians", "ethiopians", "franks", "georgians", "goths",
  "gurjaras", "hindustanis", "huns", "incas", "italians", "japanese",
  "khmer", "koreans", "lithuanians", "magyars", "malay", "malians",
  "mayans", "mongols", "persians", "poles", "portuguese", "romans",
  "saracens", "sicilians", "slavs", "spanish", "tatars", "teutons",
  "turks", "vietnamese", "vikings",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: "https://aoe2meta.com",
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1.0,
    },
    {
      url: "https://aoe2meta.com/stats",
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  const leaderboardPages: MetadataRoute.Sitemap = GAME_MODES.map((mode) => ({
    url: `https://aoe2meta.com/leaderboard/${mode}`,
    lastModified: now,
    changeFrequency: "hourly" as const,
    priority: 0.8,
  }));

  const civPages: MetadataRoute.Sitemap = ALL_CIVS.map((civ) => ({
    url: `https://aoe2meta.com/civ/${civ}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...leaderboardPages, ...civPages];
}
