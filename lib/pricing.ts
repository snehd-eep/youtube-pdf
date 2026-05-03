import { Mode, PricingInfo } from "./types";

export const PRICING: Record<Mode, PricingInfo> = {
  normal: { mode: "normal", price: 0, label: "Free", isFree: true },
  "system-design": { mode: "system-design", price: 0, label: "Free", isFree: true },
  "system-design-pro": { mode: "system-design-pro", price: 5, label: "₹5", isFree: false, currency: "INR" },
  pro: { mode: "pro", price: 5, label: "₹5", isFree: false, currency: "INR" },
};

export function isPaidMode(mode: Mode): boolean {
  return !PRICING[mode].isFree;
}