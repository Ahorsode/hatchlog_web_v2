"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Clock3, Crown, Monitor, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { requestSubscriptionUpgrade } from "@/lib/actions/subscription-actions";
import { type DesktopLicenseRow } from "@/lib/actions/licenses";
import { type SubscriptionTier } from "@prisma/client";
import { cn } from "@/lib/utils";

type PaidTier = Extract<SubscriptionTier, "STANDARD" | "PREMIUM">;

type Plan = {
  name: string;
  tier: PaidTier;
  price: number;
  description: string;
  features: string[];
  color: string;
  shadow: string;
  icon: React.ElementType;
  popular?: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const plans: Plan[] = [
  {
    name: "Standard Pro",
    tier: "STANDARD",
    price: 350,
    description: "For commercial farms that need automation, team controls, and stronger reporting.",
    features: [
      "Up to 10 livestock units",
      "Advanced health analytics",
      "Full financial controls",
      "Inventory management",
      "Team management for 3 workers",
      "Email and WhatsApp notifications",
    ],
    color: "from-emerald-500 to-teal-400",
    shadow: "shadow-emerald-500/20",
    icon: Shield,
  },
  {
    name: "Enterprise Suite",
    tier: "PREMIUM",
    price: 950,
    description: "For large operations with multiple farms, unlimited teams, and priority support.",
    features: [
      "Unlimited livestock units",
      "Predictive analytics",
      "Custom financial reporting",
      "Multi-farm consolidation",
      "Unlimited team members",
      "Priority concierge support",
    ],
    color: "from-amber-400 to-orange-500",
    shadow: "shadow-amber-500/20",
    icon: Crown,
    popular: true,
  },
];

const monthOptions = [
  { months: 1, discount: 0 },
  { months: 3, discount: 0.05 },
  { months: 6, discount: 0.1 },
  { months: 12, discount: 0.15 },
];

function formatCurrency(value: number) {
  return `GHS ${new Intl.NumberFormat("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getMostRecentExpiry(devices: DesktopLicenseRow[]) {
  const expiries = devices
    .map((device) => (device.licenseExpiresAt ? new Date(device.licenseExpiresAt).getTime() : NaN))
    .filter((time) => !Number.isNaN(time));

  if (expiries.length === 0) return null;
  return new Date(Math.max(...expiries));
}

function getDeviceAccessLabel(device: DesktopLicenseRow) {
  const normalizedStatus = device.status.toUpperCase();
  const expiresAt = device.licenseExpiresAt ? new Date(device.licenseExpiresAt) : null;
  const expiryTime = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt.getTime() : null;
  const now = Date.now();

  if (normalizedStatus === "EXPIRED" || (expiryTime !== null && expiryTime < now)) {
    const daysAgo = expiryTime === null ? null : Math.max(0, Math.ceil((now - expiryTime) / DAY_MS));
    return daysAgo === null ? "Expired" : daysAgo === 0 ? "Expired today" : `Expired ${daysAgo} days ago`;
  }

  if (normalizedStatus === "CLOUD_TRIAL" && expiryTime !== null) {
    const daysLeft = Math.max(0, Math.ceil((expiryTime - now) / DAY_MS));
    return `Trial ends in ${daysLeft} days`;
  }

  if (normalizedStatus === "ACTIVE" && expiryTime !== null) {
    return `Active · ends ${formatDate(device.licenseExpiresAt)}`;
  }

  return device.status || "Pending";
}

function getTimerTone(expiry: Date | null, now: Date) {
  if (!expiry) return "border-white/15 bg-white/10 text-white/75";
  const remainingDays = (expiry.getTime() - now.getTime()) / DAY_MS;
  if (remainingDays < 3) return "border-red-300/30 bg-red-500/15 text-red-100";
  if (remainingDays < 7) return "border-amber-300/30 bg-amber-500/15 text-amber-100";
  return "border-emerald-300/30 bg-emerald-500/15 text-emerald-100";
}

function formatRemaining(expiry: Date | null, now: Date) {
  if (!expiry) return "No renewal date available";

  const remainingMs = expiry.getTime() - now.getTime();
  if (remainingMs <= 0) return "Expired";

  const days = Math.floor(remainingMs / DAY_MS);
  const hours = Math.floor((remainingMs % DAY_MS) / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((remainingMs % (60 * 1000)) / 1000);

  return `${days} days · ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} remaining`;
}

function getPlanLabel(tier: SubscriptionTier) {
  if (tier === "STANDARD") return "STANDARD PRO";
  if (tier === "PREMIUM") return "ENTERPRISE SUITE";
  return "BASIC FREE";
}

function getTermPricing(months: number, monthlyPrice: number) {
  const discount = monthOptions.find((option) => option.months === months)?.discount ?? 0;
  const subtotal = months * monthlyPrice;
  const total = subtotal * (1 - discount);

  return {
    total,
    discount,
    savings: subtotal - total,
  };
}

export default function LicenseUpgradeClient({
  currentTier,
  devices,
}: {
  currentTier: SubscriptionTier;
  devices: DesktopLicenseRow[];
}) {
  const router = useRouter();
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [now, setNow] = useState(() => new Date());
  const [isUpgrading, startTransition] = useTransition();
  const currentExpiry = useMemo(() => getMostRecentExpiry(devices), [devices]);

  React.useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  function handleUpgrade(tier: PaidTier) {
    startTransition(async () => {
      const result = await requestSubscriptionUpgrade(tier, selectedMonths);

      if (!result.success) {
        toast.error(result.error || "Failed to submit upgrade request");
        return;
      }

      toast.success(
        result.message ||
          "Upgrade request submitted. Complete payment to activate your plan.",
      );
      router.refresh();
    });
  }

  const standardPricing = getTermPricing(selectedMonths, 350);
  const enterprisePricing = getTermPricing(selectedMonths, 950);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-0 md:px-3 pt-2 pb-7 md:py-10">
      <section className="rounded-lg border border-white/10 bg-[#0f1115]/80 p-6 shadow-2xl shadow-black/25 backdrop-blur-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300/80">Your Current Plan</p>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-sm font-black tracking-[0.18em] text-emerald-100">
              {getPlanLabel(currentTier)}
            </span>
            {currentTier === "BASIC" ? (
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70">
                You are on the free plan. Upgrade to unlock advanced features.
              </p>
            ) : (
              <div className={cn("mt-4 inline-flex items-center gap-3 rounded-lg border px-4 py-3 font-bold", getTimerTone(currentExpiry, now))}>
                <Clock3 className="h-5 w-5" />
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] opacity-75">Your subscription renews in</p>
                  <p className="mt-1 text-lg">{formatRemaining(currentExpiry, now)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 border-t border-white/10 pt-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/40">Connected Desktop Devices</p>
          {devices.length === 0 ? (
            <p className="mt-3 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              No desktop connected yet. Download the desktop app to start your 30-day trial.
            </p>
          ) : (
            <div className="mt-3 grid gap-3">
              {devices.map((device) => (
                <div key={device.id} className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/75 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Monitor className="h-5 w-5 shrink-0 text-emerald-300" />
                    <span className="truncate font-semibold text-white">
                      {device.deviceName || device.hardwareId || "Unnamed desktop"}
                    </span>
                  </div>
                  <span className="font-medium text-white/65">{getDeviceAccessLabel(device)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-[#0f1115]/70 p-5 backdrop-blur-2xl">
        <div className="flex flex-wrap gap-3">
          {monthOptions.map((option) => {
            const selected = selectedMonths === option.months;
            return (
              <button
                key={option.months}
                type="button"
                onClick={() => setSelectedMonths(option.months)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-bold transition",
                  selected
                    ? "border-emerald-300 bg-emerald-400/15 text-emerald-100"
                    : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white",
                )}
              >
                {option.months} {option.months === 1 ? "Month" : "Months"}
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <p className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm font-semibold text-white/80">
            {selectedMonths} {selectedMonths === 1 ? "Month" : "Months"} Standard - {formatCurrency(standardPricing.total)}
            {standardPricing.discount > 0 ? (
              <span className="ml-2 text-emerald-300">
                ({Math.round(standardPricing.discount * 100)}% off · save {formatCurrency(standardPricing.savings)})
              </span>
            ) : null}
          </p>
          <p className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm font-semibold text-white/80">
            {selectedMonths} {selectedMonths === 1 ? "Month" : "Months"} Enterprise - {formatCurrency(enterprisePricing.total)}
            {enterprisePricing.discount > 0 ? (
              <span className="ml-2 text-emerald-300">
                ({Math.round(enterprisePricing.discount * 100)}% off · save {formatCurrency(enterprisePricing.savings)})
              </span>
            ) : null}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {plans.map((plan) => {
          const pricing = getTermPricing(selectedMonths, plan.price);
          const Icon = plan.icon;
          const isCurrent = currentTier === plan.tier;

          return (
            <div key={plan.tier} className="relative h-full">
              {plan.popular ? (
                <div className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-amber-500 px-5 py-1.5 text-xs font-bold uppercase tracking-widest text-black shadow-lg shadow-amber-500/40">
                  Most Popular
                </div>
              ) : null}

              <Card className="relative h-full overflow-hidden rounded-lg border-white/10 bg-[#0f1115]/75 p-7 backdrop-blur-2xl">
                <CardContent className="flex h-full flex-col gap-7 p-0">
                  <div className="space-y-3">
                    <div className={cn("h-16 w-16 rounded-md bg-gradient-to-br p-0.5 shadow-xl", plan.color, plan.shadow)}>
                      <div className="flex h-full w-full items-center justify-center rounded-md bg-[#0f1115]">
                        <Icon className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                      <p className="mt-2 text-sm font-medium leading-6 text-white/70">{plan.description}</p>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-white">GHS {plan.price}</span>
                    <span className="text-sm font-bold uppercase tracking-widest text-white/60">/ month</span>
                  </div>

                  <ul className="flex-1 space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm font-medium text-white/75">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                          <Check className="h-3 w-3 text-emerald-300" />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Selected term total</p>
                    <p className="mt-2 text-xl font-black text-white">
                      {selectedMonths} {selectedMonths === 1 ? "Month" : "Months"} - {formatCurrency(pricing.total)}
                    </p>
                    {pricing.discount > 0 ? (
                      <p className="mt-1 text-sm font-semibold text-emerald-300">
                        {Math.round(pricing.discount * 100)}% off · save {formatCurrency(pricing.savings)}
                      </p>
                    ) : null}
                  </div>

                  {isCurrent ? (
                    <div className="inline-flex h-14 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-400/10 text-sm font-black uppercase tracking-widest text-emerald-100">
                      Current Plan
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleUpgrade(plan.tier)}
                      isLoading={isUpgrading}
                      loadingText="Updating..."
                      disabled={isUpgrading}
                      className={cn(
                        "h-14 w-full rounded-lg font-bold uppercase tracking-widest",
                        plan.tier === "STANDARD"
                          ? "bg-emerald-500 text-[#064e3b] shadow-emerald-500/20 hover:bg-emerald-400"
                          : "bg-amber-500 text-[#451a03] shadow-amber-500/20 hover:bg-amber-400",
                      )}
                    >
                      Request Upgrade — {plan.name}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </section>
    </div>
  );
}
