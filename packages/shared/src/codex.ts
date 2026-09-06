/** Account connection and optional subscription research capabilities. */
export interface CodexCapabilities {
  enabled: boolean;
  generationEnabled: boolean;
}

export interface CodexAccountStatus {
  state: 'unavailable' | 'signed-out' | 'signing-in' | 'signed-in';
  account: { email: string | null; planType: string | null } | null;
  login: {
    loginId: string;
    verificationUrl: string;
    userCode: string;
    /** Local attempt deadline; the upstream code may expire sooner. */
    expiresAt: string;
  } | null;
  error: string | null;
  generationEnabled: boolean;
}
