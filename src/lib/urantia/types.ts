export type UrantiaLanguage = "vi" | "en";

export interface UrantiaParagraph {
  id: string;
  text: string;
}

export interface UrantiaSection {
  number: number;
  title: string;
  paragraphs: UrantiaParagraph[];
}

export interface UrantiaDocument {
  kind: "foreword" | "paper";
  partNumber: number | null;
  paperNumber: number;
  paperTitle: string;
  sections: UrantiaSection[];
  contentHash: string;
}

export interface UrantiaChunk {
  paperNumber: number;
  sectionNumber: number;
  sectionTitle: string;
  paragraphStart: string;
  paragraphEnd: string;
  paragraphIds: string[];
  text: string;
  contentHash: string;
}

export interface UrantiaManifest {
  sourceHash: string;
  documents: UrantiaDocument[];
  chunks: UrantiaChunk[];
  errors: Array<{ code: string; detail: string; paperNumber?: number }>;
  missingPapers: number[];
  duplicatePapers: number[];
  valid: boolean;
}

export interface UrantiaCitation {
  corpus: "urantia";
  language: UrantiaLanguage;
  edition: string;
  source_version: string;
  part_number: number | null;
  paper_number: number;
  paper_title: string;
  section_number: number;
  section_title: string;
  paragraph_start: string;
  paragraph_end: string;
  document_id: string;
  version_id: string;
}
