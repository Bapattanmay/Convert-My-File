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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-provider";

export function LoginDialog() {
  const { loginOpen, setLoginOpen, login } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accepted) {
      setError("Please accept the Terms and Privacy Policy to continue.");
      return;
    }
    setBusy(true);
    const result = await login(name.trim());
    setBusy(false);
    if (!result.ok) setError(result.error);
    else {
      setName("");
      setAccepted(false);
    }
  }

  return (
    <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
      <DialogContent className="max-w-md rounded-[28px] border-[#E6DFD2] bg-[#FBF9F5] p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-display)] text-2xl text-[#0F172A]">
            Login
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-[#64748B]">
            Enter your name to use Converter, Translator, Merger, and
            Compressor. We record your name, time spent, features used, and
            approximate location (browser geolocation when allowed, otherwise
            IP-based). See{" "}
            <Link href="/privacy" className="font-semibold text-[#0F172A] underline">
              Privacy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="font-semibold text-[#0F172A] underline">
              Terms
            </Link>
            .
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-name" className="text-[#0F172A]">
              Your name
            </Label>
            <Input
              id="login-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Chen"
              autoComplete="name"
              minLength={2}
              required
              className="rounded-xl border-[#E6DFD2] bg-white"
            />
          </div>

          <label className="flex items-start gap-3 text-sm text-[#475569]">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-[#CBD5E1]"
            />
            <span>
              I agree to the Terms of Service and Privacy Policy, including
              collection of usage analytics and location.
            </span>
          </label>

          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={busy || name.trim().length < 2}
            className="w-full rounded-full bg-[#0F172A] text-white hover:bg-[#1E293B]"
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Continue to workspace"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
