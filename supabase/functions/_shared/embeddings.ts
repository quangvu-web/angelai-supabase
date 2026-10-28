// Shared embedding helper — triple provider chain with graceful fallback.
// Vector space chuẩn: 1536 dims (OpenAI text-embedding-3-small).
//
// Provider chain (theo `preferred` hoặc mặc định):
//   1. openai_byok  — OPENAI_API_KEY của user, gọi thẳng OpenAI (rẻ nhất, không tốn Lovable credits)
//   2. lovable      — Lovable AI Gateway (openai/text-embedding-3-small)
//   3. google       — Google native gemini-embedding-001 (outputDimensionality=1536)
//
// TẤT CẢ đều trả vector 1536 dims để tương thích cùng vector space với chunks cũ.

import { allowLovableFallback } from "./google-direct.ts";

export const EMBED_DIMS = 1536;

export type EmbedProvider = "openai_byok" | "lovable" | "google" | "none";

export interface EmbedResult {
  vectors: number[][];
  provider: EmbedProvider;
  model: string;
  status: number;
  errors?: string[];
}

const OPENAI_MODEL = "text-embedding-3-small";
const LOVABLE_MODEL = "openai/text-embedding-3-small";
const GOOGLE_MODEL = "gemini-embedding-001";

async function embedOpenAIBYOK(inputs: string[]): Promise<EmbedResult> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) {
    return { vectors: [], provider: "none", model: OPENAI_MODEL, status: 0, errors: ["no_openai_key"] };
  }
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OPENAI_MODEL, input: inputs, dimensions: EMBED_DIMS }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return {
      vectors: [],
      provider: "openai_byok",
      model: OPENAI_MODEL,
      status: res.status,
      errors: [`openai_byok_${res.status}:${t.slice(0, 160)}`],
    };
  }
  const j = await res.json().catch(() => ({}));
  const vectors = ((j?.data ?? []) as Array<{ embedding: number[] }>).map((d) => d.embedding);
  if (vectors.length !== inputs.length || vectors.some((v) => v.length !== EMBED_DIMS)) {
    return {
      vectors: [],
      provider: "openai_byok",
      model: OPENAI_MODEL,
      status: res.status,
      errors: [`openai_byok_bad_shape:got=${vectors.length}/${inputs.length}`],
    };
  }
  return { vectors, provider: "openai_byok", model: OPENAI_MODEL, status: res.status };
}

async function embedLovable(inputs: string[]): Promise<EmbedResult> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return { vectors: [], provider: "none", model: LOVABLE_MODEL, status: 0, errors: ["no_lovable_key"] };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: LOVABLE_MODEL, input: inputs, dimensions: EMBED_DIMS }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return {
      vectors: [],
      provider: "lovable",
      model: LOVABLE_MODEL,
      status: res.status,
      errors: [`lovable_${res.status}:${t.slice(0, 160)}`],
    };
  }
  const j = await res.json().catch(() => ({}));
  const vectors = ((j?.data ?? []) as Array<{ embedding: number[] }>).map((d) => d.embedding);
  if (vectors.length !== inputs.length || vectors.some((v) => v.length !== EMBED_DIMS)) {
    return {
      vectors: [],
      provider: "lovable",
      model: LOVABLE_MODEL,
      status: res.status,
      errors: [`lovable_bad_shape:got=${vectors.length}/${inputs.length}`],
    };
  }
  return { vectors, provider: "lovable", model: LOVABLE_MODEL, status: res.status };
}

async function embedGoogleNative(
  inputs: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): Promise<EmbedResult> {
  const key = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!key) return { vectors: [], provider: "none", model: GOOGLE_MODEL, status: 0, errors: ["no_google_key"] };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:batchEmbedContents?key=${key}`;
  const body = {
    requests: inputs.map((text) => ({
      model: `models/${GOOGLE_MODEL}`,
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: EMBED_DIMS,
    })),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return {
      vectors: [],
      provider: "google",
      model: GOOGLE_MODEL,
      status: res.status,
      errors: [`google_${res.status}:${t.slice(0, 160)}`],
    };
  }
  const j = await res.json().catch(() => ({}));
  const embs = (j?.embeddings ?? []) as Array<{ values?: number[] }>;
  const vectors = embs.map((e) => e.values ?? []);
  if (vectors.length !== inputs.length || vectors.some((v) => v.length !== EMBED_DIMS)) {
    return {
      vectors: [],
      provider: "google",
      model: GOOGLE_MODEL,
      status: res.status,
      errors: [`google_bad_shape:got=${vectors.length}/${inputs.length}`],
    };
  }
  return { vectors, provider: "google", model: GOOGLE_MODEL, status: res.status };
}

/**
 * Embed với thứ tự ưu tiên: OpenAI BYOK → Google native → Lovable Gateway (chỉ khi được phép).
 * Tất cả trả về 1536 dims → cùng vector space với chunks OpenAI hiện có.
 * Lovable là tầng duy nhất tốn credit nên chỉ dùng khi admin mở khoá (allowLovableFallback).
 * `preferred` cho phép query-time chọn provider cụ thể (rất hiếm dùng).
 */
export async function embedTexts(
  inputs: string[],
  opts: {
    taskType?: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";
    preferred?: EmbedProvider;
  } = {},
): Promise<EmbedResult> {
  if (inputs.length === 0) return { vectors: [], provider: "none", model: "", status: 200 };
  const taskType = opts.taskType ?? "RETRIEVAL_DOCUMENT";
  const errors: string[] = [];

  const defaultOrder: EmbedProvider[] = ["openai_byok", "google", "lovable"];
  const order: EmbedProvider[] = opts.preferred
    ? [opts.preferred, ...defaultOrder.filter((p) => p !== opts.preferred)]
    : defaultOrder;

  for (const p of order) {
    let r: EmbedResult;
    if (p === "openai_byok") r = await embedOpenAIBYOK(inputs);
    else if (p === "google") r = await embedGoogleNative(inputs, taskType);
    else if (p === "lovable") {
      if (!(await allowLovableFallback())) {
        errors.push("lovable_blocked_by_lock");
        continue;
      }
      r = await embedLovable(inputs);
    } else continue;

    if (r.vectors.length === inputs.length) {
      return { ...r, errors: errors.length ? errors : undefined };
    }
    if (r.errors) errors.push(...r.errors);
  }

  return { vectors: [], provider: "none", model: "", status: 0, errors };
}

