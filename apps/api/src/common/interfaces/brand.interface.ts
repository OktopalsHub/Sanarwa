export interface WhiteLabelConfig {
  domains?: {
    primary?: string;
    tracking?: string;
    unsubscribe?: string;
    verified?: boolean;
    verifiedAt?: Date;
    verificationToken?: string;
    lastVerificationAttempt?: Date;
    verificationError?: string;
    // Cloudflare auto-setup
    cloudflareAutoSetup?: {
      attempted: boolean;
      successful: boolean;
      recordId?: string;
      error?: string;
      message?: string;
    };
    // SES-specific fields
    sesVerified?: boolean;
    sesVerifiedAt?: Date;
    sesVerificationToken?: string;
    sesVerificationStatus?: string;
    lastSESVerificationAttempt?: Date;
    sesVerificationError?: string;
    // Resend-specific fields
    resendVerified?: boolean;
    resendVerifiedAt?: Date;
    resendDomainId?: string;
    resendVerificationStatus?: string;
    lastResendVerificationAttempt?: Date;
    resendVerificationError?: string;
  };
  dkim?: {
    selector?: string;
    privateKey?: string;
    publicKey?: string;
    verified?: boolean;
    verifiedAt?: Date;
    lastVerificationAttempt?: Date;
    verificationError?: string;
    // Cloudflare auto-setup for DKIM
    cloudflareAutoSetup?: {
      attempted: boolean;
      successful: boolean;
      recordId?: string;
      selector?: string;
      error?: string;
      message?: string;
    };
    // SES-specific DKIM fields
    sesEnabled?: boolean;
    sesVerified?: boolean;
    sesVerifiedAt?: Date;
    sesDkimTokens?: string[];
    lastSESDkimAttempt?: Date;
    sesDkimError?: string;
  };
  dmarc?: {
    policy?: 'none' | 'quarantine' | 'reject';
    percentage?: number;
    reportEmail?: string;
    verified?: boolean;
    verifiedAt?: Date;
    lastVerificationAttempt?: Date;
    verificationError?: string;
  };
  senderId?: {
    domain?: string;
    verified?: boolean;
  };
  ssl?: {
    certificate?: string;
    privateKey?: string;
    verified?: boolean;
  };
}
