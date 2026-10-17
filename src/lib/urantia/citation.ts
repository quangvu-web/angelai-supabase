import type { UrantiaCitation } from "./types";

const PARA_ID = /^\d{1,3}:\d+\.\d+$/;

export function isValidUrantiaCitation(value: unknown): value is UrantiaCitation {
  const c = value as Partial<UrantiaCitation> | null;
  return !!c && c.corpus === "urantia" && (c.language === "vi" || c.language === "en") &&
    typeof c.edition === "string" && !!c.edition.trim() && typeof c.source_version === "string" && !!c.source_version.trim() && typeof c.paper_number === "number" && Number.isInteger(c.paper_number) &&
    typeof c.section_number === "number" && Number.isInteger(c.section_number) && typeof c.document_id === "string" && !!c.document_id &&
    typeof c.version_id === "string" && !!c.version_id && PARA_ID.test(c.paragraph_start ?? "") &&
    PARA_ID.test(c.paragraph_end ?? "");
}

export function formatUrantiaCitation(citation: UrantiaCitation): string | null {
  if (!isValidUrantiaCitation(citation)) return null;
  const range = citation.paragraph_start === citation.paragraph_end ? citation.paragraph_start : `${citation.paragraph_start}–${citation.paragraph_end}`;
  const paper = citation.paper_number === 0 ? "Foreword" : `Paper ${citation.paper_number}`;
  return `[${paper} · Section ${citation.section_number} · ${range}]`;
}

export function formatUrantiaCitations(citations: readonly UrantiaCitation[]): string[] {
  return citations.map(formatUrantiaCitation).filter((value): value is string => value !== null);
}

export type CitationSource = { handle: string; citation: UrantiaCitation };

export function validateCitationHandles(text: string, sources: readonly CitationSource[]) {
  const allowlist = new Map(sources.filter((s) => /^U_[A-Za-z0-9_-]{4,80}$/.test(s.handle) && isValidUrantiaCitation(s.citation)).map((s) => [s.handle, s.citation]));
  const requested = [...text.matchAll(/\[\[([A-Za-z0-9_-]+)\]\]/g)].map((match) => match[1]);
  const validHandles = [...new Set(requested.filter((handle) => allowlist.has(handle)))];
  return {
    text: text.replace(/\[\[[A-Za-z0-9_-]+\]\]/g, "").replace(/\[(?:Paper \d+|Foreword) · Section [^\]]+\]/g, "").trim(),
    validated_citations: validHandles.map((handle) => allowlist.get(handle)!),
    invalid_handles: [...new Set(requested.filter((handle) => !allowlist.has(handle)))],
  };
}
