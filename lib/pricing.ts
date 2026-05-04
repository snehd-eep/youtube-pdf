import { Mode } from "./types";

export interface PricingInfo {
  mode: Mode;
  priceInr: number;
  priceUsd: number;
  labelInr: string;
  labelUsd: string;
  isFree: boolean;
  currency: string;
}

export const PRICING: Record<Mode, PricingInfo> = {
  normal: { mode: "normal", priceInr: 0, priceUsd: 0, labelInr: "Free", labelUsd: "Free", isFree: true, currency: "INR" },
  "system-design": { mode: "system-design", priceInr: 0, priceUsd: 0, labelInr: "Free", labelUsd: "Free", isFree: true, currency: "INR" },
  "system-design-pro": { mode: "system-design-pro", priceInr: 5, priceUsd: 0.10, labelInr: "₹5", labelUsd: "$0.10", isFree: false, currency: "USD" },
  pro: { mode: "pro", priceInr: 5, priceUsd: 0.10, labelInr: "₹5", labelUsd: "$0.10", isFree: false, currency: "USD" },
};

export function getPriceLabel(inrRate: number = 83): string {
  const usdPrice = 0.10;
  const inrPrice = Math.round(usdPrice * inrRate);
  return `₹${inrPrice} ($${usdPrice})`;
}

export function isPaidMode(mode: Mode): boolean {
  return !PRICING[mode].isFree;
}