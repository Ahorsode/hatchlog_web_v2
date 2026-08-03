'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { 
  Plus, 
  Trash2, 
  Scale, 
  Beaker, 
  AlertCircle,
  X
} from 'lucide-react'
import { createFeedFormulation } from '@/lib/actions/feed-actions'
import { FeedType, LivestockType } from '@prisma/client'
import { toast } from 'sonner'

const FEED_TYPES = [
  'PRE_STARTER',
  'STARTER',
  'GROWER',
  'FINISHER',
  'BREEDER',
  'CUSTOM'
] as const;

const LIVESTOCK_TYPES = [
  'POULTRY_BROILER',
  'POULTRY_LAYER',
  'CATTLE',
  'SHEEP_GOAT',
  'PIG'
] as const;

interface FeedFormulationFormProps {
  inventoryItems: any[]
  onSuccess: () => void
  onClose?: () => void
}

export function FeedFormulationForm({ inventoryItems, onSuccess, onClose }: FeedFormulationFormProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [type, setType] = useState<FeedType>('STARTER')
  const [targetLivestock, setTargetLivestock] = useState<LivestockType>('POULTRY_BROILER')
  const [ingredients, setIngredients] = useState<{ inventoryId: string; bags: number | '' }[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (inventoryItems.length === 0) {
    return (
      <div className="space-y-4 p-6 text-center max-w-md mx-auto bg-white/10 backdrop-blur-md border border-white/20 rounded-lg">
        <p className="text-amber-400 font-bold text-lg">
          No Inventory Items Available!
        </p>
        <p className="text-white/70 text-sm">
          To create a feed formulation, you must first add ingredient items to your inventory.
        </p>
        <div className="flex gap-2 pt-2">
          {onClose && (
            <Button 
              variant="outline" 
              onClick={onClose}
              className="flex-1 border-white/20 text-white hover:bg-white/10 font-bold bg-transparent"
            >
              Cancel
            </Button>
          )}
          <Button 
            onClick={() => {
              if (onClose) onClose();
              router.push('/dashboard/inventory');
            }}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            Go to Inventory
          </Button>
        </div>
      </div>
    );
  }

  const addIngredient = () => {
    // Only allow adding if we haven't exhausted inventory items
    const usedIds = ingredients.map(i => i.inventoryId);
    const availableItems = inventoryItems.filter(item => !usedIds.includes(item.id));
    
    if (availableItems.length === 0) {
      toast.error("All inventory items have already been added to this formulation.");
      return;
    }
    
    setIngredients([...ingredients, { inventoryId: availableItems[0].id, bags: '' }])
  }

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  const updateIngredient = (index: number, field: string, value: any) => {
    const newIngredients = [...ingredients]
    if (field === 'bags') {
      const item = inventoryItems.find(i => i.id === newIngredients[index].inventoryId)
      if (item && value !== '' && Number(value) > Number(item.stockLevel)) {
        toast.error(`Cannot exceed stock level of ${item.stockLevel} bags`)
        value = Number(item.stockLevel)
      }
    }
    newIngredients[index] = { ...newIngredients[index], [field]: value }
    setIngredients(newIngredients)
  }

  const totalBags = ingredients.reduce((sum, i) => sum + Number(i.bags || 0), 0)

  const getAvailableInventoryItems = (currentIndex: number) => {
    // Collect all IDs selected in OTHER rows
    const otherSelectedIds = ingredients
      .filter((_, idx) => idx !== currentIndex)
      .map(ing => ing.inventoryId);
      
    // Return all items except those selected in other rows
    return inventoryItems.filter(item => !otherSelectedIds.includes(item.id));
  }

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!name.trim()) {
      toast.error('Please name this formulation');
      return;
    }

    if (ingredients.length === 0) {
      toast.error('Please add at least one ingredient');
      return;
    }
    
    if (ingredients.some(i => i.bags === '' || Number(i.bags) <= 0)) {
      toast.error('All ingredients must have a valid number of bags');
      return;
    }

    const uniqueIds = new Set(ingredients.map(i => i.inventoryId));
    if (uniqueIds.size !== ingredients.length) {
      toast.error('Each ingredient can only be selected once');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createFeedFormulation({
        name: name.trim(),
        type,
        targetLivestock,
        ingredients: ingredients.map((ingredient) => ({
          inventoryId: ingredient.inventoryId,
          quantity: Number(ingredient.bags),
          bags: Number(ingredient.bags),
        })),
      })

      if (res.success) {
        toast.success('Formulation saved successfully');
        onSuccess()
      } else {
        toast.error((res as any).error || 'Failed to save formulation');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="border-white/20 bg-white/10 backdrop-blur-md shadow-2xl rounded-md overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-emerald-600/20 to-teal-500/10 border-b border-white/10 flex flex-row justify-between items-center">
        <CardTitle className="flex items-center gap-2 text-white font-bold italic">
          <Beaker className="w-5 h-5 text-emerald-400" />
          Create New Formulation
        </CardTitle>
        {onClose && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
          >
            <X className="w-5 h-5" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="text-sm font-bold uppercase tracking-widest text-emerald-400">Formulation Name</div>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g. Broiler Power Starter"
              className="bg-white/10 border-white/10 text-white placeholder:text-white/30 focus:ring-emerald-500/50 focus:border-emerald-500/50 font-bold h-12"
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-bold uppercase tracking-widest text-emerald-400">Feed Type</div>
            <select 
              value={type} 
              onChange={(e) => setType(e.target.value as FeedType)}
              className="w-full h-12 px-3 rounded-md bg-white/10 border border-white/10 text-white focus:ring-emerald-500/50 focus:border-emerald-500/50 font-bold [&>option]:bg-[#0f172a] [&>option]:text-white"
            >
              {FEED_TYPES.map(t => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="text-lg font-bold flex items-center gap-2 text-white italic">
              <Scale className="w-5 h-5 text-emerald-600" />
              Ingredients Breakdown
            </div>
            <Button 
              onClick={addIngredient} 
              size="sm" 
              variant="outline" 
              disabled={isSubmitting || ingredients.length >= inventoryItems.length}
              className="gap-2 border-emerald-400/50 text-emerald-400 bg-emerald-400/10 font-bold uppercase tracking-widest text-xs h-10 px-4 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add Item
            </Button>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
            {ingredients.map((ing, idx) => (
              <div key={idx} className="flex items-end gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="flex-1 space-y-1">
                  <div className="text-sm uppercase font-black text-emerald-400 tracking-widest italic ml-1">Ingredient Source</div>
                  <select
                    value={ing.inventoryId}
                    onChange={(e) => updateIngredient(idx, 'inventoryId', e.target.value)}
                    className="w-full h-14 px-4 rounded-md bg-white border-2 border-emerald-500/30 text-[#064e3b] font-black text-lg focus:border-emerald-500 transition-all shadow-inner"
                  >
                    {getAvailableInventoryItems(idx).map(item => (
                      <option key={item.id} value={item.id}>{item.itemName}</option>
                    ))}
                  </select>
                </div>
                <div className="w-52 space-y-1">
                   <div className="text-sm uppercase font-black text-emerald-400 tracking-widest flex justify-between italic px-1">
                     <span>Bags</span>
                     <span className="text-white/50">Max: {inventoryItems.find(i => i.id === ing.inventoryId)?.stockLevel || 0}</span>
                   </div>
                  <Input 
                    type="number"
                    min="0"
                    max={inventoryItems.find(i => i.id === ing.inventoryId)?.stockLevel || 0}
                    value={ing.bags}
                    onChange={(e) => updateIngredient(idx, 'bags', e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="bg-white text-[#064e3b] font-black h-14 text-xl border-2 border-emerald-500/30 shadow-inner"
                  />
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => removeIngredient(idx)}
                  disabled={isSubmitting}
                  className="text-red-500 hover:bg-red-500/20 h-14 w-14 border border-red-500/20"
                >
                  <Trash2 className="w-6 h-6" />
                </Button>
              </div>
            ))}
            {ingredients.length === 0 && (
              <div className="text-center py-10 bg-white/20 rounded-md border-2 border-dashed border-white/20 text-emerald-900/40 font-bold uppercase tracking-widest text-xs italic">
                No ingredients added yet
              </div>
            )}
          </div>

          <div className="p-5 rounded-md flex justify-between items-center bg-emerald-500/20 border-2 border-emerald-500/40 backdrop-blur-md shadow-lg shadow-emerald-500/10">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-7 h-7 text-emerald-400 animate-pulse" />
              <span className="font-black text-white uppercase tracking-widest text-lg italic">Final Batch Size:</span>
            </div>
            <span className="text-5xl font-black text-emerald-400 italic tabular-nums">
              {totalBags.toLocaleString()} <span className="text-xl text-white/50 not-italic ml-1">BAGS</span>
            </span>
          </div>
        </div>

        <Button 
          onClick={handleSubmit} 
          isLoading={isSubmitting}
          loadingText="Saving formulation..."
          className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md shadow-lg transition-all uppercase tracking-widest"
        >
          Save Formulation
        </Button>
      </CardContent>
    </Card>
    </div>
  )
}
