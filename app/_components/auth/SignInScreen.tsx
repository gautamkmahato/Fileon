"use client";

import { HardDrive, Loader2 } from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { useAuth } from "./AuthProvider";

export function SignInScreen() {
  const { isReady, signIn } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 via-zinc-50 to-blue-50 p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 text-white mb-5">
            <HardDrive className="w-7 h-7" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            {APP_NAME}
          </h1>
          <p className="text-zinc-600 mt-3 leading-relaxed">
            {APP_TAGLINE} Files stay where they are — we just give them a better home.
          </p>
        </div>

        <button
          onClick={signIn}
          disabled={!isReady}
          className="w-full flex items-center justify-center gap-3 h-12 rounded-xl bg-white border border-zinc-200/80 text-zinc-800 font-medium hover:bg-zinc-50 disabled:opacity-50 shadow-sm transition-colors"
        >
          {!isReady ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading Google sign-in…
            </>
          ) : (
            <>
              <GoogleLogo />
              Continue with Google
            </>
          )}
        </button>

        <p className="text-xs text-zinc-500 text-center mt-6 leading-relaxed">
          We use the standard Google OAuth flow. Your Drive credentials never touch our
          servers — Google handles all authentication directly.
        </p>
      </div>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}
