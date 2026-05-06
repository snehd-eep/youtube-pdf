import { Mode } from "./types";

export interface PricingInfo {
  mode: Mode;
  priceUsd: number;
  labelInr: string;
  labelUsd: string;
  isFree: boolean;
  description: string;
}

// USD is the base currency, INR is dynamically calculated
export const PRICING: Record<Mode, PricingInfo> = {
  normal: { 
    mode: "normal", 
    priceUsd: 0, 
    labelInr: "Free", 
    labelUsd: "Free", 
    isFree: true,
    description: "Quick summary with timestamps"
  },
  "system-design": { 
    mode: "system-design", 
    priceUsd: 0, 
    labelInr: "Free", 
    labelUsd: "Free", 
    isFree: true,
    description: "Architecture diagrams and trade-offs"
  },
  "technical-course": { 
    mode: "technical-course", 
    priceUsd: 0, 
    labelInr: "Free", 
    labelUsd: "Free", 
    isFree: true,
    description: "Course summary with lessons"
  },
  pro: { 
    mode: "pro", 
    priceUsd: 0.10, 
    labelInr: "~₹8", 
    labelUsd: "$0.10", 
    isFree: false,
    description: "Structured document with sections"
  },
  "system-design-pro": { 
    mode: "system-design-pro", 
    priceUsd: 0.10, 
    labelInr: "~₹8", 
    labelUsd: "$0.10", 
    isFree: false,
    description: "Deep architecture analysis"
  },
  "technical-course-pro": { 
    mode: "technical-course-pro", 
    priceUsd: 0.15, 
    labelInr: "~₹12", 
    labelUsd: "$0.15", 
    isFree: false,
    description: "Complete course with code examples"
  },
};

export function getPriceLabel(exchangeRate: number = 83): string {
  const usdPrice = 0.10;
  const inrPrice = Math.round(usdPrice * exchangeRate);
  return `₹${inrPrice} ($${usdPrice})`;
}

export function getTechnicalCourseProPrice(exchangeRate: number = 83): string {
  const usdPrice = 0.15;
  const inrPrice = Math.round(usdPrice * exchangeRate);
  return `₹${inrPrice} ($${usdPrice})`;
}

export function isPaidMode(mode: Mode): boolean {
  return !PRICING[mode].isFree;
}

export function getModeDescription(mode: Mode): string {
  return PRICING[mode].description;
}
