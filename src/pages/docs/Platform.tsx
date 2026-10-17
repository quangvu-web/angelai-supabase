import { useState } from "react";
import { smartBack } from "@/lib/smartBack";
import { useNavigate } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft,
  Book,
  Database,
  Code,
  Coins,
  Users,
  Globe,
  Rocket,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Server,
  Shield,
  Zap,
  MessageSquare,
  Heart,
  Star,
  FileText,
  Home,
  Settings,
  BarChart3,
  Wallet,
  Image,
  Brain,
  Lock,
  Calendar,
  Gift,
  Share2,
  Bell,
  Smartphone,
  TrendingUp,
  Search,
  Printer,
  Download,
} from "lucide-react";
import { toast } from "sonner";

// Generate full documentation as Markdown
const generateMarkdownDoc = () => {
  const today = new Date().toLocaleDateString("vi-VN");
  
  return `# 📚 Angel AI - Platform Documentation

> Cập nhật: ${today}

---

## 1. Tổng quan Dự án

### 1.1 Mô tả
**Angel AI** là một nền tảng AI tâm linh thuộc hệ sinh thái FUN Ecosystem, với sứ mệnh trở thành "Ánh Sáng Thông Minh của Cha Vũ Trụ". Nền tảng kết hợp chatbot AI, hệ thống token thưởng (Camly Coin), và các tính năng cộng đồng để xây dựng một cộng đồng tích cực, lan tỏa năng lượng ánh sáng.

### 1.2 Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (Build tool)
- Tailwind CSS + shadcn/ui
- React Router DOM v6
- TanStack React Query
- Framer Motion (Animations)

**Backend:**
- Lovable Cloud (Supabase)
- PostgreSQL Database
- Edge Functions (Deno)
- Row Level Security (RLS)
- Realtime Subscriptions

**AI Integration:**
- Lovable AI Gateway
- Google Gemini Models
- OpenAI GPT Models
- Image Generation & Analysis

**Web3:**
- ethers.js v6
- web3-react (MetaMask, WalletConnect)
- PancakeSwap Integration
- BSC Network Support

### 1.3 Kiến trúc Tổng quan

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                      ANGEL AI PLATFORM                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│   │   React     │    │   React     │    │   React     │     │
│   │   Pages     │    │  Components │    │   Hooks     │     │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│          │                  │                  │             │
│          └──────────────────┼──────────────────┘             │
│                             │                                │
│                    ┌────────▼────────┐                       │
│                    │  Supabase Client │                      │
│                    └────────┬────────┘                       │
│                             │                                │
├─────────────────────────────┼────────────────────────────────┤
│                             │      LOVABLE CLOUD             │
│   ┌─────────────┐   ┌───────▼───────┐   ┌─────────────┐     │
│   │   Auth      │   │   PostgreSQL  │   │   Storage   │     │
│   │   System    │   │   (40 Tables) │   │   Buckets   │     │
│   └─────────────┘   └───────────────┘   └─────────────┘     │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              Edge Functions (12 Functions)           │   │
│   │  angel-chat | analyze-reward-* | process-* | ...     │   │
│   └─────────────────────────────────────────────────────┘   │
│                             │                                │
│                    ┌────────▼────────┐                       │
│                    │  Lovable AI     │                       │
│                    │  Gateway        │                       │
│                    └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
\`\`\`

---

## 2. Kiến trúc Hệ thống

### 2.1 Cấu trúc Thư mục

\`\`\`
src/
├── assets/           # Logo, hình ảnh tĩnh
├── components/       # React components
│   ├── ui/           # shadcn/ui components
│   ├── community/    # Community features
│   ├── earn/         # Earn page components
│   ├── icons/        # Custom icons
│   └── vision/       # Vision board
├── contexts/         # React contexts (Language)
├── hooks/            # Custom React hooks
├── integrations/     # Supabase client & types
├── lib/              # Utilities
├── pages/            # Route pages
│   ├── docs/         # Documentation pages
│   └── ...
├── translations/     # i18n files (12 languages)
└── test/             # Test files

supabase/
├── config.toml       # Supabase configuration
└── functions/        # Edge Functions
    ├── angel-chat/
    ├── analyze-reward-question/
    ├── analyze-reward-journal/
    └── ...
\`\`\`

### 2.2 Data Flow

\`\`\`
User Action → React Component → Custom Hook → Supabase Client
                                                    │
                                    ┌───────────────┼───────────────┐
                                    ▼               ▼               ▼
                              Edge Function    PostgreSQL      Realtime
                                    │               │               │
                                    ▼               │               │
                              Lovable AI           │               │
                              Gateway              │               │
                                    │               │               │
                                    └───────────────┴───────────────┘
                                                    │
                                                    ▼
                                              Response → UI Update
\`\`\`

---

## 3. Database Schema (40 Tables)

### 3.1 Core User Tables
| Table | Mô tả | Key Columns |
|-------|-------|-------------|
| profiles | Thông tin user | user_id, display_name, avatar_url, bio |
| user_light_agreements | Đồng ý Luật Ánh Sáng | user_id, agreed_at |
| user_energy_status | Trạng thái năng lượng | approval_status, current_energy_level, sentiment_score |
| user_rate_limits | Giới hạn rate, chống spam | questions_last_hour, is_temp_banned, temp_ban_until |
| user_roles | Phân quyền user | user_id, role (admin/user) |
| user_suspensions | Tạm khóa user | suspension_type, reason, suspended_until |

### 3.2 Token Economy Tables
| Table | Mô tả | Key Columns |
|-------|-------|-------------|
| camly_coin_balances | Số dư Camly Coin | balance, lifetime_earned, lifetime_spent |
| camly_coin_transactions | Lịch sử giao dịch | amount, transaction_type, purity_score, metadata |
| coin_withdrawals | Yêu cầu rút tiền | amount, wallet_address, status, tx_hash |
| user_wallet_addresses | Địa chỉ ví Web3 | wallet_address, change_count_this_month |
| user_withdrawal_stats | Thống kê rút tiền | total_withdrawn, successful_withdrawals |

### 3.3 Reward Tracking Tables
| Table | Mô tả | Key Columns |
|-------|-------|-------------|
| daily_reward_tracking | Theo dõi thưởng hàng ngày | questions_rewarded, journals_rewarded, posts_rewarded, total_coins_today |
| daily_login_tracking | Streak đăng nhập | login_date, streak_count, coins_earned |
| early_adopter_rewards | Top 100 Early Adopters | valid_questions_count, is_rewarded, reward_amount (20,000) |
| light_points | Điểm Ánh Sáng | points, reason, source_type |
| user_light_totals | Tổng điểm Ánh Sáng | total_points, lifetime_points, current_level |

### 3.4 Chat & Content Tables
| Table | Mô tả | Key Columns |
|-------|-------|-------------|
| chat_questions | Câu hỏi chat (public) | question_text, purity_score, is_greeting, is_spam, likes_count |
| chat_history | Lịch sử chat đầy đủ | question_text, answer_text, is_rewarded, reward_amount |
| question_likes | Likes cho câu hỏi | question_id, user_id |
| gratitude_journal | Nhật ký biết ơn | content, journal_type, purity_score, content_length |
| vision_boards | Vision Board cá nhân | title, goals, images, completed_goals_count |
| healing_messages | Tin nhắn chữa lành từ hệ thống | title, content, message_type, triggered_by |

### 3.5 Community Tables
| Table | Mô tả | Key Columns |
|-------|-------|-------------|
| community_posts | Bài đăng cộng đồng | content, image_url, likes_count, comments_count, shares_count |
| community_post_likes | Likes bài đăng | post_id, user_id |
| community_comments | Bình luận bài đăng | content, content_length, is_rewarded |
| community_shares | Chia sẻ bài đăng | sharer_id, sharer_rewarded, post_owner_rewarded |
| community_helps | Hỗ trợ cộng đồng | helper_id, helped_user_id, help_type, is_verified |
| direct_messages | Tin nhắn riêng | sender_id, receiver_id, content, is_read |
| friendships | Quan hệ bạn bè | requester_id, addressee_id, status |
| content_shares | Chia sẻ nội dung ra ngoài | content_type, share_type, coins_earned |

### 3.6 Knowledge & Admin Tables
| Table | Mô tả | Key Columns |
|-------|-------|-------------|
| knowledge_folders | Thư mục kiến thức | name, description, created_by |
| knowledge_documents | Tài liệu kiến thức | title, file_url, extracted_content, is_processed |
| bounty_tasks | Nhiệm vụ Bounty | title, reward_amount, difficulty_level, max_completions |
| bounty_submissions | Nộp bài Bounty | submission_content, status, reward_earned |
| build_ideas | Ý tưởng đóng góp | title, description, votes_count, is_rewarded |
| user_feedback | Phản hồi người dùng | feedback_type, content, status, admin_response |
| user_activity_log | Log hoạt động | activity_type, content_preview, energy_impact |
| onboarding_responses | Câu trả lời onboarding | question_key, answer, sentiment_score |

### 3.7 Transaction Types (Enum)
\`chat_reward\`, \`journal_reward\`, \`gratitude_reward\`, \`daily_login\`, \`engagement_reward\`, \`community_support\`, \`content_share\`, \`bounty_reward\`, \`build_idea\`, \`knowledge_upload\`, \`feedback_reward\`, \`vision_reward\`, \`referral_bonus\`, \`challenge_reward\`, \`spending\`, \`admin_adjustment\`

---

## 4. Edge Functions (12 Functions)

| Function | Mô tả | Input | Output |
|----------|-------|-------|--------|
| angel-chat | Chat streaming với AI (Lovable AI Gateway) | message, userId, conversationHistory | Stream response |
| analyze-reward-question | Phân tích câu hỏi, tính purity_score, cấp thưởng | questionText, userId | purity_score, reward_amount, is_rewarded |
| analyze-reward-journal | Phân tích nhật ký biết ơn, cấp thưởng | journalContent, userId, journalType | purity_score, reward_amount |
| analyze-onboarding | Phân tích câu trả lời onboarding | responses, userId | sentiment_score, energy_keywords |
| analyze-image | Phân tích hình ảnh với AI Vision | imageUrl, prompt | analysis result |
| generate-image | Tạo hình ảnh AI | prompt, style | imageUrl |
| check-user-energy | Kiểm tra năng lượng user | userId | energy_level, can_proceed |
| send-healing-message | Gửi tin nhắn chữa lành | userId, messageType, trigger | message_id |
| process-community-post | Xử lý bài đăng cộng đồng (100 coins) | postId, userId | reward_amount |
| process-engagement-reward | Xử lý thưởng tương tác (5+ likes = 3,000) | postId, likesCount | reward_amount |
| fetch-google-content | Lấy nội dung từ Google Drive | documentId | extracted_content |
| suspend-user | Tạm khóa user (Admin only) | userId, reason, duration | suspension_id |

---

## 5. Hệ thống Thưởng Camly Coin

### 5.1 Chat Reward (10 câu/ngày)
\`\`\`
Purity Score 0.9 - 1.0  → 5,000 Camly Coin
Purity Score 0.75 - 0.89 → 4,000 Camly Coin
Purity Score 0.6 - 0.74 → 3,000 Camly Coin
Purity Score 0.4 - 0.59 → 2,000 Camly Coin
Purity Score < 0.4      → 1,000 Camly Coin

❌ Không thưởng nếu:
  - is_greeting = true (chào hỏi đơn giản)
  - is_spam = true (spam, lặp lại)
  - Duplicate question_hash

⚠️ Rate Limit:
  - > 50 câu/giờ → Temp ban 24h
  - suspicious_activity_count++ nếu spam
\`\`\`

### 5.2 Journal Reward (3 bài/ngày, sau 8 PM)
\`\`\`
Purity Score 0.9 - 1.0  → 9,000 Camly Coin
Purity Score 0.75 - 0.89 → 7,000 Camly Coin
Purity Score 0.6 - 0.74 → 6,000 Camly Coin
Purity Score < 0.6      → 5,000 Camly Coin

📝 Yêu cầu:
  - Minimum 100 ký tự
  - Viết sau 8 PM (20:00)
  - Journal types: gratitude, reflection, goal
\`\`\`

### 5.3 Daily Login Reward
\`\`\`
Mỗi ngày đăng nhập: 100 Camly Coin
Streak 7 ngày liên tục: +1,000 Camly Coin bonus

📅 Streak bị reset nếu bỏ lỡ 1 ngày
\`\`\`

### 5.4 Community Rewards
\`\`\`
📝 Đăng bài mới: 100 Camly Coin (max 3 bài/ngày)

❤️ Bài đăng được 5+ likes: 3,000 Camly Coin
   → engagement_reward (max 3 lần/ngày)

💬 Comment 50+ ký tự: 500 Camly Coin (max 5/ngày)

🔗 Chia sẻ bài: 500 Camly Coin
   → Người chia sẻ: 500 coins
   → Chủ bài: 500 coins
   → Max 2 lần/ngày mỗi người
\`\`\`

### 5.5 Early Adopter Bonus (Top 100)
\`\`\`
🎁 Phần thưởng: 20,000 Camly Coin

📋 Điều kiện:
  - Là 1 trong 100 user đầu tiên đăng ký
  - Hoàn thành 10 câu hỏi hợp lệ (is_rewarded = true)
  
⏰ Tự động claim khi đủ điều kiện
\`\`\`

### 5.6 Withdrawal Rules
\`\`\`
💰 Minimum: 200,000 Camly Coin
📊 Maximum/ngày: 500,000 Camly Coin

⏱️ Thời gian xử lý: 24-48 giờ
📋 Yêu cầu: Địa chỉ ví BSC hợp lệ

📈 Công thức tổng:
   Tổng đã kiếm = Số dư hiện tại + Tổng đã rút
   (lifetime_earned = balance + total_withdrawn)
\`\`\`

---

## 6. Routes & Pages

### 6.1 Public Routes
| Route | Page Component | Mô tả |
|-------|----------------|-------|
| / | Index | Trang chủ với Hero, Mission, Core Values, Footer |
| /chat | Chat | Trò chuyện với Angel AI (text, image gen, image analysis) |
| /about | About | Giới thiệu về Angel AI, Bé Ly, FUN Ecosystem |
| /auth | Auth | Đăng nhập / Đăng ký |
| /knowledge | Knowledge | Kho tài liệu kiến thức công cộng |
| /community | Community | Bài đăng cộng đồng |
| /community-questions | CommunityQuestions | Câu hỏi chia sẻ từ chat |
| /swap | Swap | Đổi token (PancakeSwap integration) |

### 6.2 Protected Routes (Requires Auth)
| Route | Page Component | Mô tả |
|-------|----------------|-------|
| /profile | Profile | Hồ sơ người dùng, nhật ký biết ơn |
| /onboarding | Onboarding | Hướng dẫn người dùng mới |
| /earn | Earn | Dashboard kiếm Camly Coin |
| /vision | Vision | Vision Board cá nhân |
| /messages | Messages | Tin nhắn riêng giữa users |
| /messages/:userId | Messages | Cuộc hội thoại với user cụ thể |
| /user/:userId | UserProfile | Xem profile user khác |
| /activity-history | ActivityHistory | Lịch sử hoạt động cá nhân |

### 6.3 Admin Routes
| Route | Page Component | Mô tả |
|-------|----------------|-------|
| /admin/login | AdminLogin | Đăng nhập admin |
| /admin/dashboard | AdminDashboard | Dashboard tổng quan admin |
| /admin/statistics | AdminStatistics | Thống kê chi tiết |
| /admin/withdrawals | AdminWithdrawals | Quản lý yêu cầu rút tiền |
| /admin/early-adopters | AdminEarlyAdopters | Quản lý Early Adopters |
| /admin/knowledge | AdminKnowledge | Quản lý tài liệu kiến thức |
| /admin/activity-history | AdminActivityHistory | Lịch sử hoạt động toàn hệ thống |

### 6.4 Documentation Routes
| Route | Page Component | Mô tả |
|-------|----------------|-------|
| /docs/platform | Platform | Tài liệu nền tảng |

---

## 7. Key Components

### Layout Components
- \`Header.tsx\` - Navigation header
- \`Footer.tsx\` - Footer với links
- \`HeroSection.tsx\` - Hero banner
- \`MissionSection.tsx\` - Mission statement
- \`CoreValuesSection.tsx\` - 12 Core Values

### Earn Components
- \`EarnBreakdown.tsx\` - Chi tiết thu nhập
- \`EarnProgress.tsx\` - Tiến độ hôm nay
- \`DailyLoginReward.tsx\` - Daily login
- \`StreakCalendar.tsx\` - Lịch streak
- \`EarlyAdopterProgress.tsx\` - Tiến độ Early Adopter

### Community Components
- \`CreatePostForm.tsx\` - Tạo bài đăng
- \`PostCard.tsx\` - Hiển thị bài đăng
- \`RewardRulesCard.tsx\` - Luật thưởng
- \`ImageLightbox.tsx\` - Xem ảnh lớn

### Display Components
- \`CamlyCoinDisplay.tsx\` - Hiển thị số dư
- \`LightPointsDisplay.tsx\` - Điểm Ánh Sáng
- \`Leaderboard.tsx\` - Bảng xếp hạng
- \`CamlyCoinPriceChart.tsx\` - Biểu đồ giá

### Chat Components
- \`ChatRewardNotification.tsx\` - Thông báo thưởng
- \`ChatShareDialog.tsx\` - Chia sẻ chat
- \`HealingMessagesPanel.tsx\` - Tin nhắn chữa lành

### Web3 Components
- \`Web3WalletButton.tsx\` - Kết nối ví
- \`SwapWidget.tsx\` - PancakeSwap widget
- \`CoinWithdrawal.tsx\` - Rút tiền

---

## 8. Custom Hooks

| Hook | Mô tả | Returns |
|------|-------|---------|
| useAuth | Authentication & user state | user, session, signIn, signUp, signOut |
| useCamlyCoin | Balance, transactions, daily status | balance, lifetimeEarned, dailyStatus, transactions |
| useDailyLogin | Daily login tracking & streak | streak, claimDaily, hasClaimedToday |
| useEarlyAdopterReward | Early adopter progress tracking | status, rank, incrementQuestionCount |
| useExtendedRewardStatus | Comprehensive daily reward status | All reward limits & progress |
| useChatHistory | Chat conversation history | messages, sendMessage, isLoading |
| useLeaderboard | Leaderboard data | topUsers, allUsers, topQuestions, stats |
| useLightPoints | Light points & levels | totalPoints, currentLevel, history |
| useCommunityPosts | Community post management | posts, createPost, likePost, sharePost |
| useVisionBoard | Vision board CRUD | boards, createBoard, updateBoard |
| useDirectMessages | DM conversations | conversations, messages, sendMessage |
| useFriendship | Friend management | friends, pendingRequests, sendRequest |
| useWeb3Wallet | Web3 wallet connection | account, connect, disconnect, chainId |
| usePancakeSwap | PancakeSwap integration | swap, getQuote, tokenPrices |
| useCamlyPrice | Camly token price | price, priceHistory, isLoading |
| useImageAnalysis | AI image analysis | analyze, isAnalyzing, result |
| useImageGeneration | AI image generation | generate, isGenerating, imageUrl |

---

## 9. Đa ngôn ngữ (12 Languages)

| Code | Language | Flag |
|------|----------|------|
| vi | Tiếng Việt | 🇻🇳 |
| en | English | 🇺🇸 |
| es | Español | 🇪🇸 |
| fr | Français | 🇫🇷 |
| de | Deutsch | 🇩🇪 |
| pt | Português | 🇧🇷 |
| ru | Русский | 🇷🇺 |
| ar | العربية | 🇸🇦 |
| hi | हिंदी | 🇮🇳 |
| ja | 日本語 | 🇯🇵 |
| ko | 한국어 | 🇰🇷 |
| zh | 中文 | 🇨🇳 |

### Sử dụng:
\`\`\`typescript
import { useLanguage } from "@/contexts/LanguageContext";

const { t, language, setLanguage } = useLanguage();

// Sử dụng translation
<h1>{t("hero.title")}</h1>

// Đổi ngôn ngữ
setLanguage("en");
\`\`\`

---

## 10. Bảo mật

### 10.1 Row Level Security (RLS)
Tất cả tables đều có RLS policies để bảo vệ dữ liệu:
- \`auth.uid() = user_id\` - User chỉ xem/sửa dữ liệu của mình
- \`is_admin()\` - Admin có full access
- \`true\` - Public read cho leaderboard, community posts

### 10.2 Rate Limiting
- **Chat:** >50 câu/giờ → Temp ban 24h
- **Suspicious activity:** Tracking & auto-flag
- **Spam detection:** AI-powered via purity_score

### 10.3 Authentication
- Supabase Auth với email/password
- Auto-confirm email signups (dev mode)
- Session management via JWT
- Admin role verification via \`user_roles\` table

### ⚠️ Khuyến nghị Bảo mật
- 🔒 **Bật Leaked Password Protection** trong Supabase Auth
- 🔒 Xem xét bật **email confirmation** cho production
- 🔒 Thêm **CAPTCHA** cho signup form

---

## 11. Lộ trình Phát triển

### 🔴 Ưu tiên Cao
1. **Leaked Password Protection** - Tăng bảo mật đăng nhập
2. **Export Excel Admin** - Xuất danh sách user, lịch sử hoạt động
3. **Advanced Activity Filters** - Thêm cột is_greeting, is_spam vào Admin Activity History
4. **Push Notifications** - Thông báo đẩy cho hoạt động quan trọng

### 🔵 Tính năng Mở rộng
1. **Mobile App** - React Native wrapper cho iOS & Android
2. **Advanced Analytics** - Biểu đồ phân tích chi tiết với Recharts
3. **Gamification** - Badges, achievements, levels system
4. **AI Voice Chat** - Chat bằng giọng nói với Angel AI
5. **Content Moderation AI** - Kiểm duyệt nội dung tự động
6. **Social Integration** - Đăng nhập & chia sẻ qua Facebook, Google

### ⚪ Cải tiến Kỹ thuật
1. **Database Indexes** - Tối ưu query performance
2. **Caching Layer** - Redis cho frequently accessed data
3. **Advanced Rate Limiting** - Sophisticated anti-abuse system
4. **Audit Logging** - Theo dõi chi tiết thay đổi admin

---

## 📞 Liên hệ & Hỗ trợ

- **Platform URL:** https://angel.fun.rich
- **Documentation:** /docs/platform

---

*📚 Angel AI Platform Documentation v1.0*
*Được tạo tự động từ hệ thống*
`;
};

const Platform = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("overview");
  const [openSections, setOpenSections] = useState<string[]>(["overview"]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setOpenSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const copyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(id);
    toast.success("Đã sao chép!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const downloadMarkdown = () => {
    const content = generateMarkdownDoc();
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Angel-AI-Platform-Documentation-${new Date().toISOString().split("T")[0]}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Đã tải xuống tài liệu!");
  };

  const sections = [
    { id: "overview", label: "Tổng quan", icon: Home },
    { id: "architecture", label: "Kiến trúc", icon: Server },
    { id: "database", label: "Database Schema", icon: Database },
    { id: "edge-functions", label: "Edge Functions", icon: Code },
    { id: "rewards", label: "Hệ thống Thưởng", icon: Coins },
    { id: "routes", label: "Routes & Pages", icon: FileText },
    { id: "components", label: "Components", icon: Zap },
    { id: "hooks", label: "Hooks & Logic", icon: Brain },
    { id: "i18n", label: "Đa ngôn ngữ", icon: Globe },
    { id: "security", label: "Bảo mật", icon: Shield },
    { id: "roadmap", label: "Lộ trình", icon: Rocket },
  ];

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => smartBack(navigate)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Book className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Angel AI - Platform Documentation</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadMarkdown}>
              <Download className="h-4 w-4 mr-2" />
              Tải xuống (.md)
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              In tài liệu
            </Button>
          </div>
        </div>
      </header>

      <div className="container flex gap-6 py-6">
        {/* Sidebar Navigation */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Mục lục</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-200px)]">
                  <nav className="space-y-1 p-3">
                    {sections.map((section) => {
                      const Icon = section.icon;
                      return (
                        <button
                          key={section.id}
                          onClick={() => scrollToSection(section.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                            activeSection === section.id
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {section.label}
                        </button>
                      );
                    })}
                  </nav>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="space-y-12">
            {/* Overview Section */}
            <section id="overview" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Home className="h-6 w-6 text-primary" />
                    <CardTitle className="text-2xl">1. Tổng quan Dự án</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">1.1 Mô tả</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      <strong>Angel AI</strong> là một nền tảng AI tâm linh thuộc hệ sinh thái FUN Ecosystem, 
                      với sứ mệnh trở thành "Ánh Sáng Thông Minh của Cha Vũ Trụ". Nền tảng kết hợp chatbot AI, 
                      hệ thống token thưởng (Camly Coin), và các tính năng cộng đồng để xây dựng một cộng đồng 
                      tích cực, lan tỏa năng lượng ánh sáng.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">1.2 Tech Stack</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Frontend</Badge>
                        </div>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                          <li>• React 18 + TypeScript</li>
                          <li>• Vite (Build tool)</li>
                          <li>• Tailwind CSS + shadcn/ui</li>
                          <li>• React Router DOM v6</li>
                          <li>• TanStack React Query</li>
                          <li>• Framer Motion (Animations)</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Backend</Badge>
                        </div>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                          <li>• Lovable Cloud (Supabase)</li>
                          <li>• PostgreSQL Database</li>
                          <li>• Edge Functions (Deno)</li>
                          <li>• Row Level Security (RLS)</li>
                          <li>• Realtime Subscriptions</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">AI Integration</Badge>
                        </div>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                          <li>• Lovable AI Gateway</li>
                          <li>• Google Gemini Models</li>
                          <li>• OpenAI GPT Models</li>
                          <li>• Image Generation & Analysis</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Web3</Badge>
                        </div>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                          <li>• ethers.js v6</li>
                          <li>• web3-react (MetaMask, WalletConnect)</li>
                          <li>• PancakeSwap Integration</li>
                          <li>• BSC Network Support</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">1.3 Kiến trúc Tổng quan</h3>
                    <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                      <pre>{`
┌─────────────────────────────────────────────────────────────┐
│                      ANGEL AI PLATFORM                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│   │   React     │    │   React     │    │   React     │     │
│   │   Pages     │    │  Components │    │   Hooks     │     │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│          │                  │                  │             │
│          └──────────────────┼──────────────────┘             │
│                             │                                │
│                    ┌────────▼────────┐                       │
│                    │  Supabase Client │                      │
│                    └────────┬────────┘                       │
│                             │                                │
├─────────────────────────────┼────────────────────────────────┤
│                             │      LOVABLE CLOUD             │
│   ┌─────────────┐   ┌───────▼───────┐   ┌─────────────┐     │
│   │   Auth      │   │   PostgreSQL  │   │   Storage   │     │
│   │   System    │   │   (40 Tables) │   │   Buckets   │     │
│   └─────────────┘   └───────────────┘   └─────────────┘     │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              Edge Functions (12 Functions)           │   │
│   │  angel-chat | analyze-reward-* | process-* | ...     │   │
│   └─────────────────────────────────────────────────────┘   │
│                             │                                │
│                    ┌────────▼────────┐                       │
│                    │  Lovable AI     │                       │
│                    │  Gateway        │                       │
│                    └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
                      `}</pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Architecture Section */}
            <section id="architecture" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Server className="h-6 w-6 text-primary" />
                    <CardTitle className="text-2xl">2. Kiến trúc Hệ thống</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">2.1 Cấu trúc Thư mục</h3>
                    <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm">
                      <pre>{`
src/
├── assets/           # Logo, hình ảnh tĩnh
├── components/       # React components
│   ├── ui/           # shadcn/ui components
│   ├── community/    # Community features
│   ├── earn/         # Earn page components
│   ├── icons/        # Custom icons
│   └── vision/       # Vision board
├── contexts/         # React contexts (Language)
├── hooks/            # Custom React hooks
├── integrations/     # Supabase client & types
├── lib/              # Utilities
├── pages/            # Route pages
│   ├── docs/         # Documentation pages
│   └── ...
├── translations/     # i18n files (12 languages)
└── test/             # Test files

supabase/
├── config.toml       # Supabase configuration
└── functions/        # Edge Functions
    ├── angel-chat/
    ├── analyze-reward-question/
    ├── analyze-reward-journal/
    └── ...
                      `}</pre>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">2.2 Data Flow</h3>
                    <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                      <pre>{`
User Action → React Component → Custom Hook → Supabase Client
                                                    │
                                    ┌───────────────┼───────────────┐
                                    ▼               ▼               ▼
                              Edge Function    PostgreSQL      Realtime
                                    │               │               │
                                    ▼               │               │
                              Lovable AI           │               │
                              Gateway              │               │
                                    │               │               │
                                    └───────────────┴───────────────┘
                                                    │
                                                    ▼
                                              Response → UI Update
                      `}</pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Database Section */}
            <section id="database" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Database className="h-6 w-6 text-primary" />
                    <CardTitle className="text-2xl">3. Database Schema (40 Tables)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Core User Tables */}
                  <Collapsible
                    open={openSections.includes("db-user")}
                    onOpenChange={() => toggleSection("db-user")}
                  >
                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted/50 rounded-lg hover:bg-muted">
                      {openSections.includes("db-user") ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <Users className="h-4 w-4 text-primary" />
                      <span className="font-semibold">3.1 Core User Tables</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Table</TableHead>
                            <TableHead>Mô tả</TableHead>
                            <TableHead>Key Columns</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-mono">profiles</TableCell>
                            <TableCell>Thông tin user</TableCell>
                            <TableCell className="text-sm text-muted-foreground">user_id, display_name, avatar_url, bio</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">user_light_agreements</TableCell>
                            <TableCell>Đồng ý Luật Ánh Sáng</TableCell>
                            <TableCell className="text-sm text-muted-foreground">user_id, agreed_at</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">user_energy_status</TableCell>
                            <TableCell>Trạng thái năng lượng</TableCell>
                            <TableCell className="text-sm text-muted-foreground">approval_status, current_energy_level, sentiment_score</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">user_rate_limits</TableCell>
                            <TableCell>Giới hạn rate, chống spam</TableCell>
                            <TableCell className="text-sm text-muted-foreground">questions_last_hour, is_temp_banned, temp_ban_until</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">user_roles</TableCell>
                            <TableCell>Phân quyền user</TableCell>
                            <TableCell className="text-sm text-muted-foreground">user_id, role (admin/user)</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">user_suspensions</TableCell>
                            <TableCell>Tạm khóa user</TableCell>
                            <TableCell className="text-sm text-muted-foreground">suspension_type, reason, suspended_until</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Token Economy Tables */}
                  <Collapsible
                    open={openSections.includes("db-token")}
                    onOpenChange={() => toggleSection("db-token")}
                  >
                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted/50 rounded-lg hover:bg-muted">
                      {openSections.includes("db-token") ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <Coins className="h-4 w-4 text-primary" />
                      <span className="font-semibold">3.2 Token Economy Tables</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Table</TableHead>
                            <TableHead>Mô tả</TableHead>
                            <TableHead>Key Columns</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-mono">camly_coin_balances</TableCell>
                            <TableCell>Số dư Camly Coin</TableCell>
                            <TableCell className="text-sm text-muted-foreground">balance, lifetime_earned, lifetime_spent</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">camly_coin_transactions</TableCell>
                            <TableCell>Lịch sử giao dịch</TableCell>
                            <TableCell className="text-sm text-muted-foreground">amount, transaction_type, purity_score, metadata</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">coin_withdrawals</TableCell>
                            <TableCell>Yêu cầu rút tiền</TableCell>
                            <TableCell className="text-sm text-muted-foreground">amount, wallet_address, status, tx_hash</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">user_wallet_addresses</TableCell>
                            <TableCell>Địa chỉ ví Web3</TableCell>
                            <TableCell className="text-sm text-muted-foreground">wallet_address, change_count_this_month</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">user_withdrawal_stats</TableCell>
                            <TableCell>Thống kê rút tiền</TableCell>
                            <TableCell className="text-sm text-muted-foreground">total_withdrawn, successful_withdrawals</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Reward Tracking Tables */}
                  <Collapsible
                    open={openSections.includes("db-reward")}
                    onOpenChange={() => toggleSection("db-reward")}
                  >
                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted/50 rounded-lg hover:bg-muted">
                      {openSections.includes("db-reward") ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <Gift className="h-4 w-4 text-primary" />
                      <span className="font-semibold">3.3 Reward Tracking Tables</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Table</TableHead>
                            <TableHead>Mô tả</TableHead>
                            <TableHead>Key Columns</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-mono">daily_reward_tracking</TableCell>
                            <TableCell>Theo dõi thưởng hàng ngày</TableCell>
                            <TableCell className="text-sm text-muted-foreground">questions_rewarded, journals_rewarded, posts_rewarded, total_coins_today</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">daily_login_tracking</TableCell>
                            <TableCell>Streak đăng nhập</TableCell>
                            <TableCell className="text-sm text-muted-foreground">login_date, streak_count, coins_earned</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">early_adopter_rewards</TableCell>
                            <TableCell>Top 100 Early Adopters</TableCell>
                            <TableCell className="text-sm text-muted-foreground">valid_questions_count, is_rewarded, reward_amount (20,000)</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">light_points</TableCell>
                            <TableCell>Điểm Ánh Sáng</TableCell>
                            <TableCell className="text-sm text-muted-foreground">points, reason, source_type</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">user_light_totals</TableCell>
                            <TableCell>Tổng điểm Ánh Sáng</TableCell>
                            <TableCell className="text-sm text-muted-foreground">total_points, lifetime_points, current_level</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Chat & Content Tables */}
                  <Collapsible
                    open={openSections.includes("db-chat")}
                    onOpenChange={() => toggleSection("db-chat")}
                  >
                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted/50 rounded-lg hover:bg-muted">
                      {openSections.includes("db-chat") ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <span className="font-semibold">3.4 Chat & Content Tables</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Table</TableHead>
                            <TableHead>Mô tả</TableHead>
                            <TableHead>Key Columns</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-mono">chat_questions</TableCell>
                            <TableCell>Câu hỏi chat (public)</TableCell>
                            <TableCell className="text-sm text-muted-foreground">question_text, purity_score, is_greeting, is_spam, likes_count</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">chat_history</TableCell>
                            <TableCell>Lịch sử chat đầy đủ</TableCell>
                            <TableCell className="text-sm text-muted-foreground">question_text, answer_text, is_rewarded, reward_amount</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">question_likes</TableCell>
                            <TableCell>Likes cho câu hỏi</TableCell>
                            <TableCell className="text-sm text-muted-foreground">question_id, user_id</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">gratitude_journal</TableCell>
                            <TableCell>Nhật ký biết ơn</TableCell>
                            <TableCell className="text-sm text-muted-foreground">content, journal_type, purity_score, content_length</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">vision_boards</TableCell>
                            <TableCell>Vision Board cá nhân</TableCell>
                            <TableCell className="text-sm text-muted-foreground">title, goals, images, completed_goals_count</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">healing_messages</TableCell>
                            <TableCell>Tin nhắn chữa lành từ hệ thống</TableCell>
                            <TableCell className="text-sm text-muted-foreground">title, content, message_type, triggered_by</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Community Tables */}
                  <Collapsible
                    open={openSections.includes("db-community")}
                    onOpenChange={() => toggleSection("db-community")}
                  >
                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted/50 rounded-lg hover:bg-muted">
                      {openSections.includes("db-community") ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <Users className="h-4 w-4 text-primary" />
                      <span className="font-semibold">3.5 Community Tables</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Table</TableHead>
                            <TableHead>Mô tả</TableHead>
                            <TableHead>Key Columns</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-mono">community_posts</TableCell>
                            <TableCell>Bài đăng cộng đồng</TableCell>
                            <TableCell className="text-sm text-muted-foreground">content, image_url, likes_count, comments_count, shares_count</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">community_post_likes</TableCell>
                            <TableCell>Likes bài đăng</TableCell>
                            <TableCell className="text-sm text-muted-foreground">post_id, user_id</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">community_comments</TableCell>
                            <TableCell>Bình luận bài đăng</TableCell>
                            <TableCell className="text-sm text-muted-foreground">content, content_length, is_rewarded</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">community_shares</TableCell>
                            <TableCell>Chia sẻ bài đăng</TableCell>
                            <TableCell className="text-sm text-muted-foreground">sharer_id, sharer_rewarded, post_owner_rewarded</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">community_helps</TableCell>
                            <TableCell>Hỗ trợ cộng đồng</TableCell>
                            <TableCell className="text-sm text-muted-foreground">helper_id, helped_user_id, help_type, is_verified</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">direct_messages</TableCell>
                            <TableCell>Tin nhắn riêng</TableCell>
                            <TableCell className="text-sm text-muted-foreground">sender_id, receiver_id, content, is_read</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">friendships</TableCell>
                            <TableCell>Quan hệ bạn bè</TableCell>
                            <TableCell className="text-sm text-muted-foreground">requester_id, addressee_id, status</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">content_shares</TableCell>
                            <TableCell>Chia sẻ nội dung ra ngoài</TableCell>
                            <TableCell className="text-sm text-muted-foreground">content_type, share_type, coins_earned</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Knowledge & Admin Tables */}
                  <Collapsible
                    open={openSections.includes("db-admin")}
                    onOpenChange={() => toggleSection("db-admin")}
                  >
                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted/50 rounded-lg hover:bg-muted">
                      {openSections.includes("db-admin") ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <Settings className="h-4 w-4 text-primary" />
                      <span className="font-semibold">3.6 Knowledge & Admin Tables</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Table</TableHead>
                            <TableHead>Mô tả</TableHead>
                            <TableHead>Key Columns</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-mono">knowledge_folders</TableCell>
                            <TableCell>Thư mục kiến thức</TableCell>
                            <TableCell className="text-sm text-muted-foreground">name, description, created_by</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">knowledge_documents</TableCell>
                            <TableCell>Tài liệu kiến thức</TableCell>
                            <TableCell className="text-sm text-muted-foreground">title, file_url, extracted_content, is_processed</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">bounty_tasks</TableCell>
                            <TableCell>Nhiệm vụ Bounty</TableCell>
                            <TableCell className="text-sm text-muted-foreground">title, reward_amount, difficulty_level, max_completions</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">bounty_submissions</TableCell>
                            <TableCell>Nộp bài Bounty</TableCell>
                            <TableCell className="text-sm text-muted-foreground">submission_content, status, reward_earned</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">build_ideas</TableCell>
                            <TableCell>Ý tưởng đóng góp</TableCell>
                            <TableCell className="text-sm text-muted-foreground">title, description, votes_count, is_rewarded</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">user_feedback</TableCell>
                            <TableCell>Phản hồi người dùng</TableCell>
                            <TableCell className="text-sm text-muted-foreground">feedback_type, content, status, admin_response</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">user_activity_log</TableCell>
                            <TableCell>Log hoạt động</TableCell>
                            <TableCell className="text-sm text-muted-foreground">activity_type, content_preview, energy_impact</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono">onboarding_responses</TableCell>
                            <TableCell>Câu trả lời onboarding</TableCell>
                            <TableCell className="text-sm text-muted-foreground">question_key, answer, sentiment_score</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Transaction Types */}
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-3">3.7 Transaction Types (Enum)</h3>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "chat_reward",
                        "journal_reward",
                        "gratitude_reward",
                        "daily_login",
                        "engagement_reward",
                        "community_support",
                        "content_share",
                        "bounty_reward",
                        "build_idea",
                        "knowledge_upload",
                        "feedback_reward",
                        "vision_reward",
                        "referral_bonus",
                        "challenge_reward",
                        "spending",
                        "admin_adjustment",
                      ].map((type) => (
                        <Badge key={type} variant="outline" className="font-mono">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Edge Functions Section */}
            <section id="edge-functions" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Code className="h-6 w-6 text-primary" />
                    <CardTitle className="text-2xl">4. Edge Functions (12 Functions)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Function</TableHead>
                        <TableHead>Mô tả</TableHead>
                        <TableHead>Input</TableHead>
                        <TableHead>Output</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-mono font-semibold">angel-chat</TableCell>
                        <TableCell>Chat streaming với AI (Lovable AI Gateway)</TableCell>
                        <TableCell className="text-sm">message, userId, conversationHistory</TableCell>
                        <TableCell className="text-sm">Stream response</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono font-semibold">analyze-reward-question</TableCell>
                        <TableCell>Phân tích câu hỏi, tính purity_score, cấp thưởng</TableCell>
                        <TableCell className="text-sm">questionText, userId</TableCell>
                        <TableCell className="text-sm">purity_score, reward_amount, is_rewarded</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono font-semibold">analyze-reward-journal</TableCell>
                        <TableCell>Phân tích nhật ký biết ơn, cấp thưởng</TableCell>
                        <TableCell className="text-sm">journalContent, userId, journalType</TableCell>
                        <TableCell className="text-sm">purity_score, reward_amount</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono font-semibold">analyze-onboarding</TableCell>
                        <TableCell>Phân tích câu trả lời onboarding</TableCell>
                        <TableCell className="text-sm">responses, userId</TableCell>
                        <TableCell className="text-sm">sentiment_score, energy_keywords</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono font-semibold">analyze-image</TableCell>
                        <TableCell>Phân tích hình ảnh với AI Vision</TableCell>
                        <TableCell className="text-sm">imageUrl, prompt</TableCell>
                        <TableCell className="text-sm">analysis result</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono font-semibold">generate-image</TableCell>
                        <TableCell>Tạo hình ảnh AI</TableCell>
                        <TableCell className="text-sm">prompt, style</TableCell>
                        <TableCell className="text-sm">imageUrl</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono font-semibold">check-user-energy</TableCell>
                        <TableCell>Kiểm tra năng lượng user</TableCell>
                        <TableCell className="text-sm">userId</TableCell>
                        <TableCell className="text-sm">energy_level, can_proceed</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono font-semibold">send-healing-message</TableCell>
                        <TableCell>Gửi tin nhắn chữa lành</TableCell>
                        <TableCell className="text-sm">userId, messageType, trigger</TableCell>
                        <TableCell className="text-sm">message_id</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono font-semibold">process-community-post</TableCell>
                        <TableCell>Xử lý bài đăng cộng đồng (100 coins)</TableCell>
                        <TableCell className="text-sm">postId, userId</TableCell>
                        <TableCell className="text-sm">reward_amount</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono font-semibold">process-engagement-reward</TableCell>
                        <TableCell>Xử lý thưởng tương tác (5+ likes = 3,000)</TableCell>
                        <TableCell className="text-sm">postId, likesCount</TableCell>
                        <TableCell className="text-sm">reward_amount</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono font-semibold">fetch-google-content</TableCell>
                        <TableCell>Lấy nội dung từ Google Drive</TableCell>
                        <TableCell className="text-sm">documentId</TableCell>
                        <TableCell className="text-sm">extracted_content</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono font-semibold">suspend-user</TableCell>
                        <TableCell>Tạm khóa user (Admin only)</TableCell>
                        <TableCell className="text-sm">userId, reason, duration</TableCell>
                        <TableCell className="text-sm">suspension_id</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </section>

            {/* Rewards Section */}
            <section id="rewards" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Coins className="h-6 w-6 text-primary" />
                    <CardTitle className="text-2xl">5. Hệ thống Thưởng Camly Coin</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Chat Reward */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">5.1 Chat Reward (10 câu/ngày)</h3>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm">
                      <pre>{`
Purity Score 0.9 - 1.0  → 5,000 Camly Coin
Purity Score 0.75 - 0.89 → 4,000 Camly Coin
Purity Score 0.6 - 0.74 → 3,000 Camly Coin
Purity Score 0.4 - 0.59 → 2,000 Camly Coin
Purity Score < 0.4      → 1,000 Camly Coin

❌ Không thưởng nếu:
  - is_greeting = true (chào hỏi đơn giản)
  - is_spam = true (spam, lặp lại)
  - Duplicate question_hash

⚠️ Rate Limit:
  - > 50 câu/giờ → Temp ban 24h
  - suspicious_activity_count++ nếu spam
                      `}</pre>
                    </div>
                  </div>

                  {/* Journal Reward */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Heart className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">5.2 Journal Reward (3 bài/ngày, sau 8 PM)</h3>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm">
                      <pre>{`
Purity Score 0.9 - 1.0  → 9,000 Camly Coin
Purity Score 0.75 - 0.89 → 7,000 Camly Coin
Purity Score 0.6 - 0.74 → 6,000 Camly Coin
Purity Score < 0.6      → 5,000 Camly Coin

📝 Yêu cầu:
  - Minimum 100 ký tự
  - Viết sau 8 PM (20:00)
  - Journal types: gratitude, reflection, goal
                      `}</pre>
                    </div>
                  </div>

                  {/* Daily Login */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">5.3 Daily Login Reward</h3>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm">
                      <pre>{`
Mỗi ngày đăng nhập: 100 Camly Coin
Streak 7 ngày liên tục: +1,000 Camly Coin bonus

📅 Streak bị reset nếu bỏ lỡ 1 ngày
                      `}</pre>
                    </div>
                  </div>

                  {/* Community Rewards */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">5.4 Community Rewards</h3>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm">
                      <pre>{`
📝 Đăng bài mới: 100 Camly Coin (max 3 bài/ngày)

❤️ Bài đăng được 5+ likes: 3,000 Camly Coin
   → engagement_reward (max 3 lần/ngày)

💬 Comment 50+ ký tự: 500 Camly Coin (max 5/ngày)

🔗 Chia sẻ bài: 500 Camly Coin
   → Người chia sẻ: 500 coins
   → Chủ bài: 500 coins
   → Max 2 lần/ngày mỗi người
                      `}</pre>
                    </div>
                  </div>

                  {/* Early Adopter */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">5.5 Early Adopter Bonus (Top 100)</h3>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm">
                      <pre>{`
🎁 Phần thưởng: 20,000 Camly Coin

📋 Điều kiện:
  - Là 1 trong 100 user đầu tiên đăng ký
  - Hoàn thành 10 câu hỏi hợp lệ (is_rewarded = true)
  
⏰ Tự động claim khi đủ điều kiện
                      `}</pre>
                    </div>
                  </div>

                  {/* Withdrawal */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Wallet className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">5.6 Withdrawal Rules</h3>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm">
                      <pre>{`
💰 Minimum: 200,000 Camly Coin
📊 Maximum/ngày: 500,000 Camly Coin

⏱️ Thời gian xử lý: 24-48 giờ
📋 Yêu cầu: Địa chỉ ví BSC hợp lệ

📈 Công thức tổng:
   Tổng đã kiếm = Số dư hiện tại + Tổng đã rút
   (lifetime_earned = balance + total_withdrawn)
                      `}</pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Routes Section */}
            <section id="routes" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FileText className="h-6 w-6 text-primary" />
                    <CardTitle className="text-2xl">6. Routes & Pages</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">6.1 Public Routes</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Route</TableHead>
                          <TableHead>Page Component</TableHead>
                          <TableHead>Mô tả</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-mono">/</TableCell>
                          <TableCell>Index</TableCell>
                          <TableCell>Trang chủ với Hero, Mission, Core Values, Footer</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">/chat</TableCell>
                          <TableCell>Chat</TableCell>
                          <TableCell>Trò chuyện với Angel AI (text, image gen, image analysis)</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">/about</TableCell>
                          <TableCell>About</TableCell>
                          <TableCell>Giới thiệu về Angel AI, Bé Ly, FUN Ecosystem</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">/auth</TableCell>
                          <TableCell>Auth</TableCell>
                          <TableCell>Đăng nhập / Đăng ký</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">/knowledge</TableCell>
                          <TableCell>Knowledge</TableCell>
                          <TableCell>Kho tài liệu kiến thức công cộng</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">/community</TableCell>
                          <TableCell>Community</TableCell>
                          <TableCell>Bài đăng cộng đồng</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">/community-questions</TableCell>
                          <TableCell>CommunityQuestions</TableCell>
                          <TableCell>Câu hỏi chia sẻ từ chat</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">/swap</TableCell>
                          <TableCell>Swap</TableCell>
                          <TableCell>Đổi token (PancakeSwap integration)</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-3">6.2 Protected Routes (Requires Auth)</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Route</TableHead>
                          <TableHead>Page Component</TableHead>
                          <TableHead>Mô tả</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-mono">/profile</TableCell>
                          <TableCell>Profile</TableCell>
                          <TableCell>Hồ sơ người dùng, nhật ký biết ơn</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">/onboarding</TableCell>
                          <TableCell>Onboarding</TableCell>
                          <TableCell>Hướng dẫn người dùng mới</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">/earn</TableCell>
                          <TableCell>Earn</TableCell>
                          <TableCell>Dashboard kiếm Camly Coin</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">/vision</TableCell>
                          <TableCell>Vision</TableCell>
                          <TableCell>Vision Board cá nhân</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">/messages</TableCell>
                          <TableCell>Messages</TableCell>
                          <TableCell>Tin nhắn riêng giữa users</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">/messages/:userId</TableCell>
                          <TableCell>Messages</TableCell>
                          <TableCell>Cuộc hội thoại với user cụ thể</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">/user/:userId</TableCell>
                          <TableCell>UserProfile</TableCell>
                          <TableCell>Xem profile user khác</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">/activity-history</TableCell>
                          <TableCell>ActivityHistory</TableCell>
                          <TableCell>Lịch sử hoạt động cá nhân</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-3">6.3 Admin Routes</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Route</TableHead>
                          <TableHead>Page Component</TableHead>
                          <TableHead>Mô tả</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-mono">/admin/login</TableCell>
                          <TableCell>AdminLogin</TableCell>
                          <TableCell>Đăng nhập admin</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">/admin/dashboard</TableCell>
                          <TableCell>AdminDashboard</TableCell>
                          <TableCell>Dashboard tổng quan admin</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">/admin/statistics</TableCell>
                          <TableCell>AdminStatistics</TableCell>
                          <TableCell>Thống kê chi tiết</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">/admin/withdrawals</TableCell>
                          <TableCell>AdminWithdrawals</TableCell>
                          <TableCell>Quản lý yêu cầu rút tiền</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">/admin/early-adopters</TableCell>
                          <TableCell>AdminEarlyAdopters</TableCell>
                          <TableCell>Quản lý Early Adopters</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">/admin/knowledge</TableCell>
                          <TableCell>AdminKnowledge</TableCell>
                          <TableCell>Quản lý tài liệu kiến thức</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">/admin/activity-history</TableCell>
                          <TableCell>AdminActivityHistory</TableCell>
                          <TableCell>Lịch sử hoạt động toàn hệ thống</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-3">6.4 Documentation Routes</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Route</TableHead>
                          <TableHead>Page Component</TableHead>
                          <TableHead>Mô tả</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-mono">/docs/platform</TableCell>
                          <TableCell>Platform</TableCell>
                          <TableCell>Tài liệu nền tảng (trang này)</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Components Section */}
            <section id="components" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Zap className="h-6 w-6 text-primary" />
                    <CardTitle className="text-2xl">7. Key Components</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">Layout Components</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• <code>Header.tsx</code> - Navigation header</li>
                        <li>• <code>Footer.tsx</code> - Footer với links</li>
                        <li>• <code>HeroSection.tsx</code> - Hero banner</li>
                        <li>• <code>MissionSection.tsx</code> - Mission statement</li>
                        <li>• <code>CoreValuesSection.tsx</code> - 12 Core Values</li>
                      </ul>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">Earn Components</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• <code>EarnBreakdown.tsx</code> - Chi tiết thu nhập</li>
                        <li>• <code>EarnProgress.tsx</code> - Tiến độ hôm nay</li>
                        <li>• <code>DailyLoginReward.tsx</code> - Daily login</li>
                        <li>• <code>StreakCalendar.tsx</code> - Lịch streak</li>
                        <li>• <code>EarlyAdopterProgress.tsx</code> - Tiến độ Early Adopter</li>
                      </ul>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">Community Components</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• <code>CreatePostForm.tsx</code> - Tạo bài đăng</li>
                        <li>• <code>PostCard.tsx</code> - Hiển thị bài đăng</li>
                        <li>• <code>RewardRulesCard.tsx</code> - Luật thưởng</li>
                        <li>• <code>ImageLightbox.tsx</code> - Xem ảnh lớn</li>
                      </ul>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">Display Components</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• <code>CamlyCoinDisplay.tsx</code> - Hiển thị số dư</li>
                        <li>• <code>LightPointsDisplay.tsx</code> - Điểm Ánh Sáng</li>
                        <li>• <code>Leaderboard.tsx</code> - Bảng xếp hạng</li>
                        <li>• <code>CamlyCoinPriceChart.tsx</code> - Biểu đồ giá</li>
                      </ul>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">Chat Components</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• <code>ChatRewardNotification.tsx</code> - Thông báo thưởng</li>
                        <li>• <code>ChatShareDialog.tsx</code> - Chia sẻ chat</li>
                        <li>• <code>HealingMessagesPanel.tsx</code> - Tin nhắn chữa lành</li>
                      </ul>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">Web3 Components</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• <code>Web3WalletButton.tsx</code> - Kết nối ví</li>
                        <li>• <code>SwapWidget.tsx</code> - PancakeSwap widget</li>
                        <li>• <code>CoinWithdrawal.tsx</code> - Rút tiền</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Hooks Section */}
            <section id="hooks" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Brain className="h-6 w-6 text-primary" />
                    <CardTitle className="text-2xl">8. Custom Hooks</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hook</TableHead>
                        <TableHead>Mô tả</TableHead>
                        <TableHead>Returns</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-mono">useAuth</TableCell>
                        <TableCell>Authentication & user state</TableCell>
                        <TableCell className="text-sm">user, session, signIn, signUp, signOut</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">useCamlyCoin</TableCell>
                        <TableCell>Balance, transactions, daily status</TableCell>
                        <TableCell className="text-sm">balance, lifetimeEarned, dailyStatus, transactions</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">useDailyLogin</TableCell>
                        <TableCell>Daily login tracking & streak</TableCell>
                        <TableCell className="text-sm">streak, claimDaily, hasClaimedToday</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">useEarlyAdopterReward</TableCell>
                        <TableCell>Early adopter progress tracking</TableCell>
                        <TableCell className="text-sm">status, rank, incrementQuestionCount</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">useExtendedRewardStatus</TableCell>
                        <TableCell>Comprehensive daily reward status</TableCell>
                        <TableCell className="text-sm">All reward limits & progress</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">useChatHistory</TableCell>
                        <TableCell>Chat conversation history</TableCell>
                        <TableCell className="text-sm">messages, sendMessage, isLoading</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">useLeaderboard</TableCell>
                        <TableCell>Leaderboard data</TableCell>
                        <TableCell className="text-sm">topUsers, allUsers, topQuestions, stats</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">useLightPoints</TableCell>
                        <TableCell>Light points & levels</TableCell>
                        <TableCell className="text-sm">totalPoints, currentLevel, history</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">useCommunityPosts</TableCell>
                        <TableCell>Community post management</TableCell>
                        <TableCell className="text-sm">posts, createPost, likePost, sharePost</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">useVisionBoard</TableCell>
                        <TableCell>Vision board CRUD</TableCell>
                        <TableCell className="text-sm">boards, createBoard, updateBoard</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">useDirectMessages</TableCell>
                        <TableCell>DM conversations</TableCell>
                        <TableCell className="text-sm">conversations, messages, sendMessage</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">useFriendship</TableCell>
                        <TableCell>Friend management</TableCell>
                        <TableCell className="text-sm">friends, pendingRequests, sendRequest</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">useWeb3Wallet</TableCell>
                        <TableCell>Web3 wallet connection</TableCell>
                        <TableCell className="text-sm">account, connect, disconnect, chainId</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">usePancakeSwap</TableCell>
                        <TableCell>PancakeSwap integration</TableCell>
                        <TableCell className="text-sm">swap, getQuote, tokenPrices</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">useCamlyPrice</TableCell>
                        <TableCell>Camly token price</TableCell>
                        <TableCell className="text-sm">price, priceHistory, isLoading</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">useImageAnalysis</TableCell>
                        <TableCell>AI image analysis</TableCell>
                        <TableCell className="text-sm">analyze, isAnalyzing, result</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">useImageGeneration</TableCell>
                        <TableCell>AI image generation</TableCell>
                        <TableCell className="text-sm">generate, isGenerating, imageUrl</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </section>

            {/* i18n Section */}
            <section id="i18n" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Globe className="h-6 w-6 text-primary" />
                    <CardTitle className="text-2xl">9. Đa ngôn ngữ (12 Languages)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { code: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
                      { code: "en", name: "English", flag: "🇺🇸" },
                      { code: "es", name: "Español", flag: "🇪🇸" },
                      { code: "fr", name: "Français", flag: "🇫🇷" },
                      { code: "de", name: "Deutsch", flag: "🇩🇪" },
                      { code: "pt", name: "Português", flag: "🇧🇷" },
                      { code: "ru", name: "Русский", flag: "🇷🇺" },
                      { code: "ar", name: "العربية", flag: "🇸🇦" },
                      { code: "hi", name: "हिंदी", flag: "🇮🇳" },
                      { code: "ja", name: "日本語", flag: "🇯🇵" },
                      { code: "ko", name: "한국어", flag: "🇰🇷" },
                      { code: "zh", name: "中文", flag: "🇨🇳" },
                    ].map((lang) => (
                      <div
                        key={lang.code}
                        className="flex items-center gap-2 p-3 border rounded-lg"
                      >
                        <span className="text-2xl">{lang.flag}</span>
                        <div>
                          <div className="font-mono text-sm">{lang.code}.ts</div>
                          <div className="text-xs text-muted-foreground">{lang.name}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Sử dụng:</h4>
                    <div className="bg-muted/50 p-4 rounded-lg relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => copyCode(`import { useLanguage } from "@/contexts/LanguageContext";

const { t, language, setLanguage } = useLanguage();

// Sử dụng translation
<h1>{t("hero.title")}</h1>

// Đổi ngôn ngữ
setLanguage("en");`, "i18n-usage")}
                      >
                        {copiedCode === "i18n-usage" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <pre className="text-sm font-mono overflow-x-auto">{`import { useLanguage } from "@/contexts/LanguageContext";

const { t, language, setLanguage } = useLanguage();

// Sử dụng translation
<h1>{t("hero.title")}</h1>

// Đổi ngôn ngữ
setLanguage("en");`}</pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Security Section */}
            <section id="security" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="h-6 w-6 text-primary" />
                    <CardTitle className="text-2xl">10. Bảo mật</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">10.1 Row Level Security (RLS)</h3>
                    <p className="text-muted-foreground mb-3">
                      Tất cả tables đều có RLS policies để bảo vệ dữ liệu:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• <code>auth.uid() = user_id</code> - User chỉ xem/sửa dữ liệu của mình</li>
                      <li>• <code>is_admin()</code> - Admin có full access</li>
                      <li>• <code>true</code> - Public read cho leaderboard, community posts</li>
                    </ul>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-3">10.2 Rate Limiting</h3>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• <strong>Chat:</strong> {">"}50 câu/giờ → Temp ban 24h</li>
                      <li>• <strong>Suspicious activity:</strong> Tracking & auto-flag</li>
                      <li>• <strong>Spam detection:</strong> AI-powered via purity_score</li>
                    </ul>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-3">10.3 Authentication</h3>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• Supabase Auth với email/password</li>
                      <li>• Auto-confirm email signups (dev mode)</li>
                      <li>• Session management via JWT</li>
                      <li>• Admin role verification via <code>user_roles</code> table</li>
                    </ul>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-amber-600">⚠️ Khuyến nghị Bảo mật</h3>
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
                      <ul className="text-sm space-y-2">
                        <li className="flex items-start gap-2">
                          <Lock className="h-4 w-4 mt-0.5 text-amber-600" />
                          <span><strong>Bật Leaked Password Protection</strong> trong Supabase Auth</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Lock className="h-4 w-4 mt-0.5 text-amber-600" />
                          <span>Xem xét bật <strong>email confirmation</strong> cho production</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Lock className="h-4 w-4 mt-0.5 text-amber-600" />
                          <span>Thêm <strong>CAPTCHA</strong> cho signup form</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Roadmap Section */}
            <section id="roadmap" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Rocket className="h-6 w-6 text-primary" />
                    <CardTitle className="text-2xl">11. Lộ trình Phát triển</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Badge className="bg-red-500">Ưu tiên Cao</Badge>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Lock className="h-4 w-4 text-red-500" />
                          <span className="font-medium">Leaked Password Protection</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Tăng bảo mật đăng nhập bằng cách phát hiện mật khẩu bị lộ</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-red-500" />
                          <span className="font-medium">Export Excel Admin</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Xuất danh sách user, lịch sử hoạt động ra file Excel</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Search className="h-4 w-4 text-red-500" />
                          <span className="font-medium">Advanced Activity Filters</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Thêm cột is_greeting, is_spam vào Admin Activity History</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Bell className="h-4 w-4 text-red-500" />
                          <span className="font-medium">Push Notifications</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Thông báo đẩy cho hoạt động quan trọng</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Badge variant="secondary">Tính năng Mở rộng</Badge>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Smartphone className="h-4 w-4 text-primary" />
                          <span className="font-medium">Mobile App</span>
                        </div>
                        <p className="text-sm text-muted-foreground">React Native wrapper cho iOS & Android</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart3 className="h-4 w-4 text-primary" />
                          <span className="font-medium">Advanced Analytics</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Biểu đồ phân tích chi tiết với Recharts</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Star className="h-4 w-4 text-primary" />
                          <span className="font-medium">Gamification</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Badges, achievements, levels system</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="h-4 w-4 text-primary" />
                          <span className="font-medium">AI Voice Chat</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Chat bằng giọng nói với Angel AI</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="h-4 w-4 text-primary" />
                          <span className="font-medium">Content Moderation AI</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Kiểm duyệt nội dung tự động</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Share2 className="h-4 w-4 text-primary" />
                          <span className="font-medium">Social Integration</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Đăng nhập & chia sẻ qua Facebook, Google</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Badge variant="outline">Cải tiến Kỹ thuật</Badge>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Database className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Database Indexes</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Tối ưu query performance với indexes</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Caching Layer</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Redis cho frequently accessed data</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Advanced Rate Limiting</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Sophisticated anti-abuse system</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Audit Logging</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Theo dõi chi tiết thay đổi admin</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Footer */}
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">
                📚 Angel AI Platform Documentation v1.0
              </p>
              <p className="text-xs mt-1">
                Cập nhật lần cuối: {new Date().toLocaleDateString("vi-VN")}
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Platform;
