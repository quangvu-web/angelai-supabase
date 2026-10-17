import type { UrantiaChunk, UrantiaDocument, UrantiaManifest, UrantiaParagraph, UrantiaSection } from "./types";

const PAPER = /^#{0,3}\s*(?:PAPER|BÀI|BAI)\s+(\d{1,3})\s*[-–—.:]?\s*(.*)$/iu;
const FOREWORD = /^#{0,3}\s*(?:FOREWORD|LỜI\s+NÓI\s+ĐẦU|LOI\s+NOI\s+DAU)\s*[-–—.:]?\s*(.*)$/iu;
const PART = /^#{0,3}\s*(?:PART|PHẦN|PHAN)\s+(?:I|II|III|IV|[1-4])\b/iu;
const SECTION = /^#{0,4}\s*(?:SECTION|MỤC|MUC)\s+(\d+)\s*[-–—.:]?\s*(.*)$/iu;
const PARA = /^(\d{1,3}:\d+\.\d+)\s+(.+)$/u;

export async function sha256(value: string): Promise<string> {
  const normalized = value.normalize("NFC");
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function partFromPaper(paper: number): number | null {
  if (paper === 0) return null;
  if (paper <= 31) return 1;
  if (paper <= 56) return 2;
  if (paper <= 119) return 3;
  return paper <= 196 ? 4 : null;
}

async function finalizeDocument(doc: Omit<UrantiaDocument, "contentHash">): Promise<UrantiaDocument> {
  const canonical = doc.sections.flatMap((s) => s.paragraphs.map((p) => `${p.id} ${p.text}`)).join("\n");
  return { ...doc, contentHash: await sha256(canonical) };
}

export async function parseUrantiaText(source: string, opts: { requireComplete?: boolean; maxChunkChars?: number } = {}): Promise<UrantiaManifest> {
  const text = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").normalize("NFC");
  const errors: UrantiaManifest["errors"] = [];
  const drafts: Array<Omit<UrantiaDocument, "contentHash">> = [];
  let current: Omit<UrantiaDocument, "contentHash"> | null = null;
  let section: UrantiaSection | null = null;
  let lastParagraph: UrantiaParagraph | null = null;
  let explicitPart: number | null = null;

  const ensureSection = () => {
    if (!current) return null;
    if (!section) {
      section = { number: 0, title: "", paragraphs: [] };
      current.sections.push(section);
    }
    return section;
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (PART.test(line)) {
      const token = line.match(/(?:PART|PHẦN|PHAN)\s+(I|II|III|IV|[1-4])/iu)?.[1]?.toUpperCase();
      explicitPart = token ? ({ I: 1, II: 2, III: 3, IV: 4 }[token] ?? Number(token)) : null;
      continue;
    }
    const fw = line.match(FOREWORD);
    const pm = line.match(PAPER);
    if (fw || pm) {
      const paperNumber = fw ? 0 : Number(pm![1]);
      current = {
        kind: fw ? "foreword" : "paper",
        partNumber: fw ? null : (explicitPart ?? partFromPaper(paperNumber)),
        paperNumber,
        paperTitle: (fw ? fw[1] : pm![2]).trim(),
        sections: [],
      };
      drafts.push(current);
      section = null;
      lastParagraph = null;
      continue;
    }
    const sm = line.match(SECTION);
    if (sm && current) {
      section = { number: Number(sm[1]), title: sm[2].trim(), paragraphs: [] };
      current.sections.push(section);
      lastParagraph = null;
      continue;
    }
    const paragraph = line.match(PARA);
    if (paragraph && current) {
      const expectedPaper = Number(paragraph[1].split(":")[0]);
      if (expectedPaper !== current.paperNumber) {
        errors.push({ code: "PARAGRAPH_PAPER_MISMATCH", detail: paragraph[1], paperNumber: current.paperNumber });
      }
      lastParagraph = { id: paragraph[1], text: paragraph[2] };
      ensureSection()!.paragraphs.push(lastParagraph);
      continue;
    }
    if (lastParagraph) lastParagraph.text += `\n${line}`;
  }

  const seenPapers = new Set<number>();
  const duplicatePapers: number[] = [];
  let previousPaper = -1;
  for (const doc of drafts) {
    if (doc.paperNumber < previousPaper) errors.push({ code: "PAPER_OUT_OF_ORDER", detail: `${previousPaper}->${doc.paperNumber}`, paperNumber: doc.paperNumber });
    previousPaper = doc.paperNumber;
    if (seenPapers.has(doc.paperNumber)) duplicatePapers.push(doc.paperNumber);
    seenPapers.add(doc.paperNumber);
    const seenParagraphs = new Set<string>();
    for (const s of doc.sections) {
      let previousOrdinal = 0;
      for (const p of s.paragraphs) {
        if (seenParagraphs.has(p.id)) errors.push({ code: "DUPLICATE_PARAGRAPH", detail: p.id, paperNumber: doc.paperNumber });
        seenParagraphs.add(p.id);
        if (!new RegExp(`^${doc.paperNumber}:\\d+\\.\\d+$`).test(p.id)) errors.push({ code: "INVALID_PARAGRAPH_ID", detail: p.id, paperNumber: doc.paperNumber });
        const [paperSection, ordinalText] = p.id.split(".");
        const sectionNumber = Number(paperSection.split(":")[1]);
        const ordinal = Number(ordinalText);
        if (sectionNumber !== s.number) errors.push({ code: "PARAGRAPH_SECTION_MISMATCH", detail: p.id, paperNumber: doc.paperNumber });
        if (previousOrdinal && ordinal !== previousOrdinal + 1) errors.push({ code: "PARAGRAPH_SEQUENCE_GAP", detail: p.id, paperNumber: doc.paperNumber });
        previousOrdinal = ordinal;
      }
    }
    if (seenParagraphs.size === 0) errors.push({ code: "NO_PARAGRAPHS", detail: `Paper ${doc.paperNumber}`, paperNumber: doc.paperNumber });
  }
  duplicatePapers.forEach((p) => errors.push({ code: "DUPLICATE_PAPER", detail: String(p), paperNumber: p }));

  const missingPapers = Array.from({ length: 197 }, (_, i) => i).filter((p) => !seenPapers.has(p));
  if (opts.requireComplete && missingPapers.length) errors.push({ code: "MISSING_PAPERS", detail: missingPapers.join(",") });
  const documents = await Promise.all(drafts.map(finalizeDocument));
  const chunks: UrantiaChunk[] = [];
  const max = Math.max(opts.maxChunkChars ?? 1800, 200);
  for (const doc of documents) {
    for (const s of doc.sections) {
      let group: UrantiaParagraph[] = [];
      const flush = async () => {
        if (!group.length) return;
        const body = group.map((p) => `${p.id} ${p.text}`).join("\n");
        chunks.push({ paperNumber: doc.paperNumber, sectionNumber: s.number, sectionTitle: s.title, paragraphStart: group[0].id, paragraphEnd: group[group.length - 1].id, paragraphIds: group.map((p) => p.id), text: body, contentHash: await sha256(body) });
        group = [];
      };
      for (const p of s.paragraphs) {
        const candidate = [...group, p].map((x) => `${x.id} ${x.text}`).join("\n");
        if (group.length && candidate.length > max) await flush();
        group.push(p);
      }
      await flush();
    }
  }
  return { sourceHash: await sha256(text), documents, chunks, errors, missingPapers, duplicatePapers: [...new Set(duplicatePapers)], valid: errors.length === 0 };
}

export async function parseUrantiaJson(source: string, opts: { requireComplete?: boolean; maxChunkChars?: number } = {}): Promise<UrantiaManifest> {
  const parsed = JSON.parse(source) as { text?: string; documents?: Array<{ heading: string; sections: Array<{ heading: string; paragraphs: UrantiaParagraph[] }> }> };
  if (typeof parsed.text === "string") return parseUrantiaText(parsed.text, opts);
  if (!Array.isArray(parsed.documents)) throw new Error("INVALID_URANTIA_JSON");
  const lines = parsed.documents.flatMap((d) => [d.heading, ...d.sections.flatMap((s) => [s.heading, ...s.paragraphs.map((p) => `${p.id} ${p.text}`)])]);
  return parseUrantiaText(lines.join("\n"), opts);
}
