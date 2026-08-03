"use client";

import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createBatch } from '@/lib/actions/batch-actions';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { BreedSelect } from '@/components/ui/BreedSelect';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { getBreedOptionsForCategory, LIVESTOCK_CATEGORY_OPTIONS, normalizeBreedValue } from '@/lib/livestock-breed-options';

import { FinancialInitializationModal } from '@/components/modals/FinancialInitializationModal';
import { LivestockType } from '@prisma/client';
import { createHouse } from '@/lib/actions/dashboard-actions';
import { Dialog } from '@/components/ui/Dialog';
import { toast } from 'sonner';
import { MutationBoundary } from '@/components/ui/MutationFeedback';

const formSchema = z.object({
  batchName: z.string().min(2, "Unit Name is required"),
  type: z.nativeEnum(LivestockType),
  breed: z.string().min(1, "Breed is required"),
  initialQuantity: z.number().min(1, "Quantity must be at least 1"),
  hatchDate: z.string().min(1, "Arrival date is required"),
  houseId: z.string().min(1, "House selection is required"),
  vaccinationDate: z.string().optional(),
  vaccineName: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface RegisterBatchFormProps {
  houses: Array<{
    id: string | number;
    name: string;
  }>;
  onSuccess?: () => void;
}

export function RegisterBatchForm({ houses, onSuccess }: RegisterBatchFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showFinModal, setShowFinModal] = React.useState(false);
  const [createdBatchId, setCreatedBatchId] = React.useState<string | null>(null);
  const [createdBatchName, setCreatedBatchName] = React.useState("");
  const [showHouseModal, setShowHouseModal] = React.useState(false);
  const [isCreatingHouse, setIsCreatingHouse] = React.useState(false);
  const [newHouseData, setNewHouseData] = React.useState({ name: '', capacity: '' });
  
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: LivestockType.POULTRY_BROILER,
      breed: "ross_308",
    },
  });

  const selectedType = watch("type");
  const selectedBreed = watch("breed");
  const selectedHouseId = watch("houseId");
  const breedOptions = React.useMemo(() => getBreedOptionsForCategory(selectedType), [selectedType]);

  React.useEffect(() => {
    if (selectedHouseId === "NEW_HOUSE") {
      setShowHouseModal(true);
      setValue("houseId", ""); // Reset dropdown to placeholder
    }
  }, [selectedHouseId, setValue]);

  React.useEffect(() => {
    const firstBreed = breedOptions[0]?.value ?? "";
    const hasSelectedBreed = breedOptions.some((option) => option.value === selectedBreed);

    if (firstBreed && !hasSelectedBreed) {
      setValue("breed", firstBreed, { shouldDirty: true, shouldValidate: true });
    }

    if (!firstBreed && selectedBreed) {
      setValue("breed", "", { shouldDirty: true, shouldValidate: true });
    }
  }, [breedOptions, selectedBreed, setValue]);

  const handleCreateHouse = async () => {
    if (isCreatingHouse) return;
    if (!newHouseData.name || !newHouseData.capacity) {
      toast.error("Please fill in house name and capacity");
      return;
    }
    setIsCreatingHouse(true);
    try {
      const res = await createHouse({
        houseNumber: newHouseData.name,
        capacity: parseInt(newHouseData.capacity)
      });
      if (res.success) {
        toast.success("House created successfully");
        setShowHouseModal(false);
        setNewHouseData({ name: '', capacity: '' });
        router.refresh();
        // After refresh, the new house will be in the props
        // We'll let the user select it from the updated list
      } else {
        toast.error(res.error || "Failed to create house");
      }
    } catch (e) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsCreatingHouse(false);
    }
  };

  if (houses.length === 0) {
    return (
      <div className="p-5 text-center space-y-3">
        <p className="text-gray-400">You don't have any active farm houses yet.</p>
        <p className="text-sm text-gray-500 italic">A farm house is required before you can register a new livestock unit.</p>
        <Button asChild className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold">
          <Link href="/dashboard/houses">Add New House First</Link>
        </Button>
      </div>
    );
  }

  const houseOptions = houses.map(h => ({ label: h.name, value: h.id.toString() }));
  
  const onSubmit = async (data: FormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await createBatch({
        houseId: data.houseId,
        breedType: normalizeBreedValue(data.breed),
        initialCount: data.initialQuantity,
        arrivalDate: data.hatchDate,
        batchName: data.batchName,
        type: data.type,
      });

      if (result.success && result.id) {
        setCreatedBatchId(result.id.toString());
        setCreatedBatchName(data.batchName);
        setShowFinModal(true);
        router.refresh();
      } else {
        alert("Error: " + result.error);
      }
    } catch (error) {
      alert("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinModalClose = () => {
    setShowFinModal(false);
    if (onSuccess) onSuccess();
  };

  return (
    <div className="w-full max-w-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <MutationBoundary active={isSubmitting} label="Registering livestock unit...">
        <fieldset disabled={isSubmitting} className="space-y-5 disabled:opacity-70">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Unit Name / Identity"
              placeholder="e.g., Q1-Broiler-Alpha"
              {...register("batchName")}
              error={errors.batchName?.message}
            />

            <Select
              label="Livestock Category"
              options={[...LIVESTOCK_CATEGORY_OPTIONS]}
              {...register("type")}
              error={errors.type?.message}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Controller
              name="breed"
              control={control}
              render={({ field }) => (
                <BreedSelect
                  label="Primary Breed / Specie"
                  options={breedOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.breed?.message}
                  required
                />
              )}
            />

            <Input
              label="Initial Quantity"
              type="number"
              min="1"
              placeholder="1000"
              {...register("initialQuantity", { valueAsNumber: true })}
              error={errors.initialQuantity?.message}
            />
          </div>

            <Select
              label="Farm House"
              options={[
                { label: "Select House Location", value: "" }, 
                ...houseOptions,
                { label: "➕ Add New House", value: "NEW_HOUSE" }
              ]}
              {...register("houseId")}
              error={errors.houseId?.message}
            />

          <Input
            label="Arrival / Hatch Date"
            type="date"
            {...register("hatchDate")}
            error={errors.hatchDate?.message}
          />

          <div className="border-t border-white/10 pt-3 mt-2">
            <h3 className="text-sm font-medium text-amber-500 mb-3 italic uppercase tracking-widest text-xs">Optional Initial Schedule</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="1st Vaccination Date"
                type="date"
                {...register("vaccinationDate")}
              />
              <Input
                label="Vaccine Name"
                placeholder="e.g., Gumboro"
                {...register("vaccineName")}
              />
            </div>
          </div>

          <div className="pt-3">
            <Button
              type="submit"
              isLoading={isSubmitting}
              loadingText="Registering unit..."
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#064e3b] font-bold h-14 rounded-lg uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(16,185,129,0.2)]"
            >
              Register Unit & Continue
            </Button>
          </div>
        </fieldset>
        </MutationBoundary>
      </form>

      {createdBatchId && (
        <FinancialInitializationModal 
          isOpen={showFinModal}
          onClose={handleFinModalClose}
          batchId={createdBatchId}
          batchName={createdBatchName}
          quantity={watch("initialQuantity") || 0}
        />
      )}

      <Dialog
        isOpen={showHouseModal}
        onOpenChange={(open) => !isCreatingHouse && setShowHouseModal(open)}
        title="➕ Create New Farm House"
        description="Add a new housing unit to your farm to accommodate this livestock unit."
      >
        <MutationBoundary active={isCreatingHouse} label="Creating house...">
        <div className="space-y-4 pt-3">
          <Input 
            label="House Name / Number"
            placeholder="e.g. House Alpha, Pen 1"
            value={newHouseData.name}
            onChange={e => setNewHouseData(p => ({ ...p, name: e.target.value }))}
            disabled={isCreatingHouse}
          />
          <Input 
            label="Total Capacity (Birds/Heads)"
            type="number"
            min="1"
            placeholder="e.g. 500"
            value={newHouseData.capacity}
            onChange={e => setNewHouseData(p => ({ ...p, capacity: e.target.value }))}
            disabled={isCreatingHouse}
          />
          <div className="flex gap-2 pt-2">
             <Button variant="secondary" onClick={() => setShowHouseModal(false)} disabled={isCreatingHouse} className="flex-1">Cancel</Button>
             <Button 
               onClick={handleCreateHouse} 
               isLoading={isCreatingHouse}
               loadingText="Creating..."
               className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
             >
               Create House
             </Button>
          </div>
        </div>
        </MutationBoundary>
      </Dialog>
    </div>
  );
}
