import { useLanguage } from '../contexts/LanguageContext';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  fullScreen?: boolean;
  variant?: 'default' | 'minimal' | 'branded';
}

export function LoadingSpinner({
  size = 'lg',
  text,
  fullScreen = true,
  variant = 'branded',
}: LoadingSpinnerProps) {
  const { t } = useLanguage();
  const displayText = text ?? t.common.loading;

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
  };

  const containerClasses = fullScreen
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm'
    : 'flex items-center justify-center p-8';

  if (variant === 'minimal') {
    return (
      <div className={containerClasses}>
        <div className="flex flex-col items-center gap-4">
          <div className={`${sizeClasses[size]} relative`}>
            <div className="absolute inset-0 rounded-full border-2 border-slate-700" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-yellow-500 animate-spin" />
          </div>
          {displayText && (
            <p className={`text-slate-400 ${textSizes[size]} animate-pulse`}>
              {displayText}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'default') {
    return (
      <div className={containerClasses}>
        <div className="flex flex-col items-center gap-4">
          <div className={`${sizeClasses[size]} relative`}>
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border-4 border-slate-700/50" />
            {/* Spinning gradient ring */}
            <div
              className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
              style={{
                borderTopColor: '#EAB308',
                borderRightColor: '#F59E0B',
                animationDuration: '0.8s',
              }}
            />
            {/* Inner pulsing dot */}
            <div className="absolute inset-3 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 animate-pulse" />
          </div>
          {displayText && (
            <p className={`text-slate-300 ${textSizes[size]} font-medium`}>
              {displayText}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Branded variant - DIAR AI style
  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center gap-6">
        {/* Logo Animation Container */}
        <div className="relative">
          {/* Outer glow */}
          <div
            className={`${sizeClasses[size]} absolute -inset-4 rounded-full bg-gradient-to-r from-yellow-500/20 via-amber-500/20 to-yellow-500/20 blur-xl animate-pulse`}
            style={{ animationDuration: '2s' }}
          />

          {/* Spinning outer ring */}
          <div className={`${sizeClasses[size]} relative`}>
            <svg
              className="absolute inset-0 w-full h-full animate-spin"
              style={{ animationDuration: '3s' }}
              viewBox="0 0 100 100"
            >
              <defs>
                <linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#EAB308" stopOpacity="1" />
                  <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#EAB308" stopOpacity="0" />
                </linearGradient>
              </defs>
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="url(#spinnerGradient)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>

            {/* Counter-rotating inner ring */}
            <svg
              className="absolute inset-2 w-[calc(100%-16px)] h-[calc(100%-16px)]"
              style={{ animation: 'spin 2s linear infinite reverse' }}
              viewBox="0 0 100 100"
            >
              <defs>
                <linearGradient id="innerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity="0" />
                  <stop offset="50%" stopColor="#EAB308" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.8" />
                </linearGradient>
              </defs>
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="url(#innerGradient)"
                strokeWidth="2"
                strokeDasharray="60 40"
                strokeLinecap="round"
              />
            </svg>

            {/* Center logo/icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                {/* Pulsing background */}
                <div
                  className="absolute -inset-2 rounded-xl bg-gradient-to-br from-yellow-500/30 to-amber-600/30 blur-md animate-pulse"
                  style={{ animationDuration: '1.5s' }}
                />
                {/* Logo text */}
                <div className="relative bg-gradient-to-br from-yellow-400 via-amber-400 to-yellow-500 bg-clip-text text-transparent font-bold select-none"
                  style={{ fontSize: size === 'xl' ? '1.5rem' : size === 'lg' ? '1rem' : '0.75rem' }}
                >
                  D
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading text with animated dots */}
        {displayText && (
          <div className="flex items-center gap-1">
            <span className={`text-slate-300 ${textSizes[size]} font-medium`}>
              {displayText}
            </span>
            <span className="flex gap-0.5">
              <span
                className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-bounce"
                style={{ animationDelay: '0ms', animationDuration: '0.6s' }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-bounce"
                style={{ animationDelay: '150ms', animationDuration: '0.6s' }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-bounce"
                style={{ animationDelay: '300ms', animationDuration: '0.6s' }}
              />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Компактный inline спиннер для кнопок
export function ButtonSpinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin h-4 w-4 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// Skeleton loader с shimmer эффектом
export function ShimmerLoader({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-slate-800/50 rounded-lg ${className}`}>
      <div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-slate-700/50 to-transparent animate-shimmer"
        style={{
          animation: 'shimmer 1.5s infinite',
        }}
      />
      <style>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
