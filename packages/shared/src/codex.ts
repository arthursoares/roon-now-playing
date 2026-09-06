/** Account connection only; subscription facts generation is not enabled yet. */
export interface CodexCapabilities {
  enabled: boolean;
  generationEnabled: false;
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
  generationEnabled: false;
}
