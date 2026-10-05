"use client";

import { Loader2 } from "lucide-react";
import { AppLogo } from "@/app/_components/brand/AppLogo";
import { APP_NAME, APP_TAGLINE } from "@/lib/config/brand";
import { useAuth } from "./AuthProvider";

export function SignInScreen() {
  const { isReady, signIn } = useAuth();

  return (
    <div className="relative min-h-screen min-h-[100dvh] overflow-hidden">
      {/* Hero artwork — graphic sits on the right (see public/signin.jpg). */}
      <div
        className="absolute inset-0 bg-no-repeat bg-right bg-[length:auto_100%] max-lg:bg-center max-lg:bg-cover"
        style={{ backgroundImage: "url(/signin.jpg)" }}
        aria-hidden
      />
      {/* Keep copy readable on narrow viewports. */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-white via-white/95 to-white/80 max-lg:block lg:bg-gradient-to-r lg:from-white lg:via-white/92 lg:to-white/25"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-screen min-h-[100dvh] items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md lg:max-w-lg lg:mr-auto lg:ml-[max(2rem,6vw)] xl:ml-[max(3rem,10vw)]">
          <div className="mb-10 text-center lg:text-left">
            <div className="mb-6 flex justify-center lg:justify-start">
              <AppLogo size={72} priority href="/home" />
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-[2.75rem]">
              {APP_NAME}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-zinc-600 sm:text-lg">
              {APP_TAGLINE}
              <br />
              Files stay where they are — we just give them a better home.
            </p>
          </div>

          <button
            type="button"
            onClick={signIn}
            disabled={!isReady}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-zinc-200/90 bg-white text-base font-medium text-zinc-800 shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-colors hover:bg-zinc-50 disabled:opacity-50"
          >
            {!isReady ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                Loading Google sign-in…
              </>
            ) : (
              <>
                <GoogleLogo />
                Continue with Google
              </>
            )}
          </button>

          <p className="mt-8 text-center text-xs leading-relaxed text-zinc-500 lg:text-left">
            We use the standard Google OAuth flow. Your Drive credentials never touch our
            servers — Google handles all authentication directly.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}
