// Utility: extract text content from common document formats in the browser
// Trả về { textContent } cho docx/xlsx/csv/text, hoặc { fileBase64 } cho PDF/json/code

import mammoth from "mammoth";
import * as XLSX from "xlsx";

export interface ExtractedDoc {
  fileName: string;
  mimeType: string;
  /** Đã extract sẵn text ở client (docx, xlsx, csv, txt, code) */
  textContent?: string;
  /** Gửi raw base64 cho server (PDF — Gemini đọc trực tiếp) */
  fileBase64?: string;
  /** Kích thước nguyên gốc (bytes) */
  size: number;
}

export const MAX_DOC_BYTES = 15 * 1024 * 1024; // 15MB

export const ACCEPTED_DOC_EXT = [
  ".pdf", ".docx", ".xlsx", ".xls", ".csv",
  ".txt", ".md", ".markdown", ".log", ".rtf",
  ".json", ".xml", ".yaml", ".yml", ".toml",
  ".html", ".htm",
  ".js", ".ts", ".tsx", ".jsx", ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".cs", ".php", ".sh", ".sql", ".css", ".scss",
];

export const ACCEPT_ATTR = ACCEPTED_DOC_EXT.join(",");

function readArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  });
}

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsText(file);
  });
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function extractDocument(file: File): Promise<ExtractedDoc> {
  if (file.size > MAX_DOC_BYTES) {
    throw new Error(`File "${file.name}" vượt 15MB`);
  }
  const name = file.name.toLowerCase();
  const ext = "." + (name.split(".").pop() || "");
  const base = { fileName: file.name, mimeType: file.type || "application/octet-stream", size: file.size };

  // DOCX
  if (ext === ".docx" || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const buf = await readArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return { ...base, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", textContent: result.value };
  }

  // XLSX / XLS / CSV (qua xlsx)
  if ([".xlsx", ".xls"].includes(ext)) {
    const buf = await readArrayBuffer(file);
    const wb = XLSX.read(buf, { type: "array" });
    const parts: string[] = [];
    for (const sheetName of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
      parts.push(`### Sheet: ${sheetName}\n${csv}`);
    }
    return { ...base, textContent: parts.join("\n\n") };
  }

  // PDF — gửi raw cho Gemini đọc trực tiếp
  if (ext === ".pdf" || file.type === "application/pdf") {
    const buf = await readArrayBuffer(file);
    return { ...base, mimeType: "application/pdf", fileBase64: arrayBufferToBase64(buf) };
  }

  // Text-like (txt/md/csv/json/code/...)
  const TEXT_EXTS = new Set([
    ".txt", ".md", ".markdown", ".log", ".rtf", ".csv",
    ".json", ".xml", ".yaml", ".yml", ".toml",
    ".html", ".htm",
    ".js", ".ts", ".tsx", ".jsx", ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".cs", ".php", ".sh", ".sql", ".css", ".scss",
  ]);
  if (TEXT_EXTS.has(ext) || file.type.startsWith("text/")) {
    const text = await readText(file);
    return { ...base, textContent: text };
  }

  throw new Error(`Định dạng "${ext}" chưa hỗ trợ`);
}
