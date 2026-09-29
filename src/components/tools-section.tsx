"use client";

import { Crown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConverterTool } from "@/components/tools/converter-tool";
import { TranslatorTool } from "@/components/tools/translator-tool";
import { MergerTool } from "@/components/tools/merger-tool";
import { CompressorTool } from "@/components/tools/compressor-tool";

const TABS = [
  { value: "converter", label: "Converter" },
  { value: "translator", label: "Translator" },
  { value: "merger", label: "Merger" },
  { value: "compressor", label: "Compressor" },
  { value: "premium", label: "Premium" },
] as const;

export function ToolsSection() {
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
        </div>

        <Tabs defaultValue="converter" className="mt-10 gap-6">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 rounded-[22px] bg-[#EFEAE1]/90 p-2 shadow-inner">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-full px-4 py-2.5 text-sm font-semibold text-[#64748B] transition data-active:bg-gradient-to-r data-active:from-[#0F172A] data-active:to-[#1E293B] data-active:text-[#D4AF37] data-active:shadow-[0_12px_28px_rgba(15,23,42,0.2)]"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="rounded-[32px] border border-[#E6DFD2]/90 bg-white/90 p-4 shadow-[0_28px_80px_rgba(15,23,42,0.07)] backdrop-blur-sm sm:p-6">
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
              <div className="rounded-[28px] border border-[#E8E2D6] bg-[#FBF9F5] p-8 text-center sm:p-12">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0F172A] text-[#D4AF37]">
                  <Crown className="h-6 w-6" />
                </span>
                <h3 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-bold text-[#0F172A]">
                  Premium desk
                </h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#64748B]">
                  Recognize ID unlocks priority queues, batch jobs, and signed
                  wipe receipts. Core tools remain free — Premium is UI-ready
                  and awaiting identity binding.
                </p>
                <button
                  type="button"
                  className="mt-6 rounded-full bg-[#0F172A] px-6 py-3 text-sm font-semibold tracking-[0.12em] text-white"
                >
                  RECOGNIZE ID
                </button>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </section>
  );
}
