import { AlertTriangle } from "lucide-react";

export function DisclosureBanner() {
  return (
    <div className="border-b border-[#E8E2D6] bg-[#101828] text-[#F7F4EE]">
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-5 py-3.5 text-sm sm:items-center sm:px-8">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37] sm:mt-0" />
        <p className="leading-relaxed text-[#CBD5E1]">
          <span className="font-semibold text-[#F7F4EE]">Disclosure:</span>{" "}
          Your files stay on your device. Processing is ephemeral and wiped
          after download or within{" "}
          <span className="font-semibold text-[#D4AF37]">3 minutes</span> if
          left idle. We don&apos;t build a document archive.
        </p>
      </div>
    </div>
  );
}
