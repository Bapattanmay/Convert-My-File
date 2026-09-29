"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConverterTool } from "@/components/tools/converter-tool";
import { TranslatorTool } from "@/components/tools/translator-tool";
import { MergerTool } from "@/components/tools/merger-tool";
import { CompressorTool } from "@/components/tools/compressor-tool";
import { PremiumDesk } from "@/components/premium/premium-desk";
import { useAuth } from "@/components/auth-provider";

const TABS = [
  { value: "converter", label: "Converter" },
  { value: "translator", label: "Translator" },
  { value: "merger", label: "Merger" },
  { value: "compressor", label: "Compressor" },
  { value: "premium", label: "Premium" },
] as const;

const TRACKABLE = new Set(["converter", "translator", "merger", "compressor"]);

function GateOverlay() {
  const { setLoginOpen, loading } = useAuth();
  if (loading) {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[28px] bg-[#FBF9F5]/85 backdrop-blur-[2px]">
        <p className="text-sm font-medium text-[#64748B]">Checking session…</p>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-[28px] bg-[#FBF9F5]/92 p-6 text-center backdrop-blur-[2px]">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F172A] text-[#D4AF37]">
        <Lock className="h-5 w-5" />
      </span>
      <div>
        <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[#0F172A]">
          Google login required
        </p>
        <p className="mt-2 max-w-sm text-sm text-[#64748B]">
          Sign in with Google to use Converter, Translator, Merger, and
          Compressor. We record your Google identity, usage time, features, and
          approximate location per our Privacy Policy.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setLoginOpen(true)}
        className="rounded-full bg-[#0F172A] px-6 py-3 text-sm font-semibold tracking-[0.12em] text-white"
      >
        Login
      </button>
    </div>
  );
}

export function ToolsSection() {
  const { user, trackFeature } = useAuth();
  const gated = !user;
  const [tab, setTab] = useState("converter");

  useEffect(() => {
    if (user && TRACKABLE.has(tab)) trackFeature(tab);
  }, [user, tab, trackFeature]);

  return (
    <section id="tools" className="border-b border-[#E6DFD2]/80">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#C5A880]">
            WORKSPACE
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
            Choose a tool. Shape the file. Download and forget.
          </h2>
          {gated ? (
            <p className="mt-3 text-sm text-[#64748B]">
              Tools unlock after Google Login. Identity and usage analytics help
              us operate and improve the platform.
            </p>
          ) : null}
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v)}
          className="mt-10 gap-6"
        >
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 rounded-[22px] bg-[#EFEAE1]/90 p-2 shadow-inner">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="rounded-full px-4 py-2.5 text-sm font-semibold text-[#64748B] transition data-active:bg-gradient-to-r data-active:from-[#0F172A] data-active:to-[#1E293B] data-active:text-[#D4AF37] data-active:shadow-[0_12px_28px_rgba(15,23,42,0.2)]"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="relative rounded-[32px] border border-[#E6DFD2]/90 bg-white/90 p-4 shadow-[0_28px_80px_rgba(15,23,42,0.07)] backdrop-blur-sm sm:p-6">
            {gated ? <GateOverlay /> : null}

            <TabsContent value="converter" className="outline-none">
              <ConverterTool />
            </TabsContent>
            <TabsContent value="translator" className="outline-none">
              <TranslatorTool />
            </TabsContent>
            <TabsContent value="merger" className="outline-none">
              <MergerTool />
            </TabsContent>
            <TabsContent value="compressor" className="outline-none">
              <CompressorTool />
            </TabsContent>
            <TabsContent value="premium" className="outline-none">
              <PremiumDesk />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </section>
  );
}
