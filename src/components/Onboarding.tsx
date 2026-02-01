import { useState, memo, useMemo, useCallback } from 'react';
import { Sparkles, Target, TrendingUp, Zap } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding = memo(function Onboarding({ onComplete }: OnboardingProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);

  const screens = useMemo(() => [
    {
      icon: <div className="text-8xl mb-8 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 bg-clip-text text-transparent">DIAR</div>,
      title: '',
      description: '',
    },
    {
      icon: <Sparkles className="w-24 h-24 mb-8 text-yellow-500" />,
      title: t.onboarding.screen1.title,
      description: t.onboarding.screen1.description,
    },
    {
      icon: <Target className="w-24 h-24 mb-8 text-blue-500" />,
      title: t.onboarding.screen2.title,
      description: t.onboarding.screen2.description,
    },
    {
      icon: <Zap className="w-24 h-24 mb-8 text-purple-500" />,
      title: t.onboarding.screen3.title,
      description: t.onboarding.screen3.description,
    },
  ], [t]);

  const handleNext = useCallback(() => {
    if (step < screens.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  }, [step, screens.length, onComplete]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"></div>

      <div className="relative z-10 flex flex-col items-center justify-center max-w-lg w-full text-center">
        <div className="mb-12 transition-all duration-500 animate-in fade-in">
          {screens[step].icon}
        </div>

        {screens[step].title && (
          <h1 className="mb-6 text-white max-w-md">
            {screens[step].title}
          </h1>
        )}

        {screens[step].description && (
          <p className="text-gray-400 mb-12 max-w-md">
            {screens[step].description}
          </p>
        )}

        {/* Progress indicators */}
        <div className="flex gap-2 mb-12">
          {screens.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === step
                  ? 'w-8 bg-gradient-to-r from-yellow-400 to-amber-500'
                  : 'w-2 bg-gray-700'
              }`}
            ></div>
          ))}
        </div>

        <button
          onClick={handleNext}
          className="px-8 py-4 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 text-black rounded-xl hover:shadow-lg hover:shadow-yellow-500/50 transition-all duration-300 hover:scale-105"
        >
          {step === screens.length - 1 ? t.onboarding.continue : t.onboarding.next}
        </button>
      </div>
    </div>
  );
});