export type PaymentVerifyStatus = "success" | "failed" | "pending";

export type PaymentVerifyResult = {
  status: PaymentVerifyStatus;
  amount?: number;
  currency?: string;
};
