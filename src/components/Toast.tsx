import { useEffect, memo, useMemo } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

export const Toast = memo(function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = useMemo(() => ({
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    error: <XCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
  }), []);

  const backgrounds = useMemo(() => ({
    success: 'from-green-500/20 to-green-600/20 border-green-500/50',
    error: 'from-red-500/20 to-red-600/20 border-red-500/50',
    info: 'from-blue-500/20 to-blue-600/20 border-blue-500/50',
  }), []);

  return (
    <div className={`fixed top-4 right-4 left-4 sm:left-auto sm:min-w-[300px] z-[100] bg-gradient-to-r ${backgrounds[type]} border backdrop-blur-sm rounded-xl p-4 shadow-lg animate-in slide-in-from-top-5 max-w-sm sm:max-w-none`}>
      <div className="flex items-center gap-3">
        {icons[type]}
        <p className="text-white flex-1">{message}</p>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});
