/**
 * GOV Groups Configuration for 3-of-3 Multisig (WILL + WISDOM + LOVE)
 * 
 * 11 GOV members across 3 groups. Each mint request needs 1 signature from each group.
 * All addresses must be registered on-chain via govRegisterAttester() before use.
 */

export type GovGroupName = "will" | "wisdom" | "love";

export interface GovMember {
  address: string;
  name: string;
  group: GovGroupName;
}

export interface GovGroup {
  name: GovGroupName;
  label: string;
  emoji: string;
  description: string;
  members: GovMember[];
}

// ============================================
// GOV GROUP DEFINITIONS
// ============================================

export const GOV_GROUPS: Record<GovGroupName, GovGroup> = {
  will: {
    name: "will",
    label: "Ý Chí",
    emoji: "💪",
    description: "Kỹ thuật & Ý chí",
    members: [
      { address: "0xe32d50a0badE4cbD5B0d6120d3A5FD07f63694f1", name: "Minh Trí", group: "will" },
      { address: "0xfd0Da7a744245e7aCECCd786d5a743Ef9291a557", name: "Ánh Nguyệt", group: "will" },
      { address: "0x02D5578173bd0DB25462BB32A254Cd4b2E6D9a0D", name: "Thu Trang", group: "will" },
    ],
  },
  wisdom: {
    name: "wisdom",
    label: "Trí Tuệ",
    emoji: "🌟",
    description: "Tầm nhìn chiến lược",
    members: [
      { address: "0xCa319fBc39F519822385F2D0a0114B14fa89A301", name: "Bé Giàu", group: "wisdom" },
      { address: "0xDf8249159BB67804D718bc8186f95B75CE5ECbe8", name: "Bé Ngọc", group: "wisdom" },
      { address: "0x5102Ecc4a458a1af76aFA50d23359a712658a402", name: "Ái Vân", group: "wisdom" },
    ],
  },
  love: {
    name: "love",
    label: "Yêu Thương",
    emoji: "❤️",
    description: "Nhân ái & Chữa lành",
    members: [
      { address: "0xE418a560611e80E4239F5513D41e583fC9AC2E6d", name: "Thanh Tiên", group: "love" },
      { address: "0x67464Df3082828b3Cf10C5Cb08FC24A28228EFd1", name: "Bé Kim", group: "love" },
      { address: "0x9ec8C51175526BEbB1D04100256De71CF99B7CCC", name: "Bé Hà", group: "love" },
    ],
  },
};

// Flatten all members for quick lookup
const ALL_MEMBERS: GovMember[] = Object.values(GOV_GROUPS).flatMap((g) => g.members);

// Pre-built lookup map (lowercase address → member)
const ADDRESS_MAP = new Map<string, GovMember>(
  ALL_MEMBERS.map((m) => [m.address.toLowerCase(), m])
);

// ============================================
// HELPER FUNCTIONS
// ============================================

/** Get the GOV group name for a wallet address, or null if not a GOV attester */
export function getAttesterGroup(address: string): GovGroupName | null {
  return ADDRESS_MAP.get(address.trim().toLowerCase())?.group ?? null;
}

/** Get the display name for a GOV attester address */
export function getAttesterName(address: string): string | null {
  return ADDRESS_MAP.get(address.trim().toLowerCase())?.name ?? null;
}

/** Check if an address is a registered GOV attester */
export function isGovAttester(address: string): boolean {
  return ADDRESS_MAP.has(address.trim().toLowerCase());
}

/** Get full member info for an address */
export function getGovMember(address: string): GovMember | null {
  return ADDRESS_MAP.get(address.trim().toLowerCase()) ?? null;
}

/** Get all members of a specific group */
export function getGroupMembers(group: GovGroupName): GovMember[] {
  return GOV_GROUPS[group]?.members ?? [];
}

/** Get all GOV member addresses (for contract registration) */
export function getAllAttesterAddresses(): string[] {
  return ALL_MEMBERS.map((m) => m.address);
}

/** Required group order for on-chain submission: [WILL, WISDOM, LOVE] */
export const SIGNATURE_ORDER: GovGroupName[] = ["will", "wisdom", "love"];

/** Required number of groups (3-of-3) */
export const REQUIRED_SIGNATURES = 3;
