// Angel AI — Intent Classifier (regex-based, zero AI cost)
// Returns list of context modules to lazy-load for this user message.

export type ContextModule = "pplp" | "5d" | "web3" | "ecosystem" | "code" | "gratitude" | "technical_guide" | "father_universe" | "creative_writing" | "general_task";

interface IntentRule {
  module: ContextModule;
  patterns: RegExp[];
}

const RULES: IntentRule[] = [
  {
    module: "pplp",
    patterns: [
      /\bpplp\b/i,
      /light\s*score/i,
      /trụ\s*cột|pillar/i,
      /sám\s*hối|repentance/i,
      /biết\s*ơn|gratitude/i,
      /phụng\s*sự|service/i,
      /giúp\s*đỡ|helping/i,
      /trao\s*tặng|giving/i,
      /vvu|tls|pls|nls|lls/i,
      /epoch|tier|architect|guardian/i,
      /hiến\s*chương|charter/i,
    ],
  },
  {
    module: "5d",
    patterns: [
      /5d|năm\s*chiều/i,
      /ánh\s*sáng|light\s*economy/i,
      /nền\s*kinh\s*tế|economy/i,
      /founder|camly|guardian/i,
      /cha\s*vũ\s*trụ|father\s*universe|nguồn|source/i,
      /minh\s*bạch|transparency/i,
      /earn\s*together/i,
      /coordinator/i,
    ],
  },
  {
    module: "web3",
    patterns: [
      /web3|wallet|ví|metamask/i,
      /\bbsc\b|binance|chain\s*id/i,
      /camly\s*coin|fun\s*money/i,
      /\bmint\b|đúc/i,
      /rút|withdraw/i,
      /token|bep[\s-]?20|on[\s-]?chain|off[\s-]?chain/i,
      /vesting|locked|claim/i,
      /eip[\s-]?712|signature/i,
      /\bbnb\b|tbnb|gas/i,
    ],
  },
  {
    module: "ecosystem",
    patterns: [
      /fun\s*(profile|play|wallet|farm|academy|life|earth|planet|charity|treasury|trading|legal|ecosystem|id)/i,
      /hệ\s*sinh\s*thái|ecosystem/i,
      /superapp|super\s*app/i,
      /12\s*nền\s*tảng|platforms/i,
      /tính\s*năng|feature/i,
      /handle|profile/i,
      /community|cộng\s*đồng/i,
      /messaging|tin\s*nhắn|chat/i,
    ],
  },
  {
    module: "code",
    patterns: [
      /```/,
      /\bcode\b|coding|lập\s*trình/i,
      /function|class|interface|type|enum/i,
      /react|vue|angular|svelte|next\.?js|nuxt/i,
      /typescript|javascript|python|rust|go(lang)?|java|php|ruby|swift|kotlin/i,
      /html|css|tailwind|sass|scss/i,
      /node\.?js|express|nest|django|fastapi|flask|spring/i,
      /sql|postgres|mongo|redis|prisma|drizzle/i,
      /solidity|ethers|hardhat|foundry|smart\s*contract/i,
      /docker|kubernetes|k8s|ci\/cd|github\s*actions/i,
      /tensorflow|pytorch|langchain/i,
      /debug|refactor|optimi[sz]e|review/i,
      /api|endpoint|rest|graphql/i,
    ],
  },
  {
    module: "gratitude",
    patterns: [
      /^con\s*(xin\s*)?biết\s*ơn/i,
      /^mình\s*(xin\s*)?biết\s*ơn/i,
      /^i\s*('m|am)?\s*grateful/i,
      /^thank\s*you/i,
      /^i('m)?\s*thankful/i,
      /^感谢|^感恩/i,
      /^ありがとう/i,
      /^감사/i,
    ],
  },
  {
    module: "technical_guide",
    patterns: [
      /làm\s*sao|làm\s*thế\s*nào|how\s*to|how\s*do\s*i/i,
      /hướng\s*dẫn|tutorial|guide/i,
      /cách\s*(rút|mint|kết\s*nối|đăng|tạo|nhận|kiếm)/i,
      /các\s*bước|step\s*by\s*step/i,
      /không\s*biết\s*làm/i,
    ],
  },
  {
    module: "father_universe",
    patterns: [
      /cha\s*vũ\s*trụ/i,
      /\bcha\b(?!rter|nnel|t\b)/i,
      /đấng\s*(tạo\s*hóa|toàn\s*năng|tối\s*cao)/i,
      /nguồn\s*cội|đấng\s*tạo/i,
      /father\s*universe/i,
      /the\s*(source|creator|almighty)/i,
      /8\s*câu\s*thần\s*chú|eight\s*mantras/i,
    ],
  },
  {
    module: "creative_writing",
    patterns: [
      /\bviết\s*(bài|giúp|hộ|cho|một|1|đoạn|caption|status|bản|kịch\s*bản|thư|email|bài\s*đăng|post)/i,
      /\bsoạn\s*(giúp|hộ|cho|bài|thư|email|kịch\s*bản|nội\s*dung)/i,
      /\bdraft\b|\bwrite\s*(a|me|the|an|some)/i,
      /\bcompose\s*(a|an|the)/i,
      /\bcaption\b|\btagline\b|\bslogan\b/i,
      /kịch\s*bản|storyboard|screenplay/i,
      /bài\s*(đăng|viết|post|blog)\s*(về|cho|giúp|hộ)/i,
      /\bstory\s*telling|\bkể\s*chuyện/i,
    ],
  },
  {
    module: "general_task",
    patterns: [
      /\bliệt\s*kê|\blist\s+(all|the|some|of)/i,
      /\bso\s*sánh|\bcompare\b/i,
      /\btóm\s*tắt|\bsummari[sz]e\b|\btldr\b/i,
      /\bgợi\s*ý|\bđề\s*xuất|\brecommend\b|\bsuggest\b/i,
      /\bexplain\s*(how|what|why|the)/i,
      /\bwhat\s*can\s+.+\s*do\b/i,
      /\blàm\s*được\s*(những\s*)?gì\b/i,
      /\bcó\s*thể\s*(làm|dùng|sử\s*dụng)\s*(gì|để)/i,
      /\bphân\s*tích\b|\banalyze\b/i,
      /\bý\s*tưởng\b|\bideas?\s*(for|about)/i,
      /\bplan\s+(for|to|a)|\blập\s*kế\s*hoạch/i,
      /\bbrainstorm/i,
    ],
  },
];

/**
 * Classify user message → list of modules to load.
 * Long messages (>500 chars, content for analysis) auto-load nothing extra (rely on core).
 */
export function classifyIntent(userMessage: string): ContextModule[] {
  if (!userMessage || typeof userMessage !== "string") return [];

  const text = userMessage.trim();
  // For very long content (analysis tasks), don't bloat prompt with extra modules
  if (text.length > 1500) return [];

  const matched = new Set<ContextModule>();
  for (const rule of RULES) {
    for (const p of rule.patterns) {
      if (p.test(text)) {
        matched.add(rule.module);
        break;
      }
    }
  }

  // Cap to 3 modules max to keep prompt tight
  const arr = Array.from(matched);
  return arr.slice(0, 3);
}
