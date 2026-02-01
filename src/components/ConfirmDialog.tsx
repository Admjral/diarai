import { memo, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  isLoading?: boolean;
}

export const ConfirmDialog = memo(function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  variant = 'default',
  isLoading = false,
}: ConfirmDialogProps) {
  const { t } = useLanguage();
  const finalConfirmText = confirmText || t.crm.confirmDialog.confirm;
  const finalCancelText = cancelText || t.crm.confirmDialog.cancel;
  const handleConfirm = useCallback(() => {
    onConfirm();
    if (!isLoading) {
      onOpenChange(false);
    }
  }, [onConfirm, onOpenChange, isLoading]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen);
    }
  }, [onOpenChange, isLoading]);

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="bg-slate-800 border-slate-700 text-white rounded-2xl p-6 max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            {variant === 'destructive' && (
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
            )}
            <div className="flex-1">
              <AlertDialogTitle className="!text-white text-xl font-semibold mb-2">
                {title}
              </AlertDialogTitle>
              <AlertDialogDescription className="!text-gray-400 text-sm leading-relaxed">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <div className="flex flex-row justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5 rounded-xl flex-shrink-0 min-w-[100px] font-medium transition-colors"
          >
            {finalCancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className={
              variant === 'destructive'
                ? 'bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5 rounded-xl font-medium flex-shrink-0 min-w-[100px] transition-colors'
                : 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5 rounded-xl font-medium flex-shrink-0 min-w-[100px] transition-all'
            }
          >
            {isLoading ? t.crm.confirmDialog.processing : finalConfirmText}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
});
