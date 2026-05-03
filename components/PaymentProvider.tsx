"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface PaymentContextType {
  paymentState: "idle" | "modal_open" | "processing" | "success" | "error";
  pendingMode: "system-design-pro" | "pro" | null;
  pendingVideoId: string | null;
  startPayment: (mode: "system-design-pro" | "pro", videoId: string) => void;
  completePayment: () => void;
  cancelPayment: () => void;
  isPaid: (mode: "system-design-pro" | "pro", videoId: string) => boolean;
}

const PaymentContext = createContext<PaymentContextType | null>(null);

export function usePayment(): PaymentContextType {
  const ctx = useContext(PaymentContext);
  if (!ctx) throw new Error("usePayment must be used within PaymentProvider");
  return ctx;
}

export function PaymentProvider({ children }: { children: ReactNode }) {
  const [paymentState, setPaymentState] = useState<PaymentContextType["paymentState"]>("idle");
  const [pendingMode, setPendingMode] = useState<"system-design-pro" | "pro" | null>(null);
  const [pendingVideoId, setPendingVideoId] = useState<string | null>(null);

  const startPayment = useCallback((mode: "system-design-pro" | "pro", videoId: string) => {
    setPendingMode(mode);
    setPendingVideoId(videoId);
    setPaymentState("modal_open");
  }, []);

  const completePayment = useCallback(() => {
    setPaymentState("idle");
    setPendingMode(null);
    setPendingVideoId(null);
  }, []);

  const cancelPayment = useCallback(() => {
    setPaymentState("idle");
    setPendingMode(null);
    setPendingVideoId(null);
  }, []);

  const isPaid = useCallback((mode: "system-design-pro" | "pro", videoId: string): boolean => {
    if (typeof window === "undefined") return false;
    const key = `mockPayment_${mode}_${videoId}`;
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
        paymentState,
        pendingMode,
        pendingVideoId,
        startPayment,
        completePayment,
        cancelPayment,
        isPaid,
      }}
    >
      {children}
    </PaymentContext.Provider>
  );
}