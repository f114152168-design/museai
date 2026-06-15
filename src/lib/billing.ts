export type Tier = "free" | "paid";

const STORAGE_KEY = "museai_tier";
const PROMO_KEY = "museai_promo_redeemed";

export function getTier(): Tier {
  if (typeof window === "undefined") return "free";
  return (localStorage.getItem(STORAGE_KEY) as Tier) || "free";
}

export function setTier(tier: Tier) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, tier);
}

export function redeemPromoCode(code: string): { success: boolean; message: string } {
  const normalized = code.trim().toLowerCase();
  if (normalized === "pro") {
    setTier("paid");
    localStorage.setItem(PROMO_KEY, "true");
    return { success: true, message: "🎉 Pro 已解鎖！所有功能已開放。" };
  }
  return { success: false, message: "❌ 無效的優惠碼" };
}

export function isPromoRedeemed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PROMO_KEY) === "true";
}

export const TIER_LIMITS = {
  free: {
    maxBeats: 32,
    maxDurationSec: 30,
    sections: 1,
    label: "Free",
    description: "30 秒循環片段",
  },
  paid: {
    maxBeats: 576,
    maxDurationSec: 180,
    sections: 6,
    label: "Pro",
    description: "最長 3 分鐘完整編曲",
  },
} as const;