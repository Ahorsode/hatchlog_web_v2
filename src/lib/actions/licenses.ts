"use server";

import prisma from "@/lib/db";
import { getAuthContext } from "@/lib/auth-utils";

function serializeLicense(registration: {
  id: string;
  farmId: string;
  status: string;
  hardwareId: string | null;
  deviceName: string | null;
  deviceType: string | null;
  licenseExpiresAt: Date | null;
  lastSync: Date | null;
  user: {
    firstname: string | null;
    surname: string | null;
    email: string | null;
    name: string | null;
  } | null;
}) {
  const displayName =
    [registration.user?.firstname, registration.user?.surname]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    registration.user?.name ||
    null;

  return {
    id: registration.id,
    farmId: registration.farmId,
    status: registration.status,
    hardwareId: registration.hardwareId,
    deviceName: registration.deviceName,
    deviceType: registration.deviceType,
    licenseExpiresAt: registration.licenseExpiresAt?.toISOString() ?? null,
    lastSync: registration.lastSync?.toISOString() ?? null,
    userName: displayName,
    userEmail: registration.user?.email ?? null,
  };
}

export type DesktopLicenseRow = ReturnType<typeof serializeLicense>;

export async function getDesktopLicenses() {
  const { activeFarmId } = await getAuthContext();

  if (!activeFarmId) {
    throw new Error("No active farm selected");
  }

  const licenses = await prisma.deviceRegistration.findMany({
    where: { farmId: activeFarmId },
    select: {
      id: true,
      farmId: true,
      status: true,
      hardwareId: true,
      deviceName: true,
      deviceType: true,
      licenseExpiresAt: true,
      lastSync: true,
      user: {
        select: {
          firstname: true,
          surname: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: {
      lastSync: "desc"
    }
  });

  const isPaid = licenses.some((license) => license.status === "ACTIVE");

  return { isPaid, licenses: licenses.map(serializeLicense) };
}
