"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6S8.9 6.2 12 6.2c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.7 3.7 14.6 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12S6.9 21.2 12 21.2c5.2 0 8.6-3.6 8.6-8.7 0-.6-.1-1-.1-1.5H12z"
      />
      <path
        fill="#4285F4"
        d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6 0-.9.2-1.7.6-2.4l-3.1-2.4C2.9 8.7 2.8 10.3 2.8 12c0 5.1 4.1 9.2 9.2 9.2 5.2 0 8.6-3.6 8.6-8.7 0-.6-.1-1-.1-1.5H12z"
        opacity=".15"
      />
    </svg>
  );
}

export function LoginDialog() {
  const {
    loginOpen,
    setLoginOpen,
    signInWithGoogle,
    googleConfigured,
  } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);

  async function onGoogle() {
    setError(null);
    if (!accepted) {
      setError("Please accept the Terms and Privacy Policy to continue.");
      return;
    }
    if (!googleConfigured) {
      setError(
        "Google sign-in is not configured on this server yet. The owner must set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see README)."
      );
      return;
    }
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Google sign-in failed.");
    }
  }

  return (
    <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
      <DialogContent className="max-w-md rounded-[28px] border-[#E6DFD2] bg-[#FBF9F5] p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-display)] text-2xl text-[#0F172A]">
            Login with Google
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-[#64748B]">
            Choose your Google account to use Converter, Translator, Merger, and
            Compressor. As Data Fiduciary under India’s DPDP Act, we receive your
            Google name, email, and profile picture (when available), and record
            time spent, features used, and approximate location (browser geo
            and/or IP). You must be 18+. Details and rights (access, correction,
            erasure) are in{" "}
            <Link
              href="/privacy"
              className="font-semibold text-[#0F172A] underline"
            >
              Privacy
            </Link>{" "}
            and{" "}
            <Link
              href="/terms"
              className="font-semibold text-[#0F172A] underline"
            >
              Terms
            </Link>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <label className="flex items-start gap-3 text-sm text-[#475569]">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-[#CBD5E1]"
            />
            <span>
              I am 18 or older and agree to the Terms of Service and Privacy
              Policy, including Google sign-in identity, usage analytics, and
              approximate location processing.
            </span>
          </label>

          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {!googleConfigured ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Waiting on Google OAuth credentials. Redirect URI to register:{" "}
              <code className="break-all text-xs">
                https://convert-my-file-oo3r.onrender.com/api/auth/callback/google
              </code>
            </p>
          ) : null}

          <Button
            type="button"
            disabled={busy}
            onClick={() => void onGoogle()}
            className="w-full rounded-full bg-white text-[#0F172A] ring-1 ring-[#E6DFD2] hover:bg-[#F7F4EE]"
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting to Google…
              </>
            ) : (
              <>
                <GoogleGlyph className="mr-2 h-4 w-4" />
                Continue with Google
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
