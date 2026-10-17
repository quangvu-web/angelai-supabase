import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { tryExtractToolCall, stripToolCalls } from "@/lib/coordinatorToolParser";
import {
  classifyCoordinatorIntent,
  FORBIDDEN_TOOLS_WHEN_READ_ONLY,
  type CoordinatorIntent,
} from "@/lib/coordinatorIntent";

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  mode?: string;
  ai_role?: string;
}

interface ProjectContext {
  name: string;
  platform_type: string;
  value_model: string;
  token_flow_model: string;
  vision_statement: string;
  status: string;
}

export interface PendingEvolve {
  messageIndex: number;
  args: any;
  rationale: string;
  originalContent: string | null;
  logId: string | null;
  isDispatching: boolean;
}

function hasTextCorruption(text: string): boolean {
  if (text.includes("\uFFFD")) return true;
  if (
    /[a-zàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]\?\?[a-zàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(
      text,
    )
  )
    return true;
  return false;
}

const LOG = "[CoordinatorLoop]";

export function useCoordinatorChat(projectId: string | undefined) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [pendingEvolve, setPendingEvolve] = useState<PendingEvolve | null>(null);

  const messagesQuery = useQuery({
    queryKey: ["coordinator-chat", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordinator_chat_messages")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as ChatMessage[];
    },
    enabled: !!projectId,
  });

  const streamOnce = useCallback(
    async (
      chatMessages: { role: string; content: string }[],
      mode: string,
      aiRole: string,
      projectContext: ProjectContext,
      intent: CoordinatorIntent,
    ): Promise<string> => {
      if (!session?.access_token) throw new Error("Not authenticated");
      const endpointUrl = `${(import.meta.env.VITE_SUPABASE_URL ?? "")}/functions/v1/coordinator-chat`;
      const resp = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: chatMessages,
          mode,
          ai_role: aiRole,
          project_context: projectContext,
          intent,
        }),
      });

      if (!resp.ok) {
        if (resp.status === 402) throw new Error("⚡ AI credits đã hết.");
        if (resp.status === 429) throw new Error("⏳ Quá nhiều yêu cầu.");
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Error ${resp.status}`);
      }
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              setStreamingContent(fullContent);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      if (hasTextCorruption(fullContent)) {
        const fb = await fetch(endpointUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            messages: chatMessages, mode, ai_role: aiRole,
            project_context: projectContext, intent, stream: false,
          }),
        });
        if (fb.ok) {
          const data = await fb.json();
          if (data.content) {
            fullContent = data.content;
            setStreamingContent(fullContent);
          }
        }
      }
      return fullContent;
    },
    [session],
  );

  const callRepoRead = useCallback(
    async (args: Record<string, unknown> & { action: string }) => {
      if (!session?.access_token) throw new Error("Not authenticated");
      const { data, error } = await supabase.functions.invoke("coordinator-repo-read", {
        body: args,
      });
      if (error) throw error;
      return data;
    },
    [session],
  );

  const sendMessage = useCallback(
    async (
      content: string,
      mode: string,
      aiRole: string,
      projectContext: ProjectContext,
      existingMessages: ChatMessage[],
    ) => {
      if (!projectId || !session?.access_token) return;

      const { error: insertError } = await supabase
        .from("coordinator_chat_messages")
        .insert({
          project_id: projectId,
          user_id: session.user.id,
          role: "user",
          content,
          mode,
          ai_role: aiRole,
        });
      if (insertError) {
        toast.error("Failed to save message");
        return;
      }

      setIsStreaming(true);
      setStreamingContent("");
      setPendingEvolve(null);

      // ---- Phase 3.5 — Intent Firewall (latest message only, no history/mode bias) ----
      const intent: CoordinatorIntent = classifyCoordinatorIntent(content);
      console.log(`[CoordinatorIntent] ${intent}`);

      const chatMessages: { role: string; content: string }[] = [
        ...existingMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content },
      ];

      const readCache = new Map<string, string>();
      let anchorErrorStreak = 0;
      let readOnlyViolations = 0;

      try {
        const MAX_LOOPS = 8;
        let stopped = false;

        for (let i = 0; i < MAX_LOOPS && !stopped; i++) {
          console.log(`${LOG} loop iteration ${i + 1}/${MAX_LOOPS}`);
          const fullContent = await streamOnce(chatMessages, mode, aiRole, projectContext, intent);
          const tool = tryExtractToolCall(fullContent);

          if (!tool) {
            // Plain assistant message — strip any stray fragments just in case.
            const clean = stripToolCalls(fullContent) || fullContent;
            console.log(`${LOG} final: no-tool plain message (${clean.length} chars)`);
            if (clean) {
              await supabase.from("coordinator_chat_messages").insert({
                project_id: projectId, user_id: session.user.id,
                role: "assistant", content: clean, mode, ai_role: aiRole,
              });
            }
            break;
          }

          console.log(`${LOG} tool detected: ${tool.tool}`, tool.args);

          // ---- Phase 3.5 — Read-only firewall (client-side) ----
          if (
            intent === "read_only" &&
            (FORBIDDEN_TOOLS_WHEN_READ_ONLY as readonly string[]).includes(tool.tool)
          ) {
            readOnlyViolations++;
            console.warn(
              `${LOG} BLOCKED ${tool.tool} — intent=read_only (violation #${readOnlyViolations})`,
            );
            // Reset bất kỳ pendingEvolve nào lỡ tồn tại (assert tuyệt đối).
            setPendingEvolve(null);

            if (readOnlyViolations >= 2) {
              // Lần thứ 2 vẫn vi phạm → stop an toàn, trả message giải thích.
              const msg =
                "Yêu cầu này chỉ là tìm/đọc nên Angel không tạo EvolveCard hoặc PR. Kết quả tìm kiếm ở trên.";
              await supabase.from("coordinator_chat_messages").insert({
                project_id: projectId, user_id: session.user.id,
                role: "assistant", content: msg, mode, ai_role: aiRole,
              });
              stopped = true;
              break;
            }
            // Feed error về model, cho 1 lần loop nữa để trả natural language.
            chatMessages.push({ role: "assistant", content: fullContent });
            chatMessages.push({
              role: "user",
              content: `[TOOL ERROR] Modification tools (propose_edit, evolve_workspace) are not allowed for read-only request. Answer with search/read results only — write a plain natural-language reply, no tool call.`,
            });
            setStreamingContent("");
            continue;
          }


          if (tool.tool === "read_file") {
            const path = String(tool.args?.path || "");
            console.log(`${LOG} tool executing via coordinator-repo-read: read_file ${path}`);
            try {
              const data = await callRepoRead({ action: "read_file", path });
              const contentStr = String(data?.content || "");
              if (contentStr) readCache.set(path, contentStr);
              console.log(`${LOG} tool result received: ${contentStr.length} bytes, truncated=${!!data?.truncated}`);
              chatMessages.push({ role: "assistant", content: fullContent });
              chatMessages.push({
                role: "user",
                content: `[TOOL RESULT read_file ${path}]\n\`\`\`\n${contentStr.slice(0, 6000)}\n\`\`\`\n${data?.truncated ? "(truncated)" : ""}\nNow continue: write rationale and the evolve_workspace tool call.`,
              });
              setStreamingContent("");
              continue;
            } catch (err: any) {
              console.warn(`${LOG} tool error read_file:`, err);
              chatMessages.push({ role: "assistant", content: fullContent });
              chatMessages.push({
                role: "user",
                content: `[TOOL ERROR read_file ${path}] ${err?.message || "failed"}. Reconsider or ask user.`,
              });
              setStreamingContent("");
              continue;
            }
          }

          if (tool.tool === "search_repo") {
            const query = String(tool.args?.query || "");
            console.log(`${LOG} tool executing via coordinator-repo-read: search_repo "${query}"`);
            try {
              const data = await callRepoRead({ action: "search_repo", query });
              const items = (data?.items || []).slice(0, 20)
                .map((it: any) => `- ${it.path}`).join("\n");
              console.log(`${LOG} tool result received: ${(data?.items || []).length} matches`);
              chatMessages.push({ role: "assistant", content: fullContent });
              chatMessages.push({
                role: "user",
                content: `[TOOL RESULT search_repo "${query}"]\n${items || "(no matches)"}\nNow continue.`,
              });
              setStreamingContent("");
              continue;
            } catch (err: any) {
              console.warn(`${LOG} tool error search_repo:`, err);
              chatMessages.push({ role: "assistant", content: fullContent });
              chatMessages.push({
                role: "user",
                content: `[TOOL ERROR search_repo] ${err?.message || "failed"}. Reconsider.`,
              });
              setStreamingContent("");
              continue;
            }
          }

          if (tool.tool === "search_symbol") {
            const symbol = String(tool.args?.symbol || "");
            const kind = String(tool.args?.kind || "");
            console.log(`${LOG} tool executing via coordinator-repo-read: search_symbol "${symbol}" kind=${kind || "any"}`);
            try {
              const data = await callRepoRead({ action: "search_symbol", symbol, kind });
              const items = (data?.items || []) as any[];
              const rendered = items.length
                ? items.map((it) => `- ${it.path}${it.line ? `:${it.line}` : ""} [${it.kind}] (${it.source})`).join("\n")
                : "(no matches)";
              console.log(`${LOG} tool result received: ${items.length} symbol matches (source=${data?.source}, rate_limited=${!!data?.rate_limited})`);
              chatMessages.push({ role: "assistant", content: fullContent });
              chatMessages.push({
                role: "user",
                content: `[TOOL RESULT search_symbol "${symbol}"] source=${data?.source}\n${rendered}\nNow continue: read the most relevant file before proposing edits.`,
              });
              setStreamingContent("");
              continue;
            } catch (err: any) {
              console.warn(`${LOG} tool error search_symbol:`, err);
              chatMessages.push({ role: "assistant", content: fullContent });
              chatMessages.push({
                role: "user",
                content: `[TOOL ERROR search_symbol] ${err?.message || "failed"}. Try search_repo or ask user.`,
              });
              setStreamingContent("");
              continue;
            }
          }

          if (tool.tool === "search_route") {
            const path = String(tool.args?.path || "");
            const pageName = String(tool.args?.page_name || "");
            console.log(`${LOG} tool executing via coordinator-repo-read: search_route path="${path}" page="${pageName}"`);
            try {
              const data = await callRepoRead({ action: "search_route", path, page_name: pageName });
              const items = (data?.items || []) as any[];
              const rendered = items.length
                ? items.map((it) => `- ${it.route_path} → <${it.component_name}/> @ ${it.component_file || "(unresolved)"} (in ${it.defined_in})`).join("\n")
                : "(no matches)";
              console.log(`${LOG} tool result received: ${items.length} route matches`);
              chatMessages.push({ role: "assistant", content: fullContent });
              chatMessages.push({
                role: "user",
                content: `[TOOL RESULT search_route]\n${rendered}\nScanned: ${(data?.scanned_files || []).join(", ")}\nNow continue.`,
              });
              setStreamingContent("");
              continue;
            } catch (err: any) {
              console.warn(`${LOG} tool error search_route:`, err);
              chatMessages.push({ role: "assistant", content: fullContent });
              chatMessages.push({
                role: "user",
                content: `[TOOL ERROR search_route] ${err?.message || "failed"}.`,
              });
              setStreamingContent("");
              continue;
            }
          }

          if (tool.tool === "search_i18n_key") {
            const key = String(tool.args?.key || "");
            const lang = String(tool.args?.lang || "");
            console.log(`${LOG} tool executing via coordinator-repo-read: search_i18n_key "${key}" lang=${lang || "all"}`);
            try {
              const data = await callRepoRead({ action: "search_i18n_key", key, lang });
              const found = (data?.found_in || []) as any[];
              const missing = (data?.missing_in || []) as string[];
              const foundLine = found.length
                ? found.map((f) => `  ✓ ${f.lang}: ${f.has_value ? `"${f.value_preview}"` : "(empty)"}`).join("\n")
                : "  (none)";
              const missingLine = missing.length ? `\nMissing: ${missing.join(", ")}` : "";
              console.log(`${LOG} tool result received: found=${found.length}, missing=${missing.length}`);
              chatMessages.push({ role: "assistant", content: fullContent });
              chatMessages.push({
                role: "user",
                content: `[TOOL RESULT search_i18n_key "${key}"]\nFound (${found.length}/${data?.scanned_langs || 0}):\n${foundLine}${missingLine}\n${data?.fallback_hint || ""}\nNow continue.`,
              });
              setStreamingContent("");
              continue;
            } catch (err: any) {
              console.warn(`${LOG} tool error search_i18n_key:`, err);
              chatMessages.push({ role: "assistant", content: fullContent });
              chatMessages.push({
                role: "user",
                content: `[TOOL ERROR search_i18n_key] ${err?.message || "failed"}.`,
              });
              setStreamingContent("");
              continue;
            }
          }




          if (tool.tool === "propose_edit") {
            const args = tool.args || {};
            const filePath = String(args.file_path || "");
            const editsRaw = Array.isArray(args.edits) ? (args.edits as any[]) : [];
            const branchName = String(args.branch_name || "");
            const commitMessage = String(args.commit_message || "");

            // Basic shape validation
            if (!filePath || !branchName || !commitMessage) {
              toast.error("propose_edit thiếu file_path/branch_name/commit_message");
              stopped = true;
              break;
            }
            if (editsRaw.length === 0 || editsRaw.length > 5) {
              chatMessages.push({ role: "assistant", content: fullContent });
              chatMessages.push({
                role: "user",
                content: `[TOOL ERROR propose_edit] edits must be 1..5 items (got ${editsRaw.length}). Retry with smaller, focused patches.`,
              });
              setStreamingContent("");
              continue;
            }

            // Ensure originalContent in cache (auto read_file if missing)
            let original = readCache.get(filePath) ?? null;
            if (original === null) {
              console.log(`${LOG} propose_edit: auto-reading ${filePath} (not in cache)`);
              try {
                const data = await callRepoRead({ action: "read_file", path: filePath });
                original = String(data?.content || "");
                if (original) readCache.set(filePath, original);
              } catch (err: any) {
                chatMessages.push({ role: "assistant", content: fullContent });
                chatMessages.push({
                  role: "user",
                  content: `[TOOL ERROR propose_edit] auto-read failed for ${filePath}: ${err?.message || "unknown"}. Call read_file explicitly first.`,
                });
                setStreamingContent("");
                continue;
              }
            }

            // Apply edits sequentially with anchor checks
            const rationaleSoFar = stripToolCalls(fullContent);
            const allowDelete = /\bDELETE\b/.test(rationaleSoFar);
            let buffer = original;
            let anchorError: string | null = null;
            let appliedCount = 0;

            for (let ei = 0; ei < editsRaw.length; ei++) {
              const edit = editsRaw[ei] || {};
              const find = typeof edit.find === "string" ? edit.find : "";
              const replace = typeof edit.replace === "string" ? edit.replace : "";

              if (!find || find.length < 8) {
                anchorError = `edit #${ei + 1} 'find' too short (min 8 chars). Add more context.`;
                break;
              }
              if (replace === "" && !allowDelete) {
                anchorError = `edit #${ei + 1} empty 'replace' requires explicit "DELETE" intent in rationale.`;
                break;
              }
              // Count occurrences (literal)
              let count = 0;
              let idx = 0;
              while ((idx = buffer.indexOf(find, idx)) !== -1) {
                count++;
                idx += find.length;
                if (count > 1) break;
              }
              if (count === 0) {
                anchorError = `edit #${ei + 1} anchor not found. Re-read the file and try again with more context.`;
                break;
              }
              if (count > 1) {
                anchorError = `edit #${ei + 1} anchor not unique (>=2 matches). Add 2-3 surrounding lines of context for uniqueness.`;
                break;
              }
              buffer = buffer.replace(find, replace);
              appliedCount++;
            }

            if (anchorError) {
              anchorErrorStreak++;
              console.warn(`${LOG} propose_edit anchor error (streak=${anchorErrorStreak}): ${anchorError}`);
              if (anchorErrorStreak > 2) {
                toast.error("Không tìm được anchor an toàn — đã dừng.");
                stopped = true;
                break;
              }
              chatMessages.push({ role: "assistant", content: fullContent });
              chatMessages.push({
                role: "user",
                content: `[TOOL ERROR propose_edit] ${anchorError}`,
              });
              setStreamingContent("");
              continue;
            }

            // All edits OK → build synthetic evolve_workspace args
            console.log(`${LOG} propose_edit applied: ${appliedCount}/${editsRaw.length} edits ok`);
            anchorErrorStreak = 0;

            const evolveArgs = {
              file_path: filePath,
              branch_name: branchName,
              commit_message: commitMessage,
              code_content: buffer,
              pr_title: String(args.pr_title || `Angel: update ${filePath}`),
              pr_body: String(args.pr_body || rationaleSoFar || "Angel proposed edit"),
            };

            const persisted = rationaleSoFar || "(Đề xuất sửa code — xem thẻ bên dưới)";
            const { data: savedMsg } = await supabase
              .from("coordinator_chat_messages")
              .insert({
                project_id: projectId, user_id: session.user.id,
                role: "assistant", content: persisted, mode, ai_role: aiRole,
              })
              .select("id")
              .single();

            await queryClient.invalidateQueries({
              queryKey: ["coordinator-chat", projectId],
            });
            const fresh = await queryClient.fetchQuery({
              queryKey: ["coordinator-chat", projectId],
              queryFn: async () => {
                const { data } = await supabase
                  .from("coordinator_chat_messages")
                  .select("*")
                  .eq("project_id", projectId)
                  .order("created_at", { ascending: true });
                return (data ?? []) as ChatMessage[];
              },
            });
            const idx = savedMsg
              ? fresh.findIndex((m) => m.id === savedMsg.id)
              : fresh.length - 1;

            setPendingEvolve({
              messageIndex: idx >= 0 ? idx : fresh.length - 1,
              args: evolveArgs,
              rationale: rationaleSoFar,
              originalContent: original,
              logId: null,
              isDispatching: false,
            });
            console.log(`${LOG} final: pendingEvolve set (file=${filePath}, via propose_edit)`);
            stopped = true;
            break;
          }

          if (tool.tool === "evolve_workspace") {
            const args = tool.args || {};
            const required = ["file_path", "branch_name", "commit_message", "code_content"] as const;
            let valid = true;
            for (const k of required) {
              if (!args[k] || typeof args[k] !== "string") {
                toast.error(`Tool args missing/invalid: ${k}`);
                valid = false;
                break;
              }
            }
            if (!valid) {
              stopped = true;
              break;
            }

            // Persist ONLY the clean rationale — never raw JSON.
            const rationale = stripToolCalls(fullContent);
            const persisted = rationale || "(Đề xuất sửa code — xem thẻ bên dưới)";

            const { data: savedMsg } = await supabase
              .from("coordinator_chat_messages")
              .insert({
                project_id: projectId, user_id: session.user.id,
                role: "assistant", content: persisted, mode, ai_role: aiRole,
              })
              .select("id")
              .single();

            const originalContent = readCache.get(String(args.file_path)) ?? null;

            await queryClient.invalidateQueries({
              queryKey: ["coordinator-chat", projectId],
            });
            const fresh = await queryClient.fetchQuery({
              queryKey: ["coordinator-chat", projectId],
              queryFn: async () => {
                const { data } = await supabase
                  .from("coordinator_chat_messages")
                  .select("*")
                  .eq("project_id", projectId)
                  .order("created_at", { ascending: true });
                return (data ?? []) as ChatMessage[];
              },
            });
            const idx = savedMsg
              ? fresh.findIndex((m) => m.id === savedMsg.id)
              : fresh.length - 1;

            setPendingEvolve({
              messageIndex: idx >= 0 ? idx : fresh.length - 1,
              args,
              rationale,
              originalContent,
              logId: null,
              isDispatching: false,
            });
            console.log(`${LOG} final: pendingEvolve set (file=${args.file_path})`);
            stopped = true;
            break;
          }

          // Should be unreachable since validator restricts to known tools.
          console.warn(`${LOG} unknown tool, stopping`);
          const clean = stripToolCalls(fullContent) || fullContent;
          await supabase.from("coordinator_chat_messages").insert({
            project_id: projectId, user_id: session.user.id,
            role: "assistant", content: clean, mode, ai_role: aiRole,
          });
          break;
        }

        queryClient.invalidateQueries({ queryKey: ["coordinator-chat", projectId] });
      } catch (e: any) {
        console.error(`${LOG} error:`, e);
        toast.error(e?.message || "AI error");
      } finally {
        // Phase 3.5 — assert pendingEvolve null khi read_only
        if (intent === "read_only") {
          setPendingEvolve((prev) => {
            if (prev !== null) {
              console.warn(`[CoordinatorIntent] assert failed: pendingEvolve must be null for read_only`);
            }
            return null;
          });
        }
        setIsStreaming(false);
        setStreamingContent("");
      }
    },
    [projectId, session, queryClient, streamOnce, callRepoRead],
  );

  const approveEvolve = useCallback(async () => {
    if (!pendingEvolve || !session?.access_token) return;
    setPendingEvolve({ ...pendingEvolve, isDispatching: true });
    try {
      toast.message("⚙️ Đang gửi qua Safety Gate…");
      const { data, error } = await supabase.functions.invoke(
        "coordinator-evolve-guard",
        { body: { args: pendingEvolve.args } },
      );
      if (error) throw error;
      if (data?.error) throw new Error(`${data.error}${data.reason ? ` (${data.reason})` : ""}`);
      setPendingEvolve({
        ...pendingEvolve,
        isDispatching: false,
        logId: data?.log_id ?? null,
      });
      toast.success("✅ Đã dispatch. Theo dõi PR trong Audit Panel.");
    } catch (err: any) {
      toast.error(err?.message || "Evolve guard failed");
      setPendingEvolve({ ...pendingEvolve, isDispatching: false });
    }
  }, [pendingEvolve, session]);

  const rejectEvolve = useCallback(() => {
    setPendingEvolve(null);
    toast.message("Đã huỷ đề xuất.");
  }, []);

  return {
    messages: messagesQuery.data ?? [],
    isLoading: messagesQuery.isLoading,
    isStreaming,
    streamingContent,
    sendMessage,
    refetch: messagesQuery.refetch,
    pendingEvolve,
    approveEvolve,
    rejectEvolve,
  };
}
