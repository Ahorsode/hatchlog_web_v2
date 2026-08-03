'use client'

import React, { useMemo, useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
} from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { cn, formatDate } from '@/lib/utils'
import {
  createHealthSchedulesBulk,
  registerHealthInventoryItem,
  updateHealthScheduleStatus,
  deleteHealthSchedule,
  type HealthScheduleType,
  type HealthUsageType,
  type HealthScheduleInput,
} from '@/lib/actions/health-actions'

const CUSTOM = '__custom__'

const STATUS_OPTIONS = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

const UNIT_OPTIONS = ['dose', 'doses', 'ml', 'L', 'bottle', 'vial', 'sachet', 'tablet', 'capsule', 'g', 'kg', 'bag', 'unit'].map(
  (u) => ({ label: u, value: u })
)

interface InventoryOption {
  id: string
  itemName: string
  stockLevel: number
  unit: string
  usageType?: string | null
}

interface ScheduleRecord {
  id: string
  scheduledDate: string
  status: string
  notes?: string | null
  quantity?: number | string | null
  usageType?: string | null
  unit?: string | null
  vaccineName?: string
  medicationName?: string
}

interface DraftEntry extends HealthScheduleInput {
  _key: string
}

interface Props {
  batchId: string
  vaccinations: ScheduleRecord[]
  medications: ScheduleRecord[]
  vaccineInventory: InventoryOption[]
  medicineInventory: InventoryOption[]
  canEdit: boolean
}

function todayInputValue() {
  return new Date().toISOString().split('T')[0]
}

function normalizeUsage(value?: string | null): HealthUsageType {
  return value === 'ONE_TIME' || value === 'QUANTITY' ? value : 'QUANTITY'
}

export function FlockHealthSchedule({
  batchId,
  vaccinations,
  medications,
  vaccineInventory,
  medicineInventory,
  canEdit,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isSavingItem, setIsSavingItem] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [pendingInventorySelection, setPendingInventorySelection] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const [type, setType] = useState<HealthScheduleType>('VACCINATION')
  const [namePreset, setNamePreset] = useState('')
  const [customName, setCustomName] = useState('')
  const [newUsageType, setNewUsageType] = useState<HealthUsageType>('ONE_TIME')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('dose')
  const [scheduledDate, setScheduledDate] = useState(todayInputValue())
  const [status, setStatus] = useState('PENDING')
  const [notes, setNotes] = useState('')
  const [drafts, setDrafts] = useState<DraftEntry[]>([])

  const isVaccine = type === 'VACCINATION'
  const inventory = isVaccine ? vaccineInventory : medicineInventory

  const inventoryNameSet = useMemo(() => new Set(inventory.map((i) => i.itemName.toLowerCase())), [inventory])

  const nameOptions = useMemo(
    () => [
      { label: 'Select from inventory…', value: '' },
      ...inventory.map((m) => ({
        label: m.stockLevel > 0 ? `${m.itemName} — ${m.stockLevel} ${m.unit} in stock` : `${m.itemName} — out of stock`,
        value: m.itemName,
      })),
      { label: '➕ Add new (type your own)', value: CUSTOM },
    ],
    [inventory]
  )

  const isAddingNew = namePreset === CUSTOM
  const resolvedName = isAddingNew ? customName.trim() : namePreset
  const selectedItem = isAddingNew ? undefined : inventory.find((i) => i.itemName === namePreset)
  const isNewItem = isAddingNew && !!resolvedName && !inventoryNameSet.has(resolvedName.toLowerCase())
  const effectiveUsageType: HealthUsageType = isAddingNew ? newUsageType : normalizeUsage(selectedItem?.usageType)
  const showQuantity = effectiveUsageType === 'QUANTITY'
  const quantityOk = !showQuantity || Number(quantity) > 0
  const currentEntryValid = !!resolvedName && !!scheduledDate && quantityOk
  const totalToSave = drafts.length + (currentEntryValid ? 1 : 0)
  const canSave = canEdit && totalToSave > 0 && !isPending && !isSavingItem
  const canSaveToInventory =
    canEdit &&
    isAddingNew &&
    !!resolvedName &&
    isNewItem &&
    quantityOk &&
    !isPending &&
    !isSavingItem

  useEffect(() => {
    if (!pendingInventorySelection) return
    const match = inventory.find(
      (item) => item.itemName.toLowerCase() === pendingInventorySelection.toLowerCase()
    )
    if (!match) return
    setNamePreset(match.itemName)
    setCustomName('')
    setPendingInventorySelection(null)
  }, [inventory, pendingInventorySelection])

  function switchType(next: HealthScheduleType) {
    setType(next)
    setNamePreset('')
    setCustomName('')
    setNewUsageType('ONE_TIME')
    setQuantity('')
    setUnit('dose')
  }

  function handleNameChange(value: string) {
    setNamePreset(value)
    setQuantity('')
    if (value === CUSTOM) {
      setNewUsageType('ONE_TIME')
      setUnit('dose')
      return
    }
    const match = inventory.find((i) => i.itemName === value)
    if (match?.unit) setUnit(match.unit)
  }

  function clearItemFields() {
    setNamePreset('')
    setCustomName('')
    setNewUsageType('ONE_TIME')
    setQuantity('')
    setUnit('dose')
    setNotes('')
  }

  function buildCurrentEntry(): DraftEntry | null {
    if (!currentEntryValid) return null
    return {
      _key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      batchId,
      name: resolvedName,
      isNewItem,
      scheduledDate,
      status,
      usageType: effectiveUsageType,
      quantity: showQuantity ? Number(quantity) : 1,
      unit: showQuantity ? unit || selectedItem?.unit || 'unit' : selectedItem?.unit || 'dose',
      notes: notes.trim() || undefined,
    }
  }

  function handleAddToList() {
    setError(null)
    const entry = buildCurrentEntry()
    if (!entry) {
      setError('Fill in the name, date and quantity first.')
      return
    }
    setDrafts((prev) => [...prev, entry])
    clearItemFields()
  }

  function handleSaveToInventory() {
    if (!canSaveToInventory) return
    setError(null)
    setSuccessMsg(null)
    setIsSavingItem(true)

    startTransition(async () => {
      try {
        const result = await registerHealthInventoryItem({
          type,
          name: resolvedName,
          usageType: effectiveUsageType,
          quantity: showQuantity ? Number(quantity) : undefined,
          unit: unit || selectedItem?.unit || 'dose',
        })

        if (!result.success) {
          setError(result.error || 'Failed to add item to inventory')
          return
        }

        setSuccessMsg(result.message || `"${resolvedName}" saved to inventory.`)
        setPendingInventorySelection(result.itemName || resolvedName)
        router.refresh()
      } catch (err: any) {
        setError(err?.message || 'Failed to add item to inventory')
      } finally {
        setIsSavingItem(false)
      }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    setError(null)
    setSuccessMsg(null)

    const all = [...drafts]
    const current = buildCurrentEntry()
    if (current) all.push(current)
    if (all.length === 0) {
      setError('Add at least one vaccine or medication.')
      return
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
    }))

    startTransition(async () => {
      try {
        await createHealthSchedulesBulk(payload)
        setDrafts([])
        clearItemFields()
        setScheduledDate(todayInputValue())
        setStatus('PENDING')
        setShowForm(false)
        router.refresh()
      } catch (err: any) {
        setError(err?.message || 'Failed to save schedules')
      }
    })
  }

  function handleStatusChange(recordType: HealthScheduleType, id: string, nextStatus: string) {
    setError(null)
    startTransition(async () => {
      try {
        await updateHealthScheduleStatus({ type: recordType, id, status: nextStatus })
        router.refresh()
      } catch (err: any) {
        setError(err?.message || 'Failed to update status')
      }
    })
  }

  function handleDelete(recordType: HealthScheduleType, id: string) {
    setError(null)
    startTransition(async () => {
      try {
        await deleteHealthSchedule({ type: recordType, id })
        router.refresh()
      } catch (err: any) {
        setError(err?.message || 'Failed to delete schedule')
      }
    })
  }

  return (
    <div className="glass-morphism overflow-hidden rounded-lg shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-5 py-4">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase italic tracking-normal text-white">
          <Syringe className="h-4 w-4 text-amber-400" /> Health Schedule
        </h3>
        {canEdit ? (
          <button
            onClick={() => setShowForm((v) => !v)}
            disabled={isPending}
            className="rounded-md border border-amber-500/20 bg-amber-500/10 p-1.5 text-amber-400 transition-all hover:bg-amber-500/20 disabled:opacity-50"
            aria-label="Add health schedule"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="space-y-4 p-5">
        {showForm && canEdit ? (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => switchType('VACCINATION')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-bold uppercase tracking-widest transition-all',
                  isVaccine ? 'border-amber-500/40 bg-amber-500/20 text-amber-300' : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                )}
              >
                <Syringe className="h-4 w-4" /> Vaccine
              </button>
              <button
                type="button"
                onClick={() => switchType('MEDICATION')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-bold uppercase tracking-widest transition-all',
                  !isVaccine ? 'border-sky-500/40 bg-sky-500/20 text-sky-300' : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                )}
              >
                <Pill className="h-4 w-4" /> Medication
              </button>
            </div>

            <Select
              label={isVaccine ? 'Vaccine' : 'Medication'}
              options={nameOptions}
              value={namePreset}
              onChange={(e) => handleNameChange(e.target.value)}
            />

            <p className="-mt-1 flex items-center gap-1.5 text-xs italic text-white/50">
              <Boxes className="h-3.5 w-3.5 text-sky-400/70" />
              {inventory.length > 0
                ? 'Sourced from your inventory stock.'
                : `No ${isVaccine ? 'vaccine' : 'medicine'} in stock — use "Add new".`}
            </p>

            {isAddingNew ? (
              <Input
                label={isVaccine ? 'New Vaccine Name' : 'New Medication Name'}
                placeholder={isVaccine ? 'e.g. Newcastle Lasota' : 'e.g. Florfenicol'}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                autoFocus
              />
            ) : null}

            {isAddingNew ? (
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/70">Usage</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewUsageType('ONE_TIME')}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all',
                      newUsageType === 'ONE_TIME' ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300' : 'border-white/10 bg-white/5 text-white/60'
                    )}
                  >
                    One-time
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewUsageType('QUANTITY')}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all',
                      newUsageType === 'QUANTITY' ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300' : 'border-white/10 bg-white/5 text-white/60'
                    )}
                  >
                    Quantity
                  </button>
                </div>
              </div>
            ) : null}

            {isNewItem && resolvedName ? (
              <p className="-mt-1 flex items-center gap-1.5 text-xs italic text-emerald-300/80">
                <Sparkles className="h-3.5 w-3.5" />
                Save to inventory first, then select it — or Add Schedule to save both together.
              </p>
            ) : null}

            {!isAddingNew && selectedItem ? (
              <p className="-mt-1 flex items-center gap-1.5 text-xs italic text-white/50">
                <Zap className="h-3.5 w-3.5 text-emerald-400/70" />
                {showQuantity ? `Quantity-tracked (in ${selectedItem.unit}).` : 'One-time use item.'}
              </p>
            ) : null}

            {showQuantity ? (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Quantity"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 250"
                  value={quantity}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '' || Number(v) >= 0) setQuantity(v)
                  }}
                />
                {isAddingNew ? (
                  <Select label="Unit" options={UNIT_OPTIONS} value={unit} onChange={(e) => setUnit(e.target.value)} />
                ) : (
                  <Input label="Unit" value={selectedItem?.unit || unit} disabled />
                )}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Input label="Scheduled Date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
              <Select label="Status" options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value)} />
            </div>

            <Input label="Notes (optional)" placeholder="Dosage, route…" value={notes} onChange={(e) => setNotes(e.target.value)} />

            {drafts.length > 0 ? (
              <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-bold uppercase tracking-widest text-white/60">Staged ({drafts.length})</p>
                {drafts.map((d) => (
                  <div key={d._key} className="flex items-center gap-2 rounded-md bg-black/20 px-3 py-2 text-xs">
                    {d.type === 'VACCINATION' ? (
                      <Syringe className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                    ) : (
                      <Pill className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                    )}
                    <span className="truncate font-bold text-white">{d.name}</span>
                    <span className="text-white/40">·</span>
                    <span className="text-white/60">{d.usageType === 'QUANTITY' ? `${d.quantity} ${d.unit}` : 'One-time'}</span>
                    <button
                      type="button"
                      onClick={() => setDrafts((prev) => prev.filter((x) => x._key !== d._key))}
                      className="ml-auto text-red-400/70 hover:text-red-400"
                      aria-label="Remove staged item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {error ? <p className="text-xs font-bold uppercase tracking-wider text-red-400">{error}</p> : null}
            {successMsg ? <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">{successMsg}</p> : null}

            {isAddingNew && resolvedName ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveToInventory}
                disabled={!canSaveToInventory}
                isLoading={isSavingItem}
                loadingText="Saving…"
                className="w-full border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/20"
              >
                <Boxes className="h-4 w-4" />
                Save “{resolvedName}” to inventory
              </Button>
            ) : null}

            <p className="flex items-center gap-1.5 text-xs italic text-white/40">
              <ListPlus className="h-3.5 w-3.5" /> Then pick it from the list and Add Schedule.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" size="sm" onClick={handleAddToList} disabled={!currentEntryValid || isPending}>
                <ListPlus className="h-4 w-4" /> Add another
              </Button>
              <Button type="submit" size="sm" isLoading={isPending} disabled={!canSave}>
                <Plus className="h-4 w-4" />
                {totalToSave > 1 ? `Save ${totalToSave}` : 'Add Schedule'}
              </Button>
            </div>
          </form>
        ) : null}

        <ScheduleGroup
          title="Vaccinations"
          icon={<Syringe className="h-3.5 w-3.5 text-amber-400" />}
          accent="amber"
          type="VACCINATION"
          records={vaccinations}
          canEdit={canEdit}
          isPending={isPending}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
        <ScheduleGroup
          title="Medications"
          icon={<Pill className="h-3.5 w-3.5 text-sky-400" />}
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
  )
}

function usageLabel(rec: ScheduleRecord): string | null {
  const qty = rec.quantity != null ? Number(rec.quantity) : null
  if (rec.usageType === 'QUANTITY' && qty && qty > 0) return `${qty} ${rec.unit || 'units'}`
  if (rec.usageType === 'ONE_TIME') return 'One-time'
  return null
}

function ScheduleGroup({
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
  title: string
  icon: React.ReactNode
  accent: 'amber' | 'sky'
  type: HealthScheduleType
  records: ScheduleRecord[]
  canEdit: boolean
  isPending: boolean
  onStatusChange: (t: HealthScheduleType, id: string, status: string) => void
  onDelete: (t: HealthScheduleType, id: string) => void
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02]">
      <div className={cn('flex items-center gap-2 border-b border-white/10 px-4 py-2.5', accent === 'amber' ? 'bg-amber-950/20' : 'bg-sky-950/20')}>
        {icon}
        <h4 className={cn('text-xs font-bold uppercase tracking-wide', accent === 'amber' ? 'text-amber-400' : 'text-sky-400')}>{title}</h4>
        <span className="ml-auto text-xs font-bold text-white/40">{records.length}</span>
      </div>

      {records.length === 0 ? (
        <div className="py-6 text-center text-xs italic text-white/40">Nothing scheduled.</div>
      ) : (
        <div className="divide-y divide-white/5">
          {records.map((rec) => {
            const name = rec.vaccineName ?? rec.medicationName ?? '—'
            const date = new Date(rec.scheduledDate)
            const isPast = date < today
            const isDone = rec.status === 'COMPLETED'
            const isCancelled = rec.status === 'CANCELLED'
            const usage = usageLabel(rec)

            return (
              <div key={rec.id} className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-white/[0.03]">
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                ) : isCancelled ? (
                  <XCircle className="h-4 w-4 flex-shrink-0 text-gray-500" />
                ) : (
                  <Circle className={cn('h-4 w-4 flex-shrink-0', isPast ? 'text-red-400' : accent === 'amber' ? 'text-amber-400' : 'text-sky-400')} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn('truncate text-xs font-bold', isCancelled ? 'text-gray-500 line-through' : 'text-white')}>{name}</p>
                    {usage ? (
                      <span className="flex-shrink-0 rounded border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white/60">
                        {usage}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/55">
                    <span className="flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      {formatDate(date)}
                    </span>
                    {isPast && !isDone && !isCancelled ? <span className="font-bold text-red-400">· Overdue</span> : null}
                  </div>
                </div>

                {canEdit ? (
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <select
                      value={rec.status}
                      disabled={isPending}
                      onChange={(e) => onStatusChange(type, rec.id, e.target.value)}
                      className="h-8 cursor-pointer rounded-md border border-white/10 bg-white/10 px-1.5 text-[11px] font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
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
                      className="rounded-md border border-red-500/20 bg-red-500/10 p-1.5 text-red-400 transition-all hover:bg-red-500/20 disabled:opacity-50"
                      aria-label="Delete schedule"
                    >
                      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ) : (
                  <span
                    className={cn(
                      'flex-shrink-0 rounded border px-2 py-1 text-[10px] font-bold uppercase',
                      isDone
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                        : isCancelled
                          ? 'border-gray-500/20 bg-gray-500/10 text-gray-400'
                          : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                    )}
                  >
                    {rec.status}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
