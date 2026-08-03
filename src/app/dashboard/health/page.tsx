import React from "react";
import { redirect } from "next/navigation";
import { HeartPulse } from "lucide-react";
import { getHealthSchedules, getHealthInventory } from "@/lib/actions/health-actions";
import { getAllBatches } from "@/lib/actions/dashboard-actions";
import { checkWorkerPermissions } from "@/lib/actions/staff-actions";
import { HealthScheduleManager } from "./HealthScheduleManager";

export default async function HealthPage() {
  const hasAccess = await checkWorkerPermissions("health", "view");
  const canEdit = await checkWorkerPermissions("health", "edit");

  if (!hasAccess) {
    redirect("/dashboard/unauthorized");
  }

  const [{ vaccinations, medications }, batches, { vaccine, medicine }] =
    await Promise.all([
      getHealthSchedules(),
      getAllBatches(),
      getHealthInventory(),
    ]);

  const activeBatches = JSON.parse(
    JSON.stringify(batches.filter((b: any) => b.status === "active"))
  );

  const pendingCount =
    vaccinations.filter((v: any) => v.status === "PENDING").length +
    medications.filter((m: any) => m.status === "PENDING").length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-0 md:px-3 pt-2 pb-7 md:py-7">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#0B1120] p-6 rounded-xl shadow-lg border border-gray-800 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-normal uppercase italic flex items-center gap-3">
            <HeartPulse className="w-8 h-8 text-emerald-400" />
            Vaccination &amp; Medication
          </h2>
          <p className="text-gray-400 mt-1">
            Plan and track every vaccine and medication schedule across your
            active batches — all in one place.
          </p>
        </div>
        <div className="bg-[#111827] px-5 py-3 rounded-xl border border-gray-800 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            Pending
          </p>
          <p className="text-3xl font-bold text-white">{pendingCount}</p>
        </div>
      </div>

      <HealthScheduleManager
        vaccinations={vaccinations}
        medications={medications}
        activeBatches={activeBatches}
        vaccineInventory={vaccine}
        medicineInventory={medicine}
        canEdit={canEdit}
      />
    </div>
  );
}
