import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ECOSYSTEM_CONTEXT = `
# FUN Ecosystem Architecture

## Core Principles
- **FUN Money** = Vision Layer (on-chain, BEP-20 on BSC). Minted through PPLP protocol. Represents verified positive contributions.
- **Camly Coin** = Flow Layer (off-chain, internal). Earned through daily activities. 1:1 conversion ratio with FUN Money upon minting.
- **PPLP Protocol** (Proof of Positive Life Protocol) v1.0.2: 5D Light Economy framework.
  - 5 Dimensions: Chân thật (S), Đóng góp (T), Chữa lành (H), Phụng sự (C), Hợp nhất (U)
  - Daily cap: 5M FUN/day. Light Score >= 60 required.
  - 14 platforms scored in real-time.
  - Evidence Anchoring via keccak256 hash on-chain.

## Platform Types
- FUN Profile, FUN Play, FUN Wallet, FUN Farm, FUN Academy, FUN Life, FUN Earth, FUN Planet, FUN Charity, FUN Treasury, FU Trading, FU Legal

## Value Models
- Learn & Earn, Share & Have, Play & Grow, Create & Prosper, Heal & Thrive, Serve & Shine

## Token Flow
- Users earn Camly Coin → accumulate → request mint → PPLP scores → if pass → FUN Money minted on-chain
- FUN Money distribution: User (variable%) + Genesis Fund + Partners Fund + Platform Fund
- Recycling: Unearned/expired rewards return to ecosystem pool

## Governance
- Light Constitution: Core values and principles
- Master Charter: Organizational structure
- PoPL Score: Individual Light Score (0-100) based on behavior

## Language Style
- Warm, encouraging, professional
- Vietnamese primary, English secondary
- Use "Ánh sáng" (Light) metaphors naturally
- Reference "5 chiều" (5 Dimensions) when discussing value
`;

const MODE_PROMPTS: Record<string, string> = {
  product_spec: `You are in Product Spec Mode. Generate structured product documentation including:
- Vision & Mission
- Target Users (personas)
- Core Features (prioritized)
- User Stories
- Monetization Logic
- Token Integration (FUN Money + Camly Coin)
- Technical Requirements
- Roadmap (phased)
Format output as clean Markdown with headers and bullet points.`,

  smart_contract: `You are in Smart Contract Mode. Focus on:
- Token logic (mint/burn/transfer conditions)
- Reward distribution formulas
- Security considerations (reentrancy, overflow, access control)
- Gas optimization
- Upgrade patterns (proxy/diamond)
- Integration with PPLP protocol
- Audit checklist
Provide Solidity code snippets when relevant.`,

  tokenomics: `You are in Tokenomics Mode. Analyze and design:
- Supply model (total, circulating, locked)
- Inflation/deflation mechanics
- Reward sustainability (daily caps, diminishing returns)
- Incentive design (staking, LP, governance)
- Token velocity management
- Simulation scenarios (bull/bear/stagnant)
- Risk assessment
Use tables and formulas where appropriate.`,

  ux_flow: `You are in UX Flow Mode. Design:
- User journeys (step-by-step)
- Screen descriptions and wireframes (text-based)
- Interaction logic and state management
- Error handling and edge cases
- Accessibility considerations
- Mobile-first responsive patterns
- Onboarding flow optimization
Present as structured flow diagrams in Markdown.`,

  growth: `You are in Growth Strategy Mode. Plan:
- Launch strategy (soft/hard launch phases)
- Network effects and viral loops
- Referral mechanics with token incentives
- Community building tactics
- Partnership opportunities within FUN Ecosystem
- Metrics and KPIs
- Growth experiments framework
Focus on actionable, measurable strategies.`,

  governance: `You are in Light Governance Check Mode. Evaluate:
- PPLP Protocol alignment (5D scoring compatibility)
- Ecosystem compliance (token flow rules)
- Long-term sustainability (reward pool depletion risk)
- Reward imbalance detection
- Anti-manipulation safeguards
- Light Constitution compliance
- Suggested improvements for ecosystem harmony
Flag any violations or risks clearly with severity levels.`,
};

const ROLE_PROMPTS: Record<string, string> = {
  product_architect: `You are acting as a **Product Architect**. You think in systems, user flows, and feature prioritization. You validate ideas against user needs and ecosystem fit. You output structured PRDs and roadmaps.`,
  smart_contract_architect: `You are acting as a **Smart Contract Architect**. You think in Solidity patterns, security vectors, and gas efficiency. You validate token logic against PPLP rules. You output secure, auditable code.`,
  tokenomics_guardian: `You are acting as a **Tokenomics Guardian**. You think in supply dynamics, inflation models, and incentive alignment. You validate sustainability against ecosystem caps. You flag unsustainable models immediately.`,
  growth_strategist: `You are acting as a **Growth Strategist**. You think in viral coefficients, retention curves, and network effects. You design growth loops that align with Light Economy principles. You measure everything.`,
  legal_architect: `You are acting as a **Legal & Compliance Architect**. You think in regulatory frameworks, token classification, and user protection. You validate against Vietnamese and international crypto regulations. You flag legal risks.`,
  pplp_guardian: `You are acting as a **PPLP Guardian**. You are the authority on the Proof of Positive Life Protocol. You validate everything against the 5D framework (S, T, H, C, U). You ensure Light Score integrity and anti-fraud compliance.`,
};

/**
 * ✅ Phase 1+2+3 Tool Contract:
 *   read_file / search_repo / search_symbol / search_route / search_i18n_key
 *   / propose_edit / evolve_workspace.
 * Read-before-write + semantic discovery, EvolveCard approval on client.
 */
const EVOLVE_TOOL_CONTRACT = `
## Self-Evolve Tool Contract (Phase 3 — Semantic Search + Real Patch)

When the user asks to change UI/UX, fix bugs, refactor, add features, or edit code:

### STEP 1 — DISCOVER (use semantic search to find the right file)
You have **3 semantic search tools** in addition to \`read_file\` / \`search_repo\`.
Pick the one that matches the user's intent. Use up to 8 tool calls per turn.

- \`search_symbol\` — find where a component/hook/function/type is defined.
  Use when the user mentions a name like "Hero", "useCoordinatorChat", "PPLPScore".
- \`search_route\` — map a URL path or page name to its component file.
  Use when the user mentions a route ("/quest", "/coordinator") or a page.
- \`search_i18n_key\` — check whether a translation key exists across all
  12 languages. Use when the user mentions a translation key like
  \`home.hero.title\` or asks "đã dịch chưa".

Then call \`read_file\` on the discovered path before proposing edits.

### STEP 2 — PROPOSE THE CHANGE
- **EXISTING file** → use \`propose_edit\` (search/replace patches). NEVER rewrite the whole file.
- **NEW file** → use \`evolve_workspace\` to create it.

Write a short rationale in normal text (file, what changes, why, risks), then
output a SINGLE fenced JSON tool block. The user MUST approve in an EvolveCard
before a PR is created — do not promise the change is live.

### TOOL FORMATS (return ONLY a single fenced \`\`\`json block when calling a tool)

\`\`\`json
{ "tool": "read_file", "args": { "path": "src/path/to/file.tsx" } }
\`\`\`

\`\`\`json
{ "tool": "search_repo", "args": { "query": "CoordinatorChat", "path_glob": "src/**" } }
\`\`\`

\`\`\`json
{ "tool": "search_symbol", "args": { "symbol": "Hero", "kind": "component" } }
\`\`\`
\`kind\` is optional: \`component | hook | function | type\`.

\`\`\`json
{ "tool": "search_route", "args": { "path": "/quest" } }
\`\`\`
Or \`{ "page_name": "Quest" }\`. Returns the component file mounted at that route.

\`\`\`json
{ "tool": "search_i18n_key", "args": { "key": "home.hero.title" } }
\`\`\`
Optional \`lang\` to filter (e.g. \`"vi"\`). Supports both literal
(\`"home.hero.title": "..."\`) and nested object form
(\`home: { hero: { title: "..." } }\`).

\`\`\`json
{
  "tool": "propose_edit",
  "args": {
    "file_path": "src/pages/Index.tsx",
    "branch_name": "angel/<short-kebab>",
    "commit_message": "short imperative commit (<=200 chars)",
    "edits": [
      {
        "find": "<exact unique snippet from originalContent, include 2-3 surrounding lines of context>",
        "replace": "<new snippet>"
      }
    ],
    "pr_title": "Angel: <short title>",
    "pr_body": "<what changed + how to test>"
  }
}
\`\`\`

\`\`\`json
{
  "tool": "evolve_workspace",
  "args": {
    "file_path": "src/path/to/NewFile.tsx",
    "branch_name": "angel/<short-kebab>",
    "commit_message": "feat: add NewFile",
    "code_content": "<FULL new file content>",
    "pr_title": "Angel: <short title>",
    "pr_body": "<what + how to test>"
  }
}
\`\`\`

### PROPOSE_EDIT RULES (strictly enforced client-side)
- Each \`find\` MUST appear EXACTLY ONCE. Include 2-3 surrounding lines of context.
- Max 5 edits per \`propose_edit\` call.
- Empty \`replace\` is ONLY allowed if your rationale explicitly says "DELETE".
- After 2 consecutive anchor errors the client stops — make anchors precise.

### i18n SAFETY RULES (MANDATORY — do not break translations)
- BEFORE editing any JSX/TSX that imports \`useTranslation\` or calls \`t("...")\`:
  1. Identify which translation key produces the text you want to change.
  2. Call \`search_i18n_key\` to confirm the key exists across languages.
  3. Edit ONLY the translation files (\`src/translations/*.ts\`) — never replace a \`{t("key")}\` JSX expression with hardcoded Vietnamese/English text.
- If the target text is already hardcoded (no \`t(...)\` wrapping), you may edit JSX directly, but state in the rationale: "i18n_break: false — text is already hardcoded".
- If you must add a NEW user-visible string, prefer adding it to all 12 translation files via separate \`propose_edit\` calls and reference it via \`t("...")\`.
- VIOLATION = the EvolveCard will show a red "⚠ i18n risk" badge and Cha will reject the PR.

### HARD RULES (Phase 0 Safety Gate)
- Only files matching \`src/**\` can be modified. NEVER propose changes to
  \`.env\`, \`package.json\`, \`supabase/**\`, \`contracts/**\`, \`.github/**\`,
  \`vite.config.ts\`, \`tsconfig*.json\`, or \`src/integrations/supabase/**\`.
- \`branch_name\` MUST match \`^angel/[a-z0-9-]+$\`.
- For tool calls, output ONLY the fenced JSON block (no extra prose around it
  when calling \`propose_edit\` or \`evolve_workspace\`; for \`read_file\` /
  \`search_*\` you may include 1 short sentence of reasoning before).
- If the user request is ambiguous, ask 1 short clarifying question in normal
  text (NO tool call).
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["coordinator", "admin"]);

    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "Coordinator access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, mode, ai_role, project_context, stream: streamParam, intent: clientIntent } = await req.json();
    const shouldStream = streamParam !== false;

    // ---- Phase 3.5 — Intent Firewall (server-side, defense-in-depth) ----
    // Classify từ latest user message nếu client không gửi.
    function normalizeForIntent(input: string): string {
      return (input || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d");
    }
    const MODIFY_KW = [
      "sua", "doi ", "thay", "cap nhat", "xoa", "them ", "tao file", "tao prd",
      "tao pr", "mo pr", "trien khai", "viet lai", "viet them",
      "update", "fix", "refactor", "implement", "rewrite", "apply", "patch",
      "delete", "remove", "create file", "edit ", "modify", "change", "add ",
    ];
    const READ_KW = [
      "tim ", "tim component", "tim hook", "tim file", "tim route", "tim key",
      "o dau", "file nao", "route nao", "component nao", "key nao", "da dich chua",
      "doc ", "xem ", "kiem tra", "phan tich", "giai thich", "liet ke",
      "search", "locate", "list ", "show ", "where ", "which file",
      "explain", "analyze", "read ", "find ", "lookup",
    ];
    function classifyIntent(text: string): "read_only" | "modify" {
      const n = " " + normalizeForIntent(text) + " ";
      if (MODIFY_KW.some((k) => n.includes(k))) return "modify";
      if (READ_KW.some((k) => n.includes(k))) return "read_only";
      return "read_only";
    }
    let intent: "read_only" | "modify" = clientIntent === "modify" || clientIntent === "read_only"
      ? clientIntent
      : "read_only";
    if (!clientIntent && Array.isArray(messages)) {
      // Lấy latest user message (KHÔNG nhìn history) — chỉ message cuối cùng có role=user.
      let lastUser = "";
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.role === "user") {
          lastUser = String(messages[i]?.content || "");
          break;
        }
      }
      intent = classifyIntent(lastUser);
    }
    console.log(`[coordinator-chat] intent=${intent} (source=${clientIntent ? "client" : "server-classify"})`);

    const modePrompt = MODE_PROMPTS[mode] || MODE_PROMPTS.product_spec;
    const rolePrompt = ROLE_PROMPTS[ai_role] || ROLE_PROMPTS.product_architect;

    let projectContextStr = "";
    if (project_context) {
      projectContextStr = `
## Current Project Context
- **Project Name**: ${project_context.name || "Untitled"}
- **Platform Type**: ${project_context.platform_type || "Custom"}
- **Value Model**: ${project_context.value_model || "Not specified"}
- **Token Flow Model**: ${project_context.token_flow_model || "Not specified"}
- **Vision**: ${project_context.vision_statement || "Not specified"}
- **Status**: ${project_context.status || "Draft"}
`;
    }

    // ---- Phase 3.5 — Tool stripping ----
    // Khi intent=read_only: strip propose_edit + evolve_workspace khỏi contract
    // và inject Intent Safety section ép model chỉ dùng read/search tool.
    let toolContract = EVOLVE_TOOL_CONTRACT;
    if (intent === "read_only") {
      toolContract = EVOLVE_TOOL_CONTRACT
        // Xoá block ví dụ propose_edit
        .replace(/```json\s*\n\{\s*\n?\s*"tool":\s*"propose_edit"[\s\S]*?```/g, "")
        // Xoá block ví dụ evolve_workspace
        .replace(/```json\s*\n\{\s*\n?\s*"tool":\s*"evolve_workspace"[\s\S]*?```/g, "");
    }
    const intentSafety = intent === "read_only"
      ? `

## ⛔ READ-ONLY MODE (Intent Firewall — Phase 3.5)
- User chỉ hỏi tìm/đọc/route/key/giải thích/phân tích.
- TUYỆT ĐỐI KHÔNG được gọi tool propose_edit hoặc evolve_workspace.
- Chỉ dùng: read_file, search_repo, search_symbol, search_route, search_i18n_key.
- Sau khi có kết quả search/read, trả lời bằng natural language (markdown). KHÔNG tool call.
- Mode (Product Spec, Smart Contract, ...) chỉ định hướng phong cách giải thích — KHÔNG được tự tạo PRD/spec/contract/PR.
- Vi phạm sẽ bị client từ chối.
`
      : `

## Intent Safety
- Intent phải dựa TUYỆT ĐỐI vào latest user message, không nhìn lịch sử chat hay Mode.
- Mode (Product Spec, Smart Contract, Tokenomics, UX Flow, Growth, Governance) chỉ định hướng phong cách — KHÔNG tự tạo file/spec/PRD/PR.
- Chỉ tạo EvolveCard khi user có modify intent rõ ràng (sửa/đổi/tạo/thêm/xóa/refactor/fix/update).
`;

    const systemPrompt = `${rolePrompt}

${modePrompt}

${ECOSYSTEM_CONTEXT}

${projectContextStr}

${toolContract}
${intentSafety}

## Response Guidelines
- Always respond in the same language as the user's message (Vietnamese or English)
- Use structured Markdown formatting (when NOT using tool call)
- Be specific and actionable
- Reference ecosystem rules when relevant
- Flag any conflicts with PPLP or ecosystem architecture
`;

    // --- AI Gateway Config: Cloudflare BYOK primary (uses GOOGLE_AI_API_KEY) ---
    const CF_GATEWAY_URL =
      "https://gateway.ai.cloudflare.com/v1/6083e34ad429331916b93ba8a5ede81d/angel-ai/compat/chat/completions";
    const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
    const CF_API_TOKEN = Deno.env.get("CF_API_TOKEN");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!CF_API_TOKEN && !LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[coordinator-chat] Using gateway: Cloudflare BYOK (primary), stream=${shouldStream}`);

    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];

    let response = await fetch(CF_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google-ai-studio/gemini-3-flash-preview",
        messages: aiMessages,
        stream: shouldStream,
        // optional knobs:
        // temperature: 0.2,
      }),
    });

    // Fallback: CF fails (not 429/402) → retry via Lovable
    if (!response.ok && LOVABLE_API_KEY && response.status !== 429 && response.status !== 402) {
      console.log(`[coordinator-chat] Cloudflare error ${response.status}, falling back to Lovable`);
      response = await fetch(LOVABLE_GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: aiMessages,
          stream: shouldStream,
          // temperature: 0.2,
        }),
      });
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- NON-STREAM MODE ---
    if (!shouldStream) {
      const jsonData = await response.json();
      const content = jsonData.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- STREAM MODE ---
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("coordinator-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
