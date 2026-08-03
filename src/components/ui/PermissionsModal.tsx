'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, ShieldCheck, Database, LayoutDashboard, Settings, Egg, Wheat, ThermometerSun, XCircle, Users, Banknote, RotateCcw, HeartPulse } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { StaffPermissions } from '@/lib/staff-permission-defaults';

type PermissionState = Required<StaffPermissions>;

interface PermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffName: string;
  role: string;
  defaultPermissions: PermissionState;
  initialPermissions?: Partial<PermissionState>;
  onSave: (permissions: PermissionState) => Promise<void>;
  onResetToDefaults?: () => Promise<void>;
  isLoading: boolean;
}

function buildPermissionState(
  initialPermissions: Partial<PermissionState> | undefined,
  defaultPermissions: PermissionState
): PermissionState {
  return {
    canViewFinance: initialPermissions?.canViewFinance ?? defaultPermissions.canViewFinance,
    canEditFinance: initialPermissions?.canEditFinance ?? defaultPermissions.canEditFinance,
    canViewInventory: initialPermissions?.canViewInventory ?? defaultPermissions.canViewInventory,
    canEditInventory: initialPermissions?.canEditInventory ?? defaultPermissions.canEditInventory,
    canViewBatches: initialPermissions?.canViewBatches ?? defaultPermissions.canViewBatches,
    canEditBatches: initialPermissions?.canEditBatches ?? defaultPermissions.canEditBatches,
    canViewSales: initialPermissions?.canViewSales ?? defaultPermissions.canViewSales,
    canEditSales: initialPermissions?.canEditSales ?? defaultPermissions.canEditSales,
    canViewEggs: initialPermissions?.canViewEggs ?? defaultPermissions.canViewEggs,
    canEditEggs: initialPermissions?.canEditEggs ?? defaultPermissions.canEditEggs,
    canViewFeeding: initialPermissions?.canViewFeeding ?? defaultPermissions.canViewFeeding,
    canEditFeeding: initialPermissions?.canEditFeeding ?? defaultPermissions.canEditFeeding,
    canViewHouses: initialPermissions?.canViewHouses ?? defaultPermissions.canViewHouses,
    canEditHouses: initialPermissions?.canEditHouses ?? defaultPermissions.canEditHouses,
    canViewMortality: initialPermissions?.canViewMortality ?? defaultPermissions.canViewMortality,
    canEditMortality: initialPermissions?.canEditMortality ?? defaultPermissions.canEditMortality,
    canViewHealth: initialPermissions?.canViewHealth ?? defaultPermissions.canViewHealth,
    canEditHealth: initialPermissions?.canEditHealth ?? defaultPermissions.canEditHealth,
    canViewCustomers: initialPermissions?.canViewCustomers ?? defaultPermissions.canViewCustomers,
    canEditCustomers: initialPermissions?.canEditCustomers ?? defaultPermissions.canEditCustomers,
    canViewTeam: initialPermissions?.canViewTeam ?? defaultPermissions.canViewTeam,
    canEditTeam: initialPermissions?.canEditTeam ?? defaultPermissions.canEditTeam,
  };
}

export function PermissionsModal({
  isOpen,
  onClose,
  staffName,
  role,
  defaultPermissions,
  initialPermissions,
  onSave,
  onResetToDefaults,
  isLoading,
}: PermissionsModalProps) {
  const [permissions, setPermissions] = useState<PermissionState>(() =>
    buildPermissionState(initialPermissions, defaultPermissions)
  );

  useEffect(() => {
    if (isOpen) {
      setPermissions(buildPermissionState(initialPermissions, defaultPermissions));
    }
  }, [isOpen, initialPermissions, defaultPermissions]);

  const handleToggle = (key: keyof typeof permissions) => {
    setPermissions(prev => {
      const next = { ...prev, [key]: !prev[key] };
      // If turning off 'view', automatically turn off 'edit'
      if (key.startsWith('canView') && !next[key]) {
        const editKey = key.replace('canView', 'canEdit') as keyof typeof permissions;
        next[editKey] = false;
      }
      // If turning on 'edit', automatically turn on 'view'
      if (key.startsWith('canEdit') && next[key]) {
        const viewKey = key.replace('canEdit', 'canView') as keyof typeof permissions;
        next[viewKey] = true;
      }
      return next;
    });
  };

  const PermissionRow = ({ title, viewKey, editKey, icon: Icon, description }: { title: string, viewKey: keyof typeof permissions, editKey: keyof typeof permissions, icon: any, description?: string }) => (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-white/10 border border-white/10 rounded-md mb-2 gap-3 sm:gap-0">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-white/10 rounded-md">
          <Icon className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h4 className="text-white font-bold">{title}</h4>
          <p className="text-white/70 text-xs uppercase tracking-widest font-bold">{description ?? 'Module Access'}</p>
        </div>
      </div>
      <div className="flex items-center gap-5 sm:gap-4 w-full sm:w-auto justify-around sm:justify-end border-t border-white/5 pt-2 sm:pt-0 sm:border-0 mt-1 sm:mt-0">
        <div className="flex flex-col items-center">
          <span className="text-xs text-white/70 mb-1 font-bold uppercase">View</span>
          <ToggleSwitch checked={permissions[viewKey]} onChange={() => handleToggle(viewKey)} disabled={isLoading} />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-white/70 mb-1 font-bold uppercase">Edit</span>
          <ToggleSwitch checked={permissions[editKey]} onChange={() => handleToggle(editKey)} disabled={isLoading} />
        </div>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
            onClick={isLoading ? undefined : onClose}
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg overflow-hidden flex flex-col"
            >
              <div className="bg-[#0a0a0a] border border-white/10 rounded-lg shadow-2xl flex flex-col max-h-[90vh] glass-morphism">
                {/* Header - Sticky */}
                <div className="p-4 sm:p-8 border-b border-white/10 flex items-center justify-between bg-white/10 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="p-2 sm:p-2.5 bg-blue-500/20 rounded-md border border-blue-500/30">
                      <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-white tracking-normal">Access Control</h3>
                      <p className="text-blue-400 text-xs sm:text-xs font-bold uppercase tracking-widest">{staffName}</p>
                    </div>
                  </div>
                  <button 
                    onClick={onClose}
                    disabled={isLoading}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Scrollable Content */}
                <div className="p-4 sm:p-8 overflow-y-auto scrollbar-hide flex-grow custom-scrollbar">
                  <div className="space-y-1 mb-5">
                    <p className="text-white/70 text-[11px] sm:text-xs font-medium leading-relaxed">
                      Configure individual access rights for this staff member. 
                      Changes are logged for security auditing.
                    </p>
                    <p className="text-white/50 text-[11px] font-bold uppercase tracking-widest">
                      Role: {role}
                    </p>
                  </div>
                  
                  <div className="space-y-5">
                    <div>
                      <p className="px-1 text-xs font-bold uppercase tracking-[0.2em] text-white/70 mb-2 ml-2">Commercial Hub</p>
                      <div className="space-y-2 sm:space-y-4">
                        <PermissionRow title="Finance" viewKey="canViewFinance" editKey="canEditFinance" icon={Database} />
                        <PermissionRow title="Sales" viewKey="canViewSales" editKey="canEditSales" icon={Banknote} />
                        <PermissionRow title="Customers" viewKey="canViewCustomers" editKey="canEditCustomers" icon={Users} />
                        <PermissionRow title="Inventory" viewKey="canViewInventory" editKey="canEditInventory" icon={LayoutDashboard} />
                      </div>
                    </div>

                    <div>
                      <p className="px-1 text-xs font-bold uppercase tracking-[0.2em] text-white/70 mb-2 ml-2 mt-3">Operations</p>
                      <div className="space-y-2 sm:space-y-4">
                        <PermissionRow title="Livestock Units" viewKey="canViewBatches" editKey="canEditBatches" icon={Settings} />
                        <PermissionRow title="Houses" viewKey="canViewHouses" editKey="canEditHouses" icon={ThermometerSun} />
                        <PermissionRow title="Eggs" viewKey="canViewEggs" editKey="canEditEggs" icon={Egg} />
                        <PermissionRow title="Feeding" viewKey="canViewFeeding" editKey="canEditFeeding" icon={Wheat} />
                        <PermissionRow title="Mortality" viewKey="canViewMortality" editKey="canEditMortality" icon={XCircle} description="Logging, quarantine recovery & transfer" />
                        <PermissionRow title="Health (Vaccines & Meds)" viewKey="canViewHealth" editKey="canEditHealth" icon={HeartPulse} />
                      </div>
                    </div>

                    <div>
                      <p className="px-1 text-xs font-bold uppercase tracking-[0.2em] text-white/70 mb-2 ml-2 mt-3">Governance</p>
                      <div className="space-y-2 sm:space-y-4">
                        <PermissionRow title="Team Management" viewKey="canViewTeam" editKey="canEditTeam" icon={Shield} />
                      </div>
                    </div>
                  </div>

                  {/* Warning Note for small screens */}
                  <div className="mt-5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
                     <p className="text-xs text-amber-400 font-bold uppercase tracking-widest mb-1"> Security Policy </p>
                     <p className="text-white/80 text-[11px] leading-relaxed font-bold italic">
                        Owners bypass all checks. Managers are unrestricted by default unless limited here.
                     </p>
                  </div>
                </div>

                {/* Footer - Sticky */}
                <div className="p-4 sm:p-8 border-t border-white/10 flex flex-col gap-2 bg-white/10 flex-shrink-0">
                  {onResetToDefaults ? (
                    <Button
                      variant="outline"
                      onClick={() => onResetToDefaults()}
                      disabled={isLoading}
                      className="w-full rounded-md border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-[11px] uppercase font-bold"
                    >
                      <RotateCcw className="w-4 h-4 mr-2 inline" />
                      Reset to {role} Defaults
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setPermissions(defaultPermissions)}
                      disabled={isLoading}
                      className="w-full rounded-md border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-[11px] uppercase font-bold"
                    >
                      <RotateCcw className="w-4 h-4 mr-2 inline" />
                      Reset to {role} Defaults
                    </Button>
                  )}
                  <div className="flex flex-col sm:flex-row justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={onClose} 
                    disabled={isLoading}
                    className="w-full sm:w-auto rounded-md border-white/10 hover:bg-white/5 text-[11px] uppercase font-bold"
                  >
                    Discard
                  </Button>
                  <Button 
                    onClick={() => onSave(permissions)} 
                    isLoading={isLoading}
                    className="w-full sm:w-auto rounded-md bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                  >
                    Save & Apply
                  </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean, onChange: () => void, disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none disabled:opacity-50 ring-offset-black focus:ring-2 focus:ring-emerald-500 ring-offset-2 ${checked ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-white/10'}`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
}
