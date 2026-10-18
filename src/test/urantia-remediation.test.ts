import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const read=(p:string)=>readFileSync(resolve(process.cwd(),p),"utf8");
describe("Phase 1A.2 fail-closed remediation",()=>{
 it("guards every policy and locks down all database roles",()=>{
  const sql=read("supabase/migrations/20260901090000_urantia_rag_foundation.sql");
  expect((sql.match(/CREATE POLICY/g)||[]).length).toBe((sql.match(/FROM pg_policies/g)||[]).length);
  expect(sql).toContain("FROM PUBLIC,anon,authenticated");
  expect(sql).toContain("pg_advisory_xact_lock");
  for(const gate of ["DOCUMENT_COUNT_INVALID","FOREWORD_MISSING","PAPER_SET_INCOMPLETE","DOCUMENT_INVALID","CHUNK_INVALID","DUPLICATE_SOURCE_HASH","DUPLICATE_DOCUMENT_HASH","DUPLICATE_CHUNK_HASH","EVALUATION_GATE_FAILED"]) expect(sql).toContain(gate);
 });
 it("has guarded, non-destructive security rollback",()=>{
  const sql=read("supabase/migrations/20260901090100_urantia_rag_foundation_rollback.sql");
  expect(sql).toContain("app.target_environment"); expect(sql).not.toMatch(/DROP (TABLE|COLUMN)/i); expect(sql).not.toMatch(/public\s*=\s*true/i);
  expect(sql).not.toMatch(/\bTO anon\b/);
 });
 it("rejects PDF/DOCX before any storage or database client exists",()=>{
  const edge=read("supabase/functions/knowledge-admin-upload/index.ts");
  expect(edge.slice(0,edge.indexOf("createClient(url"))).toContain("UNSUPPORTED_FILE_TYPE");
  expect(edge.match(/\.pdf|\.docx/g)).toBeNull();
 });
 it("emits validated citations as a final SSE event",()=>{
  const server=read("supabase/functions/angel-chat/index.ts");
  expect(server).toContain("citationSseEvent(citationResult.validated_citations)");
  expect(server.indexOf("citationSseEvent(citationResult.validated_citations)")).toBeLessThan(server.indexOf("const marker =",server.indexOf("citationSseEvent(citationResult.validated_citations)")));
 });
});
