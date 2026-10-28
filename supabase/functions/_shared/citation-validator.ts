export interface ValidatedCitation {
  corpus: "urantia"; language: "vi" | "en"; edition: string; source_version: string;
  part_number: number | null; paper_number: number; paper_title: string; section_number: number;
  section_title: string; paragraph_start: string; paragraph_end: string; document_id: string; version_id: string;
}
export interface RetrievedSource { handle: string; citation: ValidatedCitation }
const PARA=/^\d{1,3}:\d+\.\d+$/;
export function validCitation(c: ValidatedCitation): boolean {
  return c.corpus==="urantia" && (c.language==="vi"||c.language==="en") && !!c.edition?.trim() && !!c.source_version?.trim() &&
    Number.isInteger(c.paper_number) && Number.isInteger(c.section_number) && !!c.paper_title?.trim() && !!c.section_title?.trim() &&
    PARA.test(c.paragraph_start) && PARA.test(c.paragraph_end) && !!c.document_id && !!c.version_id;
}
export function validateModelCitations(text: string, sources: readonly RetrievedSource[]) {
  const allowed=new Map(sources.filter(s=>/^U_[A-Za-z0-9_-]{4,80}$/.test(s.handle)&&validCitation(s.citation)).map(s=>[s.handle,s.citation]));
  const requested=[...text.matchAll(/\[\[([A-Za-z0-9_-]+)\]\]/g)].map(m=>m[1]);
  const handles=[...new Set(requested.filter(h=>allowed.has(h)))];
  return {validated_citations:handles.map(h=>allowed.get(h)!),invalid_handles:[...new Set(requested.filter(h=>!allowed.has(h)))]};
}
export function citationSseEvent(citations: readonly ValidatedCitation[]): string {
  return `data: ${JSON.stringify({type:"validated_citations",validated_citations:citations})}\n\n`;
}
