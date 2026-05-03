"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface PaymentContextType {
  showPaymentModal: boolean;
  pendingMode: "system-design-pro" | "pro" | null;
  pendingVideoId: string | null;
  pendingVideoTitle: string | null;
  openPayment: (mode: "system-design-pro" | "pro", videoId: string, videoTitle: string) => void;
  closePayment: () => void;
  isPaid: (mode: "system-design-pro" | "pro", videoId: string) => boolean;
}

const PaymentContext = createContext<PaymentContextType | null>(null);

export function usePayment(): PaymentContextType {
  const ctx = useContext(PaymentContext);
  if (!ctx) throw new Error("usePayment must be used within PaymentProvider");
  return ctx;
}

export function PaymentProvider({ children }: { children: ReactNode }) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingMode, setPendingMode] = useState<"system-design-pro" | "pro" | null>(null);
  const [pendingVideoId, setPendingVideoId] = useState<string | null>(null);
  const [pendingVideoTitle, setPendingVideoTitle] = useState<string | null>(null);

  const openPayment = useCallback((mode: "system-design-pro" | "pro", videoId: string, videoTitle: string) => {
    setPendingMode(mode);
    setPendingVideoId(videoId);
    setPendingVideoTitle(videoTitle);
    setShowPaymentModal(true);
  }, []);

  const closePayment = useCallback(() => {
    setShowPaymentModal(false);
    setPendingMode(null);
    setPendingVideoId(null);
    setPendingVideoTitle(null);
  }, []);

  const isPaid = useCallback((mode: "system-design-pro" | "pro", videoId: string): boolean => {
    if (typeof window === "undefined") return false;
    const key = `payment_${mode}_${videoId}`;
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return false;
      const data = JSON.parse(stored);
      return Date.now() < data.expiresAt;
    } catch {
      return false;
    }
  }, []);

  return (
    <PaymentContext.Provider
      value={{
        showPaymentModal,
        pendingMode,
        pendingVideoId,
        pendingVideoTitle,
        openPayment,
        closePayment,
        isPaid,
      }}
    >
      {children}
    </PaymentContext.Provider>
  );
}