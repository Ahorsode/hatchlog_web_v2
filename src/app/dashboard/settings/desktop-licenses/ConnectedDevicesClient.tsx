"use client";

import Link from "next/link";
import { Clock3, Monitor, RefreshCw, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { type DesktopLicenseRow } from "@/lib/actions/licenses";
import { cn } from "@/lib/utils";

interface ConnectedDevicesClientProps {
  licenses: DesktopLicenseRow[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function formatShortDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatRelativeTime(value: string | null) {
  if (!value) return "Never seen";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never seen";

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const divisions = [
    { amount: 60, unit: "second" },
    { amount: 60, unit: "minute" },
    { amount: 24, unit: "hour" },
    { amount: 7, unit: "day" },
    { amount: 4.345, unit: "week" },
    { amount: 12, unit: "month" },
    { amount: Number.POSITIVE_INFINITY, unit: "year" },
  ] as const;

  let duration = diffSeconds;
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
        Math.round(duration),
        division.unit,
      );
    }
    duration /= division.amount;
  }

  return "Never seen";
}

function daysBetween(start: number, end: number) {
  return Math.max(0, Math.ceil(Math.abs(end - start) / DAY_MS));
}

function getAccessStatus(license: DesktopLicenseRow) {
  const normalizedStatus = license.status.toUpperCase();
  const expiresAt = license.licenseExpiresAt ? new Date(license.licenseExpiresAt) : null;
  const expiryTime = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt.getTime() : null;
  const now = Date.now();
  const isPastExpiry = expiryTime !== null && expiryTime < now;

  if (normalizedStatus === "EXPIRED" || isPastExpiry) {
    const daysAgo = expiryTime === null ? null : daysBetween(now, expiryTime);
    return {
      label: daysAgo === null ? "Expired" : daysAgo === 0 ? "Expired today" : `Expired ${daysAgo} days ago`,
      shortLabel: "Expired",
      className: "border-red-300/35 bg-red-500/15 text-red-100",
    };
  }

  if (normalizedStatus === "CLOUD_TRIAL" && expiryTime !== null) {
    return {
      label: `Trial · ${daysBetween(now, expiryTime)} days left`,
      shortLabel: "Trial",
      className: "border-amber-300/35 bg-amber-500/15 text-amber-100",
    };
  }

  if (normalizedStatus === "ACTIVE" && expiryTime !== null) {
    return {
      label: `Active · ends ${formatShortDate(license.licenseExpiresAt)}`,
      shortLabel: "Active",
      className: "border-emerald-300/35 bg-emerald-500/15 text-emerald-100",
    };
  }

  if (normalizedStatus === "ACTIVE") {
    return {
      label: "Active · no expiry recorded",
      shortLabel: "Active",
      className: "border-emerald-300/35 bg-emerald-500/15 text-emerald-100",
    };
  }

  return {
    label: license.status || "Unknown",
    shortLabel: license.status || "Unknown",
    className: "border-white/15 bg-white/10 text-white/75",
  };
}

function getDeviceKind(deviceType: string | null) {
  return deviceType?.toUpperCase() === "MOBILE" || deviceType === "Mobile" ? "MOBILE" : "DESKTOP";
}

export default function ConnectedDevicesClient({ licenses }: ConnectedDevicesClientProps) {
  if (licenses.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="border border-white/15 bg-black/40 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-white">
              <Monitor className="h-5 w-5 text-emerald-300" />
              No Connected Devices
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="max-w-2xl text-sm leading-6 text-white/70">
              The desktop app automatically registers this farm on first login. Once a device signs in,
              it will appear here with its trial or subscription status.
            </p>
            <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-100">
              No keys are needed. Devices receive access when your farm subscription is active.
            </div>
          </CardContent>
        </Card>
        <UpgradeLink />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border border-white/15 bg-black/40 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-white">
            <Monitor className="h-5 w-5 text-emerald-300" />
            Connected Devices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-white/10">
            <div className="grid grid-cols-[180px_minmax(0,1fr)_120px_130px_220px_160px] gap-4 border-b border-white/10 bg-white/5 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white/50 max-xl:hidden">
              <span>User</span>
              <span>Device Name</span>
              <span>Type</span>
              <span>Status</span>
              <span>Trial / Expiry</span>
              <span>Last Seen</span>
            </div>
            <div className="divide-y divide-white/10">
              {licenses.map((license) => {
                const deviceKind = getDeviceKind(license.deviceType);
                const DeviceIcon = deviceKind === "MOBILE" ? Smartphone : Monitor;
                const access = getAccessStatus(license);
                const deviceName = license.deviceName || license.hardwareId || "Unnamed device";

                return (
                  <div
                    key={license.id}
                    className="grid grid-cols-1 gap-3 px-4 py-4 text-sm text-white/80 xl:grid-cols-[180px_minmax(0,1fr)_120px_130px_220px_160px] xl:items-center xl:gap-4"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-semibold text-white">{license.userName ?? "-"}</p>
                      {license.userEmail ? (
                        <p className="mt-0.5 truncate text-xs text-white/45">{license.userEmail}</p>
                      ) : null}
                    </div>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-emerald-200">
                        <DeviceIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{deviceName}</p>
                        {license.hardwareId ? (
                          <p className="mt-1 truncate font-[var(--font-payment-admin-mono)] text-xs text-white/45">
                            {license.hardwareId}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <span className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-white/70">
                        {deviceKind}
                      </span>
                    </div>
                    <div>
                      <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-bold", access.className)}>
                        {access.shortLabel}
                      </span>
                    </div>
                    <div className={cn("inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold", access.className)}>
                      <Clock3 className="h-3.5 w-3.5" />
                      {access.label}
                    </div>
                    <div className="flex items-center gap-2 text-white/70">
                      <RefreshCw className="h-4 w-4 text-white/40" />
                      <span>Last seen: {formatRelativeTime(license.lastSync)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
      <UpgradeLink />
    </div>
  );
}

function UpgradeLink() {
  return (
    <p className="mt-8 text-sm text-white/50">
      To extend access for all connected devices,{" "}
      <Link href="/dashboard/license-upgrade" className="text-emerald-400 underline">
        upgrade your subscription
      </Link>
      .
    </p>
  );
}
