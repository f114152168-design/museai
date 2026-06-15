"use client";
import { useState, useEffect, useCallback } from "react";
import { getTier, setTier, redeemPromoCode, type Tier } from "@/lib/billing";

const STORAGE_KEY = "museai_tier";

export function useTier() {
  const [tier, setTierState] = useState<Tier>(() => getTier());

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setTierState((e.newValue as Tier) || "free");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const redeem = useCallback((code: string) => {
    const result = redeemPromoCode(code);
    if (result.success) setTierState("paid");
    return result;
  }, []);

  return { tier, redeem, isFree: tier === "free" };
}