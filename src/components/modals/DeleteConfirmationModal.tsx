import React, { useState } from 'react';
import { AlertCircle, Trash2, X } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title?: string;
  description?: string;
  itemName?: string;
  isLoading?: boolean;
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Deletion",
  description = "Are you sure you want to delete this item? This action will move it to the trash. Please provide a reason for this deletion for audit purposes.",
  itemName,
  isLoading = false
}: DeleteConfirmationModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (isLoading) return;
    if (!reason.trim()) {
      setError("A reason is required to delete this item.");
      return;
    }
    if (reason.trim().length < 5) {
      setError("Please provide a more descriptive reason.");
      return;
    }
    setError("");
    onConfirm(reason.trim());
  };

  const handleClose = () => {
    setReason("");
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe bg-black/60 backdrop-blur-sm">
      <div 
        className="bg-black border border-white/10 rounded-xl max-w-md w-full max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex-1 min-h-0 overflow-y-auto p-6 custom-scrollbar">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 bg-red-500/10 rounded-full shrink-0">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-1">{title}</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                {description}
              </p>
              {itemName && (
                <p className="text-sm font-bold text-white mt-2 p-2 bg-white/5 rounded-md border border-white/5">
                  Item: {itemName}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <label className="block text-sm font-medium text-white/80">
              Reason for Deletion <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError("");
              }}
              placeholder="e.g. Duplicated entry, wrong calculation, customer cancelled..."
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-white/30 focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all resize-none h-24"
              disabled={isLoading}
            />
            {error && (
              <p className="text-xs font-bold text-red-400">{error}</p>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-3 pb-safe shrink-0">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-bold text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || !reason.trim()}
            className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(220,38,38,0.3)] hover:shadow-[0_0_20px_rgba(220,38,38,0.5)]"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Delete Item
          </button>
        </div>
      </div>
    </div>
  );
}
