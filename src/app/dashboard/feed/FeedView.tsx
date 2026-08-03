'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { 
  TrendingUp, 
  Package, 
  Beaker, 
  Plus, 
  ArrowRight,
  Database,
  Utensils
} from 'lucide-react'
import { FeedFormulationForm } from './FeedFormulationForm'
import { FeedForm } from './FeedForm'
import { FeedingHistoryPanel } from './FeedingHistoryPanel'
import { Dialog } from '@/components/ui/Dialog'
import type { FeedPageData } from '@/lib/actions/feed-page-actions'
import { getFeedPageData, refreshFeedDynamicData } from '@/lib/actions/feed-page-actions'
import { getReorderThreshold, isFeedCategory, isLowStock } from '@/lib/inventory/feed-categories'

export default function FeedDashboard({
  canEdit = true,
  openLogOnLoad = false,
  initialData,
}: {
  canEdit?: boolean
  openLogOnLoad?: boolean
  initialData: FeedPageData
}) {
  const [formulations, setFormulations] = useState<any[]>(initialData.formulations)
  const [efficiency, setEfficiency] = useState<any[]>(initialData.efficiency)
  const [inventory, setInventory] = useState<any[]>(initialData.inventory)
  const [batches, setBatches] = useState<any[]>(
    initialData.batches.filter((batch: any) => batch.status === 'active')
  )
  const [showForm, setShowForm] = useState(false)
  const [showLogForm, setShowLogForm] = useState(false)
  const [selectedFormulation, setSelectedFormulation] = useState<string | undefined>(undefined)
  const [feedingLogs, setFeedingLogs] = useState<any[]>(initialData.feedingLogs)
  const [refreshing, setRefreshing] = useState(false)
  const openedInitialLog = useRef(false)

  useEffect(() => {
    if (!openLogOnLoad || !canEdit || openedInitialLog.current) return
    openedInitialLog.current = true
    setSelectedFormulation(undefined)
    setShowLogForm(true)
  }, [canEdit, openLogOnLoad])

  const refreshAfterLog = async () => {
    setRefreshing(true)
    try {
      const { feedingLogs: newLogs, inventory: newInventory, efficiency: newEfficiency } = await refreshFeedDynamicData()
      setFeedingLogs(newLogs)
      setInventory(newInventory)
      setEfficiency(newEfficiency)
    } finally {
      setRefreshing(false)
    }
  }

  const handleOptimisticFeedLog = (batchId: string, amount: number) => {
    setEfficiency((prev) =>
      prev.map((eff) =>
        eff.id === batchId
          ? { ...eff, totalFeed: (Number(eff.totalFeed) || 0) + amount }
          : eff
      )
    )
  }

  const handleOptimisticFeedRollback = (batchId: string, amount: number) => {
    setEfficiency((prev) =>
      prev.map((eff) =>
        eff.id === batchId
          ? { ...eff, totalFeed: Math.max(0, (Number(eff.totalFeed) || 0) - amount) }
          : eff
      )
    )
  }

  const refreshAfterFormulation = async () => {
    const data = await getFeedPageData()
    setFormulations(data.formulations)
    setInventory(data.inventory)
  }

  const feedInventory = inventory.filter((item) => isFeedCategory(item.category))

  return (
    <div className="px-0 pt-2 pb-7 md:p-5 space-y-7 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-normal">Feed Management</h1>
          <p className="text-emerald-100 font-bold uppercase tracking-widest text-xs mt-2">Formulation builder & consumption efficiency analytics</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-3">
            <Button 
              onClick={() => { setSelectedFormulation(undefined); setShowLogForm(true); }} 
              className="bg-emerald-600/20 border border-emerald-500/50 hover:bg-emerald-600/40 text-emerald-100 gap-2 shadow-lg"
            >
              <Utensils className="w-4 h-4" />
              Log Feeding
            </Button>
            <Button 
              onClick={() => setShowForm(!showForm)} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-lg shadow-emerald-900/50"
            >
              {showForm ? <Package className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'View Formulations' : 'Create Formulation'}
            </Button>
          </div>
        )}
      </header>

      <Dialog
        isOpen={showLogForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowLogForm(false)
            setSelectedFormulation(undefined)
          }
        }}
        title="Log Feeding"
      >
        <FeedForm
          batches={batches}
          inventory={feedInventory}
          formulations={formulations}
          selectedFormulationId={selectedFormulation}
          mode="create"
          onClose={() => { setShowLogForm(false); setSelectedFormulation(undefined); }}
          onSaved={refreshAfterLog}
          onOptimisticLog={handleOptimisticFeedLog}
          onOptimisticRollback={handleOptimisticFeedRollback}
        />
      </Dialog>

      {showForm ? (
        <FeedFormulationForm 
          inventoryItems={inventory.filter(i => {
            const name = (i.itemName || '').toLowerCase();
            const cat = (i.category || '').toUpperCase();
            return cat === 'FEED'
              && !name.includes('egg')
              && !cat.includes('EGG')
              && !i.eggCategoryId;
          })} 
          onSuccess={() => {
            setShowForm(false)
            refreshAfterFormulation()
          }} 
          onClose={() => setShowForm(false)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Efficiency Report */}
          <div className="lg:col-span-2 space-y-5">
            <Card className="border-none bg-emerald-950 text-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-7 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp size={120} />
              </div>
              <CardHeader>
                <CardTitle className="text-emerald-100 flex items-center gap-2">
                  <TrendingUp className="w-6 h-6" />
                  Consumption Efficiency (FCR)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {efficiency.length > 0 ? efficiency.map((eff) => (
                    <div key={eff.id} className="bg-white/10 backdrop-blur-md p-3 rounded-md border border-white/10">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-emerald-300">{eff.name}</span>
                        <span className="text-xs font-bold bg-emerald-500/20 px-2 py-1 rounded text-emerald-200 uppercase tracking-widest">
                          Active
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold">{eff.fcr}</span>
                        <span className="text-xs font-bold text-emerald-400">FCR</span>
                      </div>
                      <div className="mt-3 flex justify-between text-sm font-bold text-emerald-100 uppercase tracking-wider">
                        <span>Feed: {eff.totalFeed} bags</span>
                        <span>Weight: {eff.currentWeight}kg</span>
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-2 p-7 text-center text-emerald-300/40 border-2 border-dashed border-emerald-800 rounded-lg">
                      No efficiency data available. Log weights and feedings.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
               <Card className="bg-[#1a2332] border-white/10 shadow-xl rounded-lg h-full">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-amber-500/20 rounded-md text-amber-400">
                        <Database className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-white text-lg border-none">Active Formulations</h3>
                    </div>
                    <div className="space-y-2">
                      {formulations.slice(0, 3).map(f => (
                        <div key={f.id} className="flex justify-between items-center p-2 hover:bg-white/5 rounded-md transition-colors group border border-transparent hover:border-white/10">
                          <div>
                            <p className="font-bold text-emerald-100 text-base">{f.name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-white/60 uppercase tracking-wider">{f.type}</p>
                              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded uppercase font-bold border border-emerald-500/20">
                                {Number(f.stockLevel || 0).toLocaleString()} bags left
                              </span>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => { setSelectedFormulation(f.id); setShowLogForm(true); }}
                            className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 px-2 py-1 h-auto text-xs"
                          >
                            LOG FEED
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
               </Card>

               <Card className="bg-[#1a2332] border-white/10 shadow-xl rounded-lg h-full">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-emerald-500/20 rounded-md text-emerald-400">
                        <Beaker className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-white text-lg border-none">Inventory Check</h3>
                    </div>
                    <div className="space-y-2">
                       {feedInventory.slice(0, 4).map(item => (
                         <div key={item.id} className="flex justify-between items-center bg-white/5 p-2 rounded-md border border-white/10">
                           <span className="text-lg font-bold text-emerald-100">{item.itemName}</span>
                           <span className={`text-sm font-bold px-3 py-1.5 rounded-md border ${isLowStock(item) ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                              {Number(item.stockLevel).toLocaleString()} {item.unit}
                           </span>
                         </div>
                       ))}
                    </div>
                  </CardContent>
               </Card>
            </div>
          </div>

          {/* Right Pillar: Recent History */}
          <div>
             <Card className="bg-[#1a2332] border-white/10 shadow-xl rounded-lg h-full">
                <CardHeader>
                  <CardTitle className="text-white text-xl border-none">Ingredient Usage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                   {formulations.map(f => (
                     <div key={f.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-bold text-sm uppercase tracking-widest text-emerald-400">{f.name}</h4>
                        </div>
                        <div className="space-y-2">
                           {f.ingredients.map((ing: any) => {
                             const quantity = Number(ing.quantity || 0)
                             const total = f.ingredients.reduce(
                               (sum: number, item: any) => sum + Number(item.quantity || 0),
                               0,
                             ) || 1
                             const share = Math.min(100, (quantity / total) * 100)
                             return (
                             <div key={ing.id} className="space-y-1">
                               <div className="flex justify-between text-sm font-bold text-white/70">
                                 <span>{ing.inventory.itemName}</span>
                                 <span className="text-emerald-400">{quantity} bags</span>
                               </div>
                               <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                 <div 
                                  className="h-full bg-emerald-500 rounded-full" 
                                  style={{ width: `${share}%` }}
                                 />
                               </div>
                             </div>
                           )})}
                        </div>
                     </div>
                   ))}
                </CardContent>
             </Card>
          </div>
        </div>
      )}

      {!showForm && (
        <FeedingHistoryPanel
          logs={feedingLogs}
          batches={batches}
          inventory={feedInventory}
          formulations={formulations}
          canEdit={canEdit}
          isRefreshing={refreshing}
        />
      )}
    </div>
  )
}
