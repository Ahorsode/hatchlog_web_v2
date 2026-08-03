import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";
import { validateEnv } from "@/lib/env-check";
import "./globals.css";

// Fail fast on missing runtime config unless CI explicitly skips validation.
validateEnv();

export const metadata: Metadata = {
  title: "Agri-ERP | Enterprise Farm Management System",
  description: "Next-generation multi-species livestock management platform. Track performance, inventory, and health for Poultry, Cattle, and Pigs with precision.",
  keywords: ["Agri-ERP", "Farm Management", "Poultry PMS", "Livestock Tracking", "Agriculture Software"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevents auto-zoom on input focus in iOS
};

import AuthProvider from "@/components/providers/SessionProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en">
        <body className="antialiased bg-[#0a0a0a] min-h-screen text-white font-sans">
          <AuthProvider>
            <div className="fixed inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-950/20 via-[#0a0a0a] to-[#0a0a0a]" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px]" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px]" />
          </div>
          {children}
          <Toaster richColors position="top-right" theme="dark" />
          <SpeedInsights />
          </AuthProvider>
        </body>
      </html>
  );
}
