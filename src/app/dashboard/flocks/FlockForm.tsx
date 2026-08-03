'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { BreedSelect } from '@/components/ui/BreedSelect';
import { createBatch, updateBatch, logHealthEvent } from '@/lib/actions/batch-actions';
import { createIsolationRoom } from '@/lib/actions/dashboard-actions';
import { Activity, Skull } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MutationBoundary } from '@/components/ui/MutationFeedback';
import {
  getBreedOptionsForCategory,
  LIVESTOCK_CATEGORY_OPTIONS,
  normalizeBreedValue,
} from '@/lib/livestock-breed-options';

interface LivestockFormProps {
  houses: { id: string; name: string }[];
  isolationRooms?: { id: string; name: string; capacity: number }[];
  batch?: any;
  mode: 'create' | 'edit' | 'delete' | 'mortality';
  defaultHealthType?: 'DEAD' | 'SICK';
  onClose: () => void;
}

const MORTALITY_REASONS: Record<string, string[]> = {
  "Disease": ["Newcastle disease", "Avian influenza", "Gumboro", "Marek’s disease", "Salmonellosis", "Fowl cholera", "Colibacillosis", "Coccidiosis", "Worm infestation"],
  "Environmental": ["Heat stress", "Cold stress", "Poor ventilation", "High ammonia", "Overcrowding"],
  "Nutrition": ["Malnutrition", "Vitamin deficiency", "Moldy feed", "Poor-quality feed"],
  "Water Issues": ["Dirty water", "Dehydration", "Water system failure"],
  "Parasites": ["Mites", "Lice", "Ticks", "Worms"],
  "Management Error": ["Poor vaccination", "Mixing age groups", "Rough handling", "Poor biosecurity"],
  "Toxicity": ["Aflatoxin", "Chemical poisoning", "Drug overdose"],
  "Predators": ["Dog attack", "Snake attack", "Bird attack"],
  "Stress": ["Transport stress", "Noise stress", "Environmental change"],
  "Brooding": ["Wrong temperature", "Weak chicks", "Poor brooding care"],
  "Genetic": ["Weak breed", "Birth defect"],
  "Injury/Accident": ["Cannibalism", "Trampling", "Equipment injury"],
  "Unknown": ["Unknown cause yet"],
  "Other": ["Other"]
};

export const LivestockForm = ({ houses, isolationRooms = [], batch, mode, defaultHealthType, onClose }: LivestockFormProps) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    houseId: batch?.houseId || (houses[0]?.id || ''),
    batchName: batch?.batchName || '',
    type: batch?.type || 'POULTRY_BROILER',
    breedType: normalizeBreedValue(batch?.breedType) || 'ross_308',
    initialCount: batch?.initialCount || '' as number | '',
    growthTargetOverride: batch?.growthTargetOverride || '',
    arrivalDate: batch?.arrivalDate ? new Date(batch.arrivalDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    status: batch?.status || 'active',
    mortalityCount: '',
    category: mode === 'mortality' ? 'Unknown' : '',
    subCategory: mode === 'mortality' ? 'Unknown cause yet' : '',
    reason: '',
    healthType: defaultHealthType || ('DEAD' as 'SICK' | 'DEAD'),
    isolationRoomId: mode === 'mortality' ? (isolationRooms[0]?.id?.toString() || '') : '',
    newRoomName: '',
    newRoomCapacity: '',
  });
  const breedOptions = React.useMemo(() => getBreedOptionsForCategory(formData.type), [formData.type]);

  React.useEffect(() => {
    const firstBreed = breedOptions[0]?.value ?? '';
    const hasSelectedBreed = breedOptions.some((option) => option.value === formData.breedType);

    if (firstBreed && !hasSelectedBreed) {
      setFormData((current) => ({ ...current, breedType: firstBreed }));
    }

    if (!firstBreed && formData.breedType) {
      setFormData((current) => ({ ...current, breedType: '' }));
    }
  }, [breedOptions, formData.breedType]);

  React.useEffect(() => {
    if (mode !== 'mortality' || formData.healthType !== 'SICK' || formData.isolationRoomId) return;
    const firstRoomId = isolationRooms[0]?.id?.toString();
    if (!firstRoomId) return;
    setFormData((current) => ({ ...current, isolationRoomId: firstRoomId }));
  }, [mode, formData.healthType, formData.isolationRoomId, isolationRooms]);

  const handleSubmit = async (e: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    try {
      let res;
      if (mode === 'create') {
        res = await createBatch({
          houseId: String(formData.houseId),
          batchName: formData.batchName,
          breedType: normalizeBreedValue(formData.breedType),
          type: formData.type as any,
          initialCount: Number(formData.initialCount) || 0,
          arrivalDate: formData.arrivalDate,
        });
      } else if (mode === 'edit') {
        res = await updateBatch(batch.id, {
          houseId: String(formData.houseId),
          batchName: formData.batchName,
          breedType: normalizeBreedValue(formData.breedType),
          type: formData.type as any,
          growthTargetOverride: formData.growthTargetOverride,
          initialCount: Number(formData.initialCount) || 0,
          arrivalDate: formData.arrivalDate,
          status: formData.status,
        });
      } else if (mode === 'mortality') {
        let finalIsolationRoomId = formData.isolationRoomId;
        
        // Handle dynamic room creation
        if (formData.healthType === 'SICK' && formData.isolationRoomId === 'add_new') {
          if (!formData.newRoomName) {
            toast.error("Please enter a room name");
            setIsLoading(false);
            return;
          }
          const roomRes = await createIsolationRoom({
            name: formData.newRoomName,
            capacity: Number(formData.newRoomCapacity) || 0
          });
          if (roomRes.success) {
            finalIsolationRoomId = (roomRes.room as any).id.toString();
          } else {
            toast.error(roomRes.error || "Failed to create isolation room");
            setIsLoading(false);
            return;
          }
        }

        res = await logHealthEvent({
          batchId: batch.id,
          type: formData.healthType,
          count: Number(formData.mortalityCount) || 0,
          isolationRoomId: formData.healthType === 'SICK' ? String(finalIsolationRoomId) : undefined,
          category: formData.category,
          subCategory: formData.category === 'Unknown' ? 'Unknown cause yet' : formData.subCategory,
          reason: formData.reason,
          logDate: new Date().toISOString(),
        });
      }

      if (res?.success) {
        toast.success('Operation successful');
        onClose();
        router.refresh();
      } else {
        toast.error(res?.error || 'Operation failed');
      }
    } catch (error) {
      console.error(error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };



  const currentRemaining = batch?.currentCount || 0;
  const isMortalityExceeded = mode === 'mortality' && Number(formData.mortalityCount) > currentRemaining;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <MutationBoundary
        active={isLoading}
        label={mode === 'create' ? 'Registering unit...' : mode === 'edit' ? 'Saving changes...' : formData.healthType === 'SICK' ? 'Transferring to isolation...' : 'Logging mortality...'}
      >
      <fieldset disabled={isLoading} className="space-y-3 disabled:opacity-70">
        {mode === 'mortality' ? (
          <>
          {!defaultHealthType && (
            <div className="flex gap-2 p-1 bg-white/5 border border-white/5 rounded-lg mb-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, healthType: 'DEAD' })}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md font-bold text-xs uppercase tracking-wider transition-all ${
                  formData.healthType === 'DEAD' 
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30 shadow-sm' 
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Skull className="w-4 h-4" />
                Mortality (Dead)
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, healthType: 'SICK' })}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md font-bold text-xs uppercase tracking-wider transition-all ${
                  formData.healthType === 'SICK' 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm' 
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Activity className="w-4 h-4" />
                Sickness (Sick)
              </button>
            </div>
          )}

          <div className="space-y-1">
            <Input
              label={formData.healthType === 'DEAD' ? "Mortality Count" : "Sickness Count"}
              type="number"
              min="0"
              value={formData.mortalityCount}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val > currentRemaining) {
                  return;
                }
                setFormData({ ...formData, mortalityCount: e.target.value });
              }}
              required
              placeholder={formData.healthType === 'DEAD' ? "How many were lost?" : "How many are showing symptoms?"}
              className={isMortalityExceeded ? "border-red-500 focus:ring-red-500" : ""}
            />
            <p className={`text-[11px] font-medium ${isMortalityExceeded ? "text-red-600 animate-pulse" : "text-gray-500"}`}>
              {isMortalityExceeded 
                ? `❌ Error: Only ${currentRemaining} birds remaining. Input exceeds population.`
                : `Info: ${currentRemaining} birds remaining in this batch.`}
            </p>
          </div>
          {/* Health Details: Isolation Room (Show only if not DEAD) */}
          {formData.healthType === 'SICK' && (
            <div className="space-y-3">
              <Select
                label="Transfer to Isolation Room"
                options={[
                  { label: 'Select Room (Optional)...', value: '' },
                  ...isolationRooms.map(room => ({ label: `${room.name} (Cap: ${room.capacity})`, value: room.id.toString() })),
                  { label: '+ Add New Room', value: 'add_new' }
                ]}
                value={formData.isolationRoomId}
                onChange={(e) => setFormData({ ...formData, isolationRoomId: e.target.value })}
              />

              {formData.isolationRoomId === 'add_new' && (
                <div className="grid grid-cols-2 gap-3 p-4 bg-emerald-950/40 rounded-lg border border-emerald-500/20 animate-in slide-in-from-top-2">
                  <Input
                    label="New Room Name"
                    placeholder="e.g., Room A"
                    value={formData.newRoomName}
                    onChange={(e) => setFormData({ ...formData, newRoomName: e.target.value })}
                    required
                  />
                  <Input
                    label="Capacity"
                    type="number"
                    placeholder="50"
                    value={formData.newRoomCapacity}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val < 0) return;
                      setFormData({ ...formData, newRoomCapacity: e.target.value });
                    }}
                    required
                  />
                </div>
              )}
            </div>
          )}

          <Select
            label="Condition/Reason"
            options={[
              { label: 'Select Category...', value: '' },
              ...Object.keys(MORTALITY_REASONS).map(cat => ({ label: cat, value: cat }))
            ]}
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value, subCategory: '' })}
            required
          />
          {formData.category && formData.category !== 'Unknown' && (
            <Select
              label="Specific Symptom/Cause"
              options={[
                { label: 'Select Sub-Category...', value: '' },
                ...MORTALITY_REASONS[formData.category].map(sub => ({ label: sub, value: sub }))
              ]}
              value={formData.subCategory}
              onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
              required
            />
          )}
          <Input
            label="Additional Notes"
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            placeholder="Briefly describe the health incident..."
          />
          </>
        ) : (
          <>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Unit Identity / Name"
              value={formData.batchName}
              onChange={(e) => setFormData({ ...formData, batchName: e.target.value })}
              required
              placeholder="e.g. Batch Q1"
            />
            <Select
              label="House Assignment"
              options={houses.map(h => ({ label: h.name, value: h.id }))}
              value={formData.houseId}
              onChange={(e) => setFormData({ ...formData, houseId: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
             <Select
               label="Livestock Category"
               options={[...LIVESTOCK_CATEGORY_OPTIONS]}
               value={formData.type}
               onChange={(e) => setFormData({ ...formData, type: e.target.value })}
               required
             />
             <BreedSelect
               label="Primary Breed / Specie"
               options={breedOptions}
               value={formData.breedType}
               onChange={(breedType) => setFormData({ ...formData, breedType })}
               required
             />
          </div>

          <div className="grid grid-cols-2 gap-3">
             {mode === 'edit' && (
                <Select
                  label="Benchmark Override"
                  options={[
                    { label: 'Default (From Breed)', value: '' },
                    { label: 'Ross 308 (Meat)', value: 'Ross 308' },
                    { label: 'Cobb 500 (Meat)', value: 'Cobb 500' },
                    { label: 'ISA Brown (Eggs)', value: 'ISA Brown' },
                    { label: 'Lohmann (Eggs)', value: 'Lohmann' },
                    { label: 'Ankole (Cattle)', value: 'Ankole' },
                  ]}
                  value={formData.growthTargetOverride}
                  onChange={(e) => setFormData({ ...formData, growthTargetOverride: e.target.value })}
                />
             )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Initial Quantity"
              type="number"
              min="0"
              value={formData.initialCount}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val < 0) return;
                setFormData({ ...formData, initialCount: e.target.value === '' ? '' : val });
              }}
              required
              placeholder="e.g. 1000"
            />
            <Input
              label="Arrival Date"
              type="date"
              value={formData.arrivalDate}
              onChange={(e) => setFormData({ ...formData, arrivalDate: e.target.value })}
              required
            />
          </div>

          {mode === 'edit' && (
            <Select
              label="Operational Status"
              options={[
                { label: 'Active (Ongoing)', value: 'active' },
                { label: 'Completed (Decommissioned)', value: 'completed' },
              ]}
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            />
          )}
          </>
        )}
      </fieldset>
      </MutationBoundary>
      <div className="flex justify-end gap-2 pt-5 border-t border-gray-100 italic font-medium text-xs uppercase text-gray-400">
        <Button variant="outline" type="button" onClick={onClose} disabled={isLoading} className="h-10 px-7 rounded-md border-gray-200">Cancel</Button>
        <Button 
          type="submit" 
          isLoading={isLoading} 
          loadingText={mode === 'create' ? 'Registering...' : mode === 'edit' ? 'Saving...' : formData.healthType === 'SICK' ? 'Transferring...' : 'Logging...'}
          disabled={isMortalityExceeded}
          className={`h-10 px-7 rounded-md ${isMortalityExceeded ? "bg-gray-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"}`}
        >
          {mode === 'create' ? 'Register Unit' : mode === 'edit' ? 'Apply changes' : formData.healthType === 'SICK' ? 'Transfer to Isolation' : 'Log mortality'}
        </Button>
      </div>
    </form>

  );
};
