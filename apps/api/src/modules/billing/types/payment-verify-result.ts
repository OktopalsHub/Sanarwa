export type PaymentVerifyStatus = "success" | "failed" | "pending";

export type PaymentVerifyResult = {
  status: PaymentVerifyStatus;
  /** Major currency units (e.g. 10.00 USD), when the provider returns it */
  amount?: number;
  currency?: string;
};
