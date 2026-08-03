'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Home, Settings as SettingsIcon, Bell, Shield, Plus, Loader2, Save, CheckCircle2, Monitor, Trash2 } from 'lucide-react';
import { updateFarmInfo, createHouse } from '@/lib/actions/dashboard-actions';
import { updateFarmSettings, getFarmSettings, getSalesSettings, updateSalesSettings } from '@/lib/actions/preference-actions';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useRouter, useSearchParams } from 'next/navigation';
import { MutationBoundary } from '@/components/ui/MutationFeedback';

const SHOW_USER_DESKTOP_LICENSES = process.env.NEXT_PUBLIC_SHOW_USER_DESKTOP_LICENSES !== 'false';

interface InventoryItem {
  id: string;
  itemName: string;
  stockLevel: number;
  reorderLevel?: number;
  unit: string;
}

interface SettingsContentProps {
  farm: any;
  inventory?: InventoryItem[];
}

export function SettingsContent({ farm, inventory = [] }: SettingsContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTabFromUrl = searchParams.get('tab') || 'farm';
  const [activeTab, setActiveTab] = useState(activeTabFromUrl);

  useEffect(() => {
    if (activeTabFromUrl === 'desktop-licenses') {
      if (SHOW_USER_DESKTOP_LICENSES) {
        router.push('/dashboard/settings/desktop-licenses');
      } else {
        router.replace('/dashboard/settings?tab=farm');
      }
      return;
    }
    setActiveTab(activeTabFromUrl);
  }, [activeTabFromUrl, router]);

  const [isUpdatingFarm, setIsUpdatingFarm] = useState(false);
  const [isAddingHouse, setIsAddingHouse] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Preference states
  const [eggReminderTime, setEggReminderTime] = useState('18:00');
  const [feedReminderTime, setFeedReminderTime] = useState('18:00');
  const [currency, setCurrency] = useState('GHS');
  const [growthTarget, setGrowthTarget] = useState<number | undefined>();
  const [defaultEggUnit, setDefaultEggUnit] = useState<'crate' | 'individual'>('crate');
  const [allowEggUnitChange, setAllowEggUnitChange] = useState(false);
  const [defaultEggSortMode, setDefaultEggSortMode] = useState<'sorted' | 'unsorted'>('unsorted');
  const [allowEggSortModeChange, setAllowEggSortModeChange] = useState(false);
  const [allowBatchOverride, setAllowBatchOverride] = useState(false);
  const [allowWorkerDiscounts, setAllowWorkerDiscounts] = useState(false);
  const [defaultDiscountType, setDefaultDiscountType] = useState<'flat' | 'percent' | 'item'>('item');
  const [reorderLevels, setReorderLevels] = useState<Record<string, number>>({});
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(false);
  const [growthStandards, setGrowthStandards] = useState<any[]>([]);
  const [savingReorderId, setSavingReorderId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'preferences' || activeTab === 'notifications') {
      loadPreferences();
    }
  }, [activeTab]);

  useEffect(() => {
    const initial: Record<string, number> = {};
    inventory.forEach(item => {
      initial[item.id] = item.reorderLevel ?? 500;
    });
    setReorderLevels(initial);
  }, [inventory]);

  const loadPreferences = async () => {
    setIsLoadingPrefs(true);
    try {
      const settings = await getFarmSettings();
      if (settings) {
        setEggReminderTime(settings.eggRecordReminderTime || '18:00');
        setFeedReminderTime(settings.feedRecordReminderTime || '18:00');
        setCurrency(settings.currency || 'GHS');
        setGrowthTarget(settings.growthTargetStandard ?? undefined);
        setDefaultEggUnit(settings.defaultEggUnit === 'individual' ? 'individual' : 'crate');
        setAllowEggUnitChange(settings.allowEggUnitChange ?? false);
        setDefaultEggSortMode(settings.defaultEggSortMode === 'sorted' ? 'sorted' : 'unsorted');
        setAllowEggSortModeChange(settings.allowEggSortModeChange ?? false);
      }

      const salesSettings = await getSalesSettings();
      if (salesSettings) {
        setAllowBatchOverride(salesSettings.allowBatchOverride ?? false);
        setAllowWorkerDiscounts(salesSettings.allowWorkerDiscounts ?? false);
        const discountType = salesSettings.defaultDiscountType;
        setDefaultDiscountType(
          discountType === 'flat' || discountType === 'percent' ? discountType : 'item',
        );
      }
      
      const { getGrowthStandards } = await import('@/lib/actions/preference-actions');
      const standards = await getGrowthStandards();
      setGrowthStandards(standards);
    } catch (err) {
      console.error('Failed to load preferences', err);
    } finally {
      setIsLoadingPrefs(false);
    }
  };

  const handleUpdateFarm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUpdatingFarm(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const location = formData.get('location') as string;
    const capacity = parseInt(formData.get('capacity') as string);

    try {
      const result = await updateFarmInfo({ name, location, capacity });
      if (result.success) {
        setMessage({ type: 'success', text: 'Farm information updated successfully!' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update farm info.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setIsUpdatingFarm(false);
    }
  };

  const handleSaveReminders = async () => {
    setIsSavingPrefs(true);
    setMessage(null);
    try {
      await updateFarmSettings({
        eggRecordReminderTime: eggReminderTime,
        feedRecordReminderTime: feedReminderTime,
        currency,
        growthTargetStandard: growthTarget,
        defaultEggUnit,
        allowEggUnitChange,
        defaultEggSortMode,
        allowEggSortModeChange,
      });
      await updateSalesSettings({
        allowBatchOverride,
        allowWorkerDiscounts,
        defaultDiscountType,
      });
      setMessage({ type: 'success', text: 'Farm preferences saved!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save reminder times.' });
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleSaveReorderLevel = async (itemId: string) => {
    if (savingReorderId === itemId) return;
    setSavingReorderId(itemId);
    try {
      const { updateReorderLevel } = await import('@/lib/actions/preference-actions');
      await updateReorderLevel(itemId, reorderLevels[itemId] ?? 500);
      setMessage({ type: 'success', text: 'Reorder level saved!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save reorder level.' });
    } finally {
      setSavingReorderId(null);
    }
  };

  const tabs = [
    { id: 'farm', label: 'Farm Info', icon: Home },
    { id: 'notifications', label: 'Reminders', icon: Bell },
    { id: 'preferences', label: 'Stock Levels', icon: SettingsIcon },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'trash', label: 'Data Recovery', icon: Trash2, href: '/dashboard/settings/trash' },
    { id: 'desktop-licenses', label: 'Connected Devices', icon: Monitor },
  ].filter((tab) => SHOW_USER_DESKTOP_LICENSES || tab.id !== 'desktop-licenses');

  const navigateToTab = (tab: (typeof tabs)[number]) => {
    if (tab.id === 'desktop-licenses') {
      if (SHOW_USER_DESKTOP_LICENSES) {
        router.push('/dashboard/settings/desktop-licenses');
      }
      return;
    }
    if ('href' in tab && tab.href) {
      router.push(tab.href);
      return;
    }
    setActiveTab(tab.id);
    router.push(`/dashboard/settings?tab=${tab.id}`, { scroll: false });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
      <div className="md:col-span-1 space-y-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigateToTab(tab)}
            className={`w-full text-left px-3 py-2 rounded-md flex items-center transition-all duration-300 ${
              activeTab === tab.id
                ? 'bg-emerald-500/20 text-emerald-400 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)] border border-emerald-500/30'
                : 'text-white/80 hover:bg-white/5 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4 mr-2" /> {tab.label}
          </button>
        ))}
      </div>

      <div className="md:col-span-3 space-y-5">
        {message && (
          <div className={`p-3 rounded-md text-sm font-bold backdrop-blur-md border flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            {message.text}
          </div>
        )}

        {activeTab === 'farm' && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Farm Information</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateFarm} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input 
                      label="Farm Name"
                      name="name"
                      defaultValue={farm?.name}
                      required
                    />
                    <Input 
                      label="Location"
                      name="location"
                      defaultValue={farm?.location || ''}
                      required
                    />
                  </div>
                  <Input 
                    label="Total Capacity"
                    name="capacity"
                    type="number" 
                    min="0"
                    defaultValue={farm?.capacity}
                    required
                  />
                  <div className="pt-3">
                    <Button type="submit" isLoading={isUpdatingFarm}>
                      Save Changes
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>House Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white/80 mb-5 font-medium">Manage your poultry houses and their sensor configurations.</p>
                <Button onClick={() => router.push('/dashboard/houses')} variant="outline">
                  <Plus className="w-4 h-4 mr-2" /> Add New House
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === 'notifications' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-400" />
                Daily Record Reminders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-white/80 leading-relaxed">
                Set the time by which daily records must be submitted. If no record is logged before this time, the system will trigger an alert.
              </p>
              {isLoadingPrefs ? (
                <div className="flex items-center gap-2 text-white/70"><Loader2 className="animate-spin w-4 h-4" /> Loading…</div>
              ) : (
                <div className="space-y-5">
                  <div className="p-4 rounded-md bg-blue-500/10 border border-blue-500/20 space-y-2">
                    <p className="text-sm font-bold text-blue-400 uppercase tracking-widest">🥚 Egg Collection Reminder</p>
                    <p className="text-xs text-white/70">Alert if no egg record is logged by this time each day.</p>
                    <input
                      type="time"
                      value={eggReminderTime}
                      onChange={e => setEggReminderTime(e.target.value)}
                      className="bg-black/60 border border-white/10 text-white rounded-md px-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-400/60 focus:ring-1 focus:ring-blue-400/30"
                    />
                  </div>

                  <div className="p-4 rounded-md bg-orange-500/10 border border-orange-500/20 space-y-2">
                    <p className="text-sm font-bold text-orange-400 uppercase tracking-widest">🌾 Feed Log Reminder</p>
                    <p className="text-xs text-white/70">Alert if no feeding record is logged by this time each day.</p>
                    <input
                      type="time"
                      value={feedReminderTime}
                      onChange={e => setFeedReminderTime(e.target.value)}
                      className="bg-black/60 border border-white/10 text-white rounded-md px-3 py-2 text-sm font-bold focus:outline-none focus:border-orange-400/60 focus:ring-1 focus:ring-orange-400/30"
                    />
                  </div>

                  <div className="p-4 rounded-md bg-purple-500/10 border border-purple-500/20 space-y-2">
                    <p className="text-sm font-bold text-purple-400 uppercase tracking-widest">💰 Farm Currency</p>
                    <p className="text-xs text-white/70">Used for sales, orders, and financial reporting.</p>
                    <select
                      value={currency}
                      onChange={e => setCurrency(e.target.value)}
                      className="bg-black/60 border border-white/10 text-white rounded-md px-3 py-2 text-sm font-bold focus:outline-none focus:border-purple-400/60 focus:ring-1 focus:ring-purple-400/30"
                    >
                      <option value="GHS">Ghanaian Cedi (GHS)</option>
                      <option value="USD">US Dollar (USD)</option>
                      <option value="NGN">Nigerian Naira (NGN)</option>
                      <option value="KES">Kenyan Shilling (KES)</option>
                    </select>
                  </div>

                  <div className="p-4 rounded-md bg-amber-500/10 border border-amber-500/20 space-y-2">
                    <p className="text-sm font-bold text-amber-400 uppercase tracking-widest">📊 Default Growth Target</p>
                    <p className="text-xs text-white/70">Benchmark flock performance against industry standards.</p>
                    <select
                      value={growthTarget || ''}
                      onChange={e => setGrowthTarget(Number(e.target.value))}
                      className="bg-black/60 border border-white/10 text-white rounded-md px-3 py-2 text-sm font-bold focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 w-full"
                    >
                      <option value="">Select a Standard...</option>
                      {growthStandards.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.livestockType})</option>
                      ))}
                    </select>
                  </div>

                  <div className="p-4 rounded-md bg-green-500/10 border border-green-500/20 space-y-3">
                    <p className="text-sm font-bold text-green-400 uppercase tracking-widest">🥚 Egg Logging Defaults</p>
                    <p className="text-xs text-white/70">Default unit and sorting mode for worker egg production entries.</p>
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Default Unit</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(['crate', 'individual'] as const).map((unit) => (
                          <button
                            key={unit}
                            type="button"
                            onClick={() => setDefaultEggUnit(unit)}
                            className={`py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                              defaultEggUnit === unit
                                ? 'bg-green-500 text-black'
                                : 'bg-white/10 text-white/70 hover:bg-white/10'
                            }`}
                          >
                            {unit === 'crate' ? 'Crate' : 'Individual'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowEggUnitChange}
                        onChange={(e) => setAllowEggUnitChange(e.target.checked)}
                        className="rounded border-white/20 bg-black/60 text-green-500 focus:ring-green-500/30"
                      />
                      <span className="text-xs font-bold text-white/80">Let workers change the unit per entry</span>
                    </label>
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Default Sort Mode</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(['unsorted', 'sorted'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setDefaultEggSortMode(mode)}
                            className={`py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                              defaultEggSortMode === mode
                                ? 'bg-emerald-500 text-white'
                                : 'bg-white/10 text-white/70 hover:bg-white/10'
                            }`}
                          >
                            {mode === 'sorted' ? 'Sorted' : 'Unsorted'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowEggSortModeChange}
                        onChange={(e) => setAllowEggSortModeChange(e.target.checked)}
                        className="rounded border-white/20 bg-black/60 text-green-500 focus:ring-green-500/30"
                      />
                      <span className="text-xs font-bold text-white/80">Let workers change sort mode per entry</span>
                    </label>
                  </div>

                  <div className="p-4 rounded-md bg-cyan-500/10 border border-cyan-500/20 space-y-3">
                    <p className="text-sm font-bold text-cyan-400 uppercase tracking-widest">🛒 Sales Settings</p>
                    <p className="text-xs text-white/70">Control what workers can override during farm-gate sales.</p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowBatchOverride}
                        onChange={(e) => setAllowBatchOverride(e.target.checked)}
                        className="rounded border-white/20 bg-black/60 text-cyan-500 focus:ring-cyan-500/30"
                      />
                      <span className="text-xs font-bold text-white/80">Allow selecting a specific batch instead of FIFO</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowWorkerDiscounts}
                        onChange={(e) => setAllowWorkerDiscounts(e.target.checked)}
                        className="rounded border-white/20 bg-black/60 text-cyan-500 focus:ring-cyan-500/30"
                      />
                      <span className="text-xs font-bold text-white/80">Allow workers to apply discounts</span>
                    </label>
                    {allowWorkerDiscounts ? (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Worker Discount Type</p>
                        <select
                          value={defaultDiscountType}
                          onChange={(e) => setDefaultDiscountType(e.target.value as 'flat' | 'percent' | 'item')}
                          className="bg-black/60 border border-white/10 text-white rounded-md px-3 py-2 text-sm font-bold focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30 w-full"
                        >
                          <option value="item">Give away items</option>
                          <option value="flat">Flat amount</option>
                          <option value="percent">Percent</option>
                        </select>
                      </div>
                    ) : null}
                  </div>

                  <Button onClick={handleSaveReminders} isLoading={isSavingPrefs} className="w-full">
                    <Save className="w-4 h-4 mr-2" /> Save Reminder Settings
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ---- STOCK LEVELS TAB ---- */}
        {activeTab === 'preferences' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-amber-400" />
                Feed Reorder Levels
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-white/80 leading-relaxed">
                Set the minimum stock threshold (in kg) for each feed item. When stock falls below this level, a low-stock alert will be triggered on your dashboard.
              </p>
              {inventory.length === 0 ? (
                <div className="text-center py-9 text-white/70 italic text-sm">No feed inventory items found. Add inventory first.</div>
              ) : (
                <div className="space-y-2">
                  {inventory.map(item => (
                    <MutationBoundary key={item.id} active={savingReorderId === item.id} label="Saving threshold...">
                    <div className="flex items-center gap-3 p-3 rounded-md bg-white/10 border border-white/10">
                      <div className="flex-1">
                        <p className="font-bold text-white text-sm">{item.itemName}</p>
                        <p className="text-xs text-white/70 uppercase tracking-widest">Current stock: {item.stockLevel} {item.unit}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <input
                            type="number"
                            value={reorderLevels[item.id] ?? 500}
                            onChange={e => setReorderLevels(prev => ({ ...prev, [item.id]: Number(e.target.value) }))}
                            className="w-28 bg-black/60 border border-white/10 text-white rounded-md px-2 py-2 text-sm font-bold focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 text-right"
                            min={0}
                            step={10}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-white/70 pointer-events-none">kg</span>
                        </div>
                        <Button
                          onClick={() => handleSaveReorderLevel(item.id)}
                          size="sm"
                          variant="outline"
                          isLoading={savingReorderId === item.id}
                          loadingText="Saving"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    </MutationBoundary>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ---- SECURITY TAB ---- */}
        {activeTab === 'security' && (
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="p-5 rounded-lg bg-emerald-500/10 border border-emerald-500/10 text-center space-y-3">
                  <Shield className="w-12 h-12 text-emerald-400 mx-auto" />
                  <p className="text-sm text-white/80">Security settings and password management are now handled through your <span className="text-emerald-400 font-bold">Personal Profile</span>.</p>
                  <Button onClick={() => router.push('/dashboard/profile')} className="rounded-md">Go to Profile</Button>
               </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
