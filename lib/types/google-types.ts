/**
 * Minimal type declarations for the Google Identity Services script loaded at
 * runtime. Full types are large; only what the app uses is declared here.
 */

declare global {
  interface Window {
    google?: GoogleNamespace;
  }
}

export interface GoogleNamespace {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        prompt?: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: TokenError) => void;
      }) => TokenClient;
      initCodeClient: (config: {
        client_id: string;
        scope: string;
        ux_mode?: "popup" | "redirect";
        callback: (response: CodeResponse) => void;
        error_callback?: (error: TokenError) => void;
      }) => CodeClient;
      revoke: (token: string, callback?: () => void) => void;
    };
  };
}

export interface TokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

export interface CodeClient {
  requestCode: (overrideConfig?: { prompt?: string; hint?: string }) => void;
}

export interface CodeResponse {
  code: string;
  scope: string;
  authuser?: string;
  hd?: string;
  prompt?: string;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface TokenError {
  type: string;
  message?: string;
}

export {};
