export type Tier = "free" | "paid";

const STORAGE_KEY = "museai_tier";

export function getTier(): Tier {
  if (typeof window === "undefined") return "free";
  return (localStorage.getItem(STORAGE_KEY) as Tier) || "free";
}

export function setTier(tier: Tier) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, tier);
}

export const TIER_LIMITS = {
  free: {
    maxBeats: 32,      // 8 bars
    maxDurationSec: 30,
    sections: 1,
    label: "Free",
    description: "30 秒循環片段",
  },
  paid: {
    maxBeats: 576,     // 144 bars ≈ 3 min at 128 BPM
    maxDurationSec: 180,
    sections: 6,
    label: "Pro",
    description: "最長 3 分鐘完整編曲",
  },
} as const;