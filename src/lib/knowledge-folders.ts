// Canonical export labels and explicitly approved legacy aliases; never fuzzy-match.
export const KNOWLEDGE_FOLDER_NAMES = [
  "Hồ sơ dự án", "Vương Quốc FUN", "Camly Coin", "FUN Money", "FUN Wallet",
  "Angel AI", "FUN Profile", "FUN Academy", "Green Earth", "FUN Cosmos",
  "FUN Charity", "FUN Play", "FUN Farm", "LoveHUB", "Các bài viết của Father",
  "Các bài viết của Founder Camly Duong", "Các bài dẫn thiền", "PLP", "Sách Urantia", "Các tài liệu khác",
] as const;

export const KNOWLEDGE_FOLDER_ALIASES: Record<string, string> = {
  "Bài viết của Cha": "Các bài viết của Father",
  "Bài viết Ms. Camly Dương": "Các bài viết của Founder Camly Duong",
  "Hướng dẫn Thiền": "Các bài dẫn thiền", "FUN KINGDOM": "Vương Quốc FUN",
  "FUNCOSMOS": "FUN Cosmos", "PLP Documents": "PLP", "PPLP Documents": "PLP",
  "Du hành vũ trụ": "Các bài dẫn thiền", "Linh hồn có sứ mệnh": "Các bài dẫn thiền",
  "Love House Hoi An": "Các bài dẫn thiền", "Luat hap dan": "Các bài dẫn thiền",
  "Ms Camly Duong dan thien": "Các bài dẫn thiền", "Nang cao": "Các bài dẫn thiền",
  "Rat de": "Các bài dẫn thiền", "Bai le": "Các bài dẫn thiền",
  "Cha qua Be Ly dan thien": "Các bài dẫn thiền",
  "Telegram / CAMLY COIN CHANNEL": "Các tài liệu khác",
  "Telegram / angelKNOWLEDGE": "Các tài liệu khác",
  "Telegram / angelknownledge": "Các tài liệu khác",
  "Telegram / KNOWLEDGE ANGEL AI": "Các tài liệu khác",
  "Telegram / Channel -1003710799723": "Các tài liệu khác",
  "Telegram / ✨Camly Coin - EXCHANGE 🍀 💰": "Các tài liệu khác",
  "Telegram / ✨Camly Coin - EXCHANGE": "Các tài liệu khác",
  "Tài liệu chung": "Các tài liệu khác", "Tài liệu khác": "Các tài liệu khác",
};
export const knowledgeFolderKey = (name: string) => name.normalize("NFC").trim().replace(/^Các\s+/i, "").toLocaleLowerCase("vi");
const key = knowledgeFolderKey;
const lookup = new Map<string, string>([
  ...KNOWLEDGE_FOLDER_NAMES.map((name): [string, string] => [key(name), name]),
  ...Object.entries(KNOWLEDGE_FOLDER_ALIASES).map(([alias, name]): [string, string] => [key(alias), name]),
]);

export function canonicalKnowledgeFolder(name: string): string | null {
  return lookup.get(key(name)) ?? null;
}