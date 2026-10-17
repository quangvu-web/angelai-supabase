import { defineMcp } from "@lovable.dev/mcp-js";
import askAngelTool from "./tools/ask-angel";
import searchKnowledgeTool from "./tools/search-knowledge";
import getPublicProfileTool from "./tools/get-public-profile";

export default defineMcp({
  name: "angel-fun-kingdom-mcp",
  title: "Angel AI · FUN Kingdom",
  version: "0.1.0",
  instructions:
    "Tools for Angel AI — the spiritual assistant of FUN Kingdom. Use `ask_angel` for grounded conversational answers (Cha Vũ Trụ doctrine, PLP, Light economy). Use `search_knowledge` for raw semantic search over the public knowledge base. Use `get_public_profile` to look up a member by handle. Reply in Vietnamese by default; switch to English only if the user writes in English.",
  tools: [askAngelTool, searchKnowledgeTool, getPublicProfileTool],
});
