import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-admin-sans",
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-admin-mono",
  weight: ["400", "500", "600"],
});

export const metadata = {
  title: "Admin · Convert My File",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  return (
    <div className={`${instrument.variable} ${jetbrains.variable}`}>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-[#F3F0E8] text-sm text-[#64748B]">
            Loading admin…
          </div>
        }
      >
        <AdminDashboard admin={admin} />
      </Suspense>
    </div>
  );
}
