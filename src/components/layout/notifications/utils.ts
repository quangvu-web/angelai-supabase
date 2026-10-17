import type { Notification } from "@/hooks/useNotifications";
import type { NotificationGroups } from "./types";
import { REACTION_ICONS } from "./types";
import { getProfilePath } from "@/lib/profileUrl";

export function getRelativeTime(dateStr: string, t: (key: string) => string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return t("notifications.justNow");
  if (diffMin < 60) return `${diffMin} ${t("notifications.minutesAgo")}`;
  if (diffHr < 24) return `${diffHr} ${t("notifications.hoursAgo")}`;
  if (diffDay < 7) return `${diffDay} ${t("notifications.daysAgo")}`;
  return new Date(dateStr).toLocaleDateString();
}

export const groupNotificationsByTime = (notifications: Notification[]): NotificationGroups => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const hourAgo = new Date(now.getTime() - 3600000);

  const groups: NotificationGroups = {
    new: [],
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  };

  notifications.forEach((n) => {
    const d = new Date(n.created_at);
    if (d >= hourAgo) groups.new.push(n);
    else if (d >= today) groups.today.push(n);
    else if (d >= yesterday) groups.yesterday.push(n);
    else if (d >= weekAgo) groups.thisWeek.push(n);
    else groups.earlier.push(n);
  });

  return groups;
};

export const getNotificationIcon = (type: string): string => {
  if (REACTION_ICONS[type]) return REACTION_ICONS[type].icon;

  switch (type) {
    case "comment":
    case "comment_like":
    case "comment_reply":
      return "💬";
    case "share":
      return "🔗";
    case "gift_received":
      return "🎁";
    case "gift_sent":
      return "💝";
    case "mint_approved":
      return "⛏️";
    case "fun_claim_available":
      return "🪙";
    case "tet_lixi_reward":
      return "🧧";
    case "lixi_claim_completed":
      return "✅";
    case "reward_approved":
      return "🎉";
    case "reward_rejected":
      return "📋";
    case "friend_request":
      return "👋";
    case "friend_accepted":
      return "🤝";
    case "account_banned":
      return "⚠️";
    case "fraud_alert_critical":
      return "🚨";
    case "gov_signing_request":
      return "🔐";
    default:
      return "🔔";
  }
};

export const truncateContent = (content: string | null | undefined, maxLength = 50): string => {
  if (!content) return "";
  return content.length > maxLength ? content.slice(0, maxLength) + "..." : content;
};

/**
 * Build the notification text using i18n translation function.
 * Returns only the action part; the actor name is rendered separately.
 */
export const getNotificationActionText = (
  type: string,
  t: (key: string) => string
): string => {
  switch (type) {
    case "like":
      return t("notifications.type.liked");
    case "love":
      return t("notifications.type.loved");
    case "care":
      return t("notifications.type.cared");
    case "haha":
      return t("notifications.type.laughed");
    case "wow":
      return t("notifications.type.wowed");
    case "sad":
      return t("notifications.type.saddened");
    case "angry":
      return t("notifications.type.angered");
    case "pray":
      return t("notifications.type.prayed");
    case "comment":
      return t("notifications.type.commented");
    case "comment_like":
      return t("notifications.type.commentLiked");
    case "comment_reply":
      return t("notifications.type.commentReplied");
    case "share":
      return t("notifications.type.shared");
    case "friend_request":
      return t("notifications.type.friendRequest");
    case "friend_accepted":
      return t("notifications.type.friendAccepted");
    case "reward_approved":
      return t("notifications.type.rewardApproved");
    case "reward_rejected":
      return t("notifications.type.rewardRejected");
    case "mint_approved":
      return t("notifications.type.mintApproved") || "đã được duyệt mint FUN Money thành công";
    case "fun_claim_available":
      return "bạn có FUN chờ claim! Vào trang Mint để nhận ngay";
    case "gift_received":
      return t("notifications.giftReceived");
    case "gift_sent":
      return t("notifications.giftSent");
    case "tet_lixi_reward":
      return "Angel AI Treasury đã gửi đến bạn thông báo về Lì Xì Tết";
    case "lixi_claim_completed":
      return "Chúc mừng! Bạn đã nhận Camly Coin từ chương trình Lì Xì Tết";
    case "fraud_alert_critical":
      return t("notifications.type.fraudAlert") || "Hệ thống phát hiện hoạt động bất thường cần kiểm tra";
    default:
      return t("notifications.type.interacted");
  }
};

export const getNotificationLink = (notif: Notification): string | null => {
  const meta = notif.metadata || {};
  if (notif.type === "gift_received" || notif.type === "gift_sent") {
    const receiptId = meta.receipt_public_id as string | undefined;
    if (receiptId) return `/receipt/${receiptId}`;
  }
  if (notif.type === "friend_request" || notif.type === "friend_accepted") {
    if (notif.actor_id) return getProfilePath(notif.actor_id);
  }
  if (notif.reference_type === "post" && notif.reference_id) {
    return "/community";
  }
  if (notif.type === "reward_approved" || notif.type === "reward_rejected") {
    return "/earn";
  }
  if (notif.type === "mint_approved" || notif.type === "fun_claim_available") {
    return "/mint";
  }
  if (notif.type === "fraud_alert_critical") {
    return "/admin/fraud-alerts";
  }
  if (notif.type === "gov_signing_request") {
    return "/l-panel";
  }
  return null;
};
