"use server";

import { getAuthContext } from "@/lib/auth-utils";
import { listDesktopLicenses } from "@/lib/hatchlog-api";

export type DesktopLicenseRow = {
  id: string;
  farmId: string;
  status: string;
  hardwareId: string | null;
  deviceName: string | null;
  deviceType: string | null;
  licenseExpiresAt: string | null;
  lastSync: string | null;
  userName: string | null;
  userEmail: string | null;
};

export async function getDesktopLicenses(): Promise<{
  isPaid: boolean;
  licenses: DesktopLicenseRow[];
}> {
  const { activeFarmId } = await getAuthContext();

  if (!activeFarmId) {
    throw new Error("No active farm selected");
  }

  return await listDesktopLicenses(activeFarmId) as {
    isPaid: boolean;
    licenses: DesktopLicenseRow[];
  };
}
