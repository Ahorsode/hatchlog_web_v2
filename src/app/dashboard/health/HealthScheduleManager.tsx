"use client";

import React, { useMemo, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Syringe,
  Pill,
  Plus,
  Trash2,
  CalendarClock,
  CheckCircle2,
  Circle,
  XCircle,
  Loader2,
  Boxes,
  ListPlus,
  Sparkles,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { cn, formatDate } from "@/lib/utils";
import { formatLivestockType } from "@/lib/utils/growth-utils";
import {
  createHealthSchedulesBulk,
  registerHealthInventoryItem,
  updateHealthScheduleStatus,
  deleteHealthSchedule,
  type HealthScheduleType,
  type HealthUsageType,
  type HealthScheduleInput,
} from "@/lib/actions/health-actions";

const CUSTOM = "__custom__";

const STATUS_OPTIONS = [
  { label: "Pending", value: "PENDING" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const UNIT_OPTIONS = [
  "dose",
  "doses",
  "ml",
  "L",
  "bottle",
  "vial",
  "sachet",
  "tablet",
  "capsule",
  "g",
  "kg",
  "bag",
  "unit",
].map((u) => ({ label: u, value: u }));

interface Batch {
  id: string;
  batchName?: string | null;
  type?: string | null;
}

interface InventoryOption {
  id: string;
  itemName: string;
  stockLevel: number;
  unit: string;
  usageType?: string | null;
}

interface ScheduleRecord {
  id: string;
  scheduledDate: string;
  status: string;
  notes?: string | null;
  quantity?: number | string | null;
  usageType?: string | null;
  unit?: string | null;
  vaccineName?: string;
  medicationName?: string;
  batch?: { id: string; batchName?: string | null; type?: string | null } | null;
}

// A pending row the user has staged but not yet saved.
interface DraftEntry extends HealthScheduleInput {
  _key: string;
  batchLabel: string;
}

interface Props {
  vaccinations: ScheduleRecord[];
  medications: ScheduleRecord[];
  activeBatches: Batch[];
  vaccineInventory: InventoryOption[];
  medicineInventory: InventoryOption[];
  canEdit: boolean;
}

function todayInputValue() {
  return new Date().toISOString().split("T")[0];
}

function normalizeUsage(value?: string | null): HealthUsageType {
  return value === "ONE_TIME" || value === "QUANTITY" ? value : "QUANTITY";
}

export function HealthScheduleManager({
  vaccinations,
  medications,
  activeBatches,
  vaccineInventory,
  medicineInventory,
  canEdit,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pendingInventorySelection, setPendingInventorySelection] = useState<string | null>(null);

  // Form state
  const [type, setType] = useState<HealthScheduleType>("VACCINATION");
  const [batchId, setBatchId] = useState<string>("");
  const [namePreset, setNamePreset] = useState<string>("");
  const [customName, setCustomName] = useState<string>("");
  // Usage type the user picks ONLY when defining a brand-new item.
  const [newUsageType, setNewUsageType] = useState<HealthUsageType>("ONE_TIME");
  const [quantity, setQuantity] = useState<string>("");
  const [unit, setUnit] = useState<string>("dose");
  const [scheduledDate, setScheduledDate] = useState<string>(todayInputValue());
  const [status, setStatus] = useState<string>("PENDING");
  const [notes, setNotes] = useState<string>("");

  // Staged rows for "add multiple at once".
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);

  const isVaccine = type === "VACCINATION";
  const inventory = isVaccine ? vaccineInventory : medicineInventory;

  const inventoryNameSet = useMemo(
    () => new Set(inventory.map((i) => i.itemName.toLowerCase())),
    [inventory]
  );

  const batchOptions = useMemo(
    () => [
      { label: "Select a batch…", value: "" },
      ...activeBatches.map((b, i) => ({
        label: `${b.batchName || `Unit ${i + 1}`}${b.type ? ` · ${formatLivestockType(b.type)}` : ""}`,
        value: b.id,
      })),
    ],
    [activeBatches]
  );

  // Vaccines AND medications both come strictly from the farm's own inventory
  // stock — no hardcoded preset list. "Add new" defines a brand-new item.
  const nameOptions = useMemo(() => {
    return [
      { label: "Select from inventory…", value: "" },
      ...inventory.map((m) => ({
        label:
          m.stockLevel > 0
            ? `${m.itemName} — ${m.stockLevel} ${m.unit} in stock`
            : `${m.itemName} — out of stock`,
        value: m.itemName,
      })),
      { label: "➕ Add new (type your own)", value: CUSTOM },
    ];
  }, [inventory]);

  const isAddingNew = namePreset === CUSTOM;
  const resolvedName = isAddingNew ? customName.trim() : namePreset;
  const selectedItem = isAddingNew
    ? undefined
    : inventory.find((i) => i.itemName === namePreset);

  const isNewItem =
    isAddingNew &&
    !!resolvedName &&
    !inventoryNameSet.has(resolvedName.toLowerCase());

  // When adding new, the user chooses the usage. When an existing item is
  // selected, the usage is whatever was set when that item was created.
  const effectiveUsageType: HealthUsageType = isAddingNew
    ? newUsageType
    : normalizeUsage(selectedItem?.usageType);
  const showQuantity = effectiveUsageType === "QUANTITY";

  const batchLabel =
    batchOptions.find((o) => o.value === batchId)?.label ?? "Unknown batch";

  const quantityOk = !showQuantity || Number(quantity) > 0;
  const currentEntryValid =
    !!batchId && !!resolvedName && !!scheduledDate && quantityOk;

  const totalToSave = drafts.length + (currentEntryValid ? 1 : 0);
  const canSave = canEdit && totalToSave > 0 && !isPending && !isSavingItem;
  const canSaveToInventory =
    canEdit &&
    isAddingNew &&
    !!resolvedName &&
    isNewItem &&
    quantityOk &&
    !isPending &&
    !isSavingItem;

  useEffect(() => {
    if (!pendingInventorySelection) return;
    const match = inventory.find(
      (item) => item.itemName.toLowerCase() === pendingInventorySelection.toLowerCase()
    );
    if (!match) return;
    setNamePreset(match.itemName);
    setCustomName("");
    setPendingInventorySelection(null);
  }, [inventory, pendingInventorySelection]);

  function switchType(next: HealthScheduleType) {
    setType(next);
    setNamePreset("");
    setCustomName("");
    setNewUsageType("ONE_TIME");
    setQuantity("");
    setUnit("dose");
  }

  // Selecting a name resolves its usage + unit from inventory (existing item)
  // or resets to defaults for a brand-new item.
  function handleNameChange(value: string) {
    setNamePreset(value);
    setQuantity("");
    if (value === CUSTOM) {
      setNewUsageType("ONE_TIME");
      setUnit("dose");
      return;
    }
    const match = inventory.find((i) => i.itemName === value);
    if (match?.unit) setUnit(match.unit);
  }

  function clearItemFields() {
    setNamePreset("");
    setCustomName("");
    setNewUsageType("ONE_TIME");
    setQuantity("");
    setUnit("dose");
    setNotes("");
  }

  function buildCurrentEntry(): DraftEntry | null {
    if (!currentEntryValid) return null;
    return {
      _key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      batchId,
      batchLabel,
      name: resolvedName,
      isNewItem,
      scheduledDate,
      status,
      usageType: effectiveUsageType,
      quantity: showQuantity ? Number(quantity) : 1,
      unit: showQuantity
        ? unit || selectedItem?.unit || "unit"
        : selectedItem?.unit || "dose",
      notes: notes.trim() || undefined,
    };
  }

  function handleAddToList() {
    setError(null);
    setSuccessMsg(null);
    const entry = buildCurrentEntry();
    if (!entry) {
      setError("Fill in the batch, name, date and quantity first.");
      return;
    }
    setDrafts((prev) => [...prev, entry]);
    clearItemFields();
  }

  function removeDraft(key: string) {
    setDrafts((prev) => prev.filter((d) => d._key !== key));
  }

  function handleSaveToInventory() {
    if (!canSaveToInventory) return;
    setError(null);
    setSuccessMsg(null);
    setIsSavingItem(true);

    startTransition(async () => {
      try {
        const result = await registerHealthInventoryItem({
          type,
          name: resolvedName,
          usageType: effectiveUsageType,
          quantity: showQuantity ? Number(quantity) : undefined,
          unit: unit || selectedItem?.unit || "dose",
        });

        if (!result.success) {
          setError(result.error || "Failed to add item to inventory");
          return;
        }

        setSuccessMsg(result.message || `"${resolvedName}" saved to inventory.`);
        setPendingInventorySelection(result.itemName || resolvedName);
        router.refresh();
      } catch (err: any) {
        setError(err?.message || "Failed to add item to inventory");
      } finally {
        setIsSavingItem(false);
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setError(null);
    setSuccessMsg(null);

    const all = [...drafts];
    const current = buildCurrentEntry();
    if (current) all.push(current);
    if (all.length === 0) {
      setError("Add at least one vaccine or medication.");
      return;
    }

    const payload: HealthScheduleInput[] = all.map((d) => ({
      type: d.type,
      batchId: d.batchId,
      name: d.name,
      isNewItem: d.isNewItem,
      scheduledDate: d.scheduledDate,
      status: d.status,
      usageType: d.usageType,
      quantity: d.quantity,
      unit: d.unit,
      notes: d.notes,
    }));

    startTransition(async () => {
      try {
        await createHealthSchedulesBulk(payload);
        setDrafts([]);
        setBatchId("");
        clearItemFields();
        setScheduledDate(todayInputValue());
        setStatus("PENDING");
        router.refresh();
      } catch (err: any) {
        setError(err?.message || "Failed to save schedules");
      }
    });
  }

  function handleStatusChange(
    recordType: HealthScheduleType,
    id: string,
    nextStatus: string
  ) {
    setError(null);
    startTransition(async () => {
      try {
        await updateHealthScheduleStatus({ type: recordType, id, status: nextStatus });
        router.refresh();
      } catch (err: any) {
        setError(err?.message || "Failed to update status");
      }
    });
  }

  function handleDelete(recordType: HealthScheduleType, id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await deleteHealthSchedule({ type: recordType, id });
        router.refresh();
      } catch (err: any) {
        setError(err?.message || "Failed to delete schedule");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* New schedule form */}
      {canEdit ? (
        <Card className="border border-gray-800 bg-[#111827]">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <Plus className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white uppercase tracking-normal italic">
                New Health Schedule
              </h3>
            </div>

            {/* Type toggle */}
            <div className="flex gap-2 mb-5">
              <button
                type="button"
                onClick={() => switchType("VACCINATION")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-bold uppercase tracking-widest transition-all",
                  isVaccine
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                )}
              >
                <Syringe className="w-4 h-4" /> Vaccination
              </button>
              <button
                type="button"
                onClick={() => switchType("MEDICATION")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-bold uppercase tracking-widest transition-all",
                  !isVaccine
                    ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                    : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                )}
              >
                <Pill className="w-4 h-4" /> Medication
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Batch"
                  options={batchOptions}
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                />
                <Select
                  label={isVaccine ? "Vaccine" : "Medication"}
                  options={nameOptions}
                  value={namePreset}
                  onChange={(e) => handleNameChange(e.target.value)}
                />
              </div>

              <p className="-mt-1 flex items-center gap-1.5 text-xs text-white/50 italic">
                <Boxes className="w-3.5 h-3.5 text-sky-400/70" />
                {inventory.length > 0
                  ? `${isVaccine ? "Vaccines" : "Medications"} are sourced from your Inventory stock.`
                  : `No ${isVaccine ? "vaccine" : "medicine"} in inventory yet — use “Add new”, or stock it under Inventory first.`}
              </p>

              {isAddingNew && (
                <Input
                  label={isVaccine ? "New Vaccine Name" : "New Medication Name"}
                  placeholder={isVaccine ? "e.g. Newcastle Lasota" : "e.g. Florfenicol"}
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  autoFocus
                />
              )}

              {/* Usage type — ONLY shown when adding a brand-new item. */}
              {isAddingNew && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-white/70 block mb-2">
                    Usage (set once for this new item)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewUsageType("ONE_TIME")}
                      className={cn(
                        "flex-1 px-3 py-2.5 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all",
                        newUsageType === "ONE_TIME"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                      )}
                    >
                      One-time use
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewUsageType("QUANTITY")}
                      className={cn(
                        "flex-1 px-3 py-2.5 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all",
                        newUsageType === "QUANTITY"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                      )}
                    >
                      Set quantity
                    </button>
                  </div>
                </div>
              )}

              {isNewItem && resolvedName && (
                <p className="-mt-1 flex items-center gap-1.5 text-xs text-emerald-300/80 italic">
                  <Sparkles className="w-3.5 h-3.5" />
                  Save “{resolvedName}” to inventory first, then select it here — or pick a batch
                  and use Add Schedule to save the item and schedule together.
                </p>
              )}

              {/* For an EXISTING item, show its locked usage type (read-only). */}
              {!isAddingNew && selectedItem && (
                <p className="-mt-1 flex items-center gap-1.5 text-xs text-white/50 italic">
                  <Zap className="w-3.5 h-3.5 text-emerald-400/70" />
                  {showQuantity
                    ? `Quantity-tracked item (in ${selectedItem.unit}).`
                    : "One-time use item — no quantity needed."}
                </p>
              )}

              {/* Quantity inputs — shown whenever the resolved usage is QUANTITY. */}
              {showQuantity && (
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Quantity"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 250"
                    value={quantity}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || Number(v) >= 0) setQuantity(v);
                    }}
                  />
                  {isAddingNew ? (
                    <Select
                      label="Unit"
                      options={UNIT_OPTIONS}
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                    />
                  ) : (
                    <Input label="Unit" value={selectedItem?.unit || unit} disabled />
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Scheduled Date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
                <Select
                  label="Status"
                  options={STATUS_OPTIONS}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                />
              </div>

              <Input
                label="Notes (optional)"
                placeholder="Dosage, route, vet instructions…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              {/* Staged list for multi-add */}
              {drafts.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-white/60">
                    Staged to save ({drafts.length})
                  </p>
                  {drafts.map((d) => (
                    <div
                      key={d._key}
                      className="flex items-center gap-2 text-xs bg-black/20 rounded-md px-3 py-2"
                    >
                      {d.type === "VACCINATION" ? (
                        <Syringe className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <Pill className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      )}
                      <span className="font-bold text-white truncate">{d.name}</span>
                      <span className="text-white/40">·</span>
                      <span className="text-white/60 truncate">{d.batchLabel}</span>
                      <span className="text-white/40">·</span>
                      <span className="text-white/60">
                        {d.usageType === "QUANTITY"
                          ? `${d.quantity} ${d.unit}`
                          : "One-time"}
                      </span>
                      {d.isNewItem && (
                        <span className="text-emerald-300/80">· new</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeDraft(d._key)}
                        className="ml-auto text-red-400/70 hover:text-red-400"
                        aria-label="Remove staged item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <p className="text-xs text-red-400 font-bold uppercase tracking-wider">
                  {error}
                </p>
              )}

              {successMsg && (
                <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">
                  {successMsg}
                </p>
              )}

              {isAddingNew && resolvedName && (
                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-300 mb-2">
                    Step 1 — Stock this item
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveToInventory}
                    disabled={!canSaveToInventory}
                    isLoading={isSavingItem}
                    loadingText="Saving…"
                    className="w-full sm:w-auto border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/20"
                  >
                    <Boxes className="w-4 h-4" />
                    Save “{resolvedName}” to inventory
                  </Button>
                  <p className="mt-2 text-xs text-white/50 italic">
                    No batch required. After saving, it appears in the {isVaccine ? "Vaccine" : "Medication"} dropdown above.
                  </p>
                </div>
              )}

              <p className="flex items-center gap-1.5 text-xs text-white/40 italic">
                <ListPlus className="w-3.5 h-3.5" />
                Step 2 — Select a batch, then Add Schedule (or stage several with “Add another”).
              </p>

              <div className="flex flex-col sm:flex-row justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddToList}
                  disabled={!currentEntryValid || isPending}
                >
                  <ListPlus className="w-4 h-4" /> Add another
                </Button>
                <Button type="submit" isLoading={isPending} disabled={!canSave}>
                  <Plus className="w-4 h-4" />
                  {totalToSave > 1 ? `Save ${totalToSave} schedules` : "Add Schedule"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-[#1F2937]/50 rounded-lg border border-dashed border-gray-700 p-5 text-center text-sm italic text-gray-500">
          You have read-only access to health schedules.
        </div>
      )}

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ScheduleList
          title="Vaccination Schedule"
          icon={<Syringe className="w-4 h-4 text-amber-400" />}
          accent="amber"
          type="VACCINATION"
          records={vaccinations}
          canEdit={canEdit}
          isPending={isPending}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
        <ScheduleList
          title="Medication Schedule"
          icon={<Pill className="w-4 h-4 text-sky-400" />}
          accent="sky"
          type="MEDICATION"
          records={medications}
          canEdit={canEdit}
          isPending={isPending}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}

function usageLabel(rec: ScheduleRecord): string | null {
  const qty = rec.quantity != null ? Number(rec.quantity) : null;
  if (rec.usageType === "QUANTITY" && qty && qty > 0) {
    return `${qty} ${rec.unit || "units"}`;
  }
  if (rec.usageType === "ONE_TIME") return "One-time";
  return null;
}

function ScheduleList({
  title,
  icon,
  accent,
  type,
  records,
  canEdit,
  isPending,
  onStatusChange,
  onDelete,
}: {
  title: string;
  icon: React.ReactNode;
  accent: "amber" | "sky";
  type: HealthScheduleType;
  records: ScheduleRecord[];
  canEdit: boolean;
  isPending: boolean;
  onStatusChange: (t: HealthScheduleType, id: string, status: string) => void;
  onDelete: (t: HealthScheduleType, id: string) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="bg-[#111827] rounded-xl shadow-xl border border-gray-800 overflow-hidden">
      <div
        className={cn(
          "px-5 py-4 border-b border-gray-800 flex items-center gap-2",
          accent === "amber" ? "bg-amber-950/30" : "bg-sky-950/30"
        )}
      >
        {icon}
        <h3
          className={cn(
            "font-bold uppercase tracking-wide text-sm",
            accent === "amber" ? "text-amber-400" : "text-sky-400"
          )}
        >
          {title}
        </h3>
        <span className="ml-auto text-xs font-bold text-white/40">
          {records.length}
        </span>
      </div>

      {records.length === 0 ? (
        <div className="py-16 text-center text-white/50 text-sm italic">
          No {accent === "amber" ? "vaccinations" : "medications"} scheduled yet.
        </div>
      ) : (
        <div className="divide-y divide-gray-800">
          {records.map((rec) => {
            const name = rec.vaccineName ?? rec.medicationName ?? "—";
            const date = new Date(rec.scheduledDate);
            const isPast = date < today;
            const isDone = rec.status === "COMPLETED";
            const isCancelled = rec.status === "CANCELLED";
            const usage = usageLabel(rec);

            return (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 px-5 py-3 hover:bg-[#1F2937] transition-colors"
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : isCancelled ? (
                  <XCircle className="w-4 h-4 text-gray-500 flex-shrink-0" />
                ) : (
                  <Circle
                    className={cn(
                      "w-4 h-4 flex-shrink-0",
                      isPast ? "text-red-400" : accent === "amber" ? "text-amber-400" : "text-sky-400"
                    )}
                  />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      className={cn(
                        "text-sm font-bold truncate",
                        isCancelled ? "text-gray-500 line-through" : "text-white"
                      )}
                    >
                      {name}
                    </p>
                    {usage && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-white/10 text-white/60 border border-white/10 flex-shrink-0">
                        {usage}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/60 mt-0.5">
                    <span className="font-medium truncate">
                      {rec.batch?.batchName || "Unknown batch"}
                    </span>
                    <span className="text-white/20">·</span>
                    <span className="flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />
                      {formatDate(date)}
                    </span>
                    {isPast && !isDone && !isCancelled && (
                      <span className="text-red-400 font-bold">· Overdue</span>
                    )}
                  </div>
                  {rec.notes && (
                    <p className="text-xs text-white/40 italic mt-1 truncate">
                      {rec.notes}
                    </p>
                  )}
                </div>

                {canEdit ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={rec.status}
                      disabled={isPending}
                      onChange={(e) => onStatusChange(type, rec.id, e.target.value)}
                      className="h-9 rounded-md border border-white/10 bg-white/10 px-2 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer disabled:opacity-50"
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value} className="bg-[#064e3b]">
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => onDelete(type, rec.id)}
                      className="p-2 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50"
                      aria-label="Delete schedule"
                    >
                      {isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ) : (
                  <span
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold uppercase border flex-shrink-0",
                      isDone
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : isCancelled
                        ? "bg-gray-500/10 text-gray-400 border-gray-500/20"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    )}
                  >
                    {rec.status}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
