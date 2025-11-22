import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepIndicatorProps {
  currentStep: number;
  completedSteps: number[];
  onStepClick: (step: number) => void;
}

const STEPS = [
  { id: 1, title: 'Prompt', description: 'Describe your video' },
  { id: 2, title: 'Brand', description: 'Logo & Colors' },
  { id: 3, title: 'Settings', description: 'Duration & Style' },
  { id: 4, title: 'Review', description: 'Final Check' },
];

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  completedSteps,
  onStepClick,
}) => {
  return (
    <nav aria-label="Progress" className="w-full">
      {/* Desktop: Horizontal stepper */}
      <ol className="hidden md:flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isActive = currentStep === step.id;
          const isClickable = isCompleted || isActive;
          const isLast = index === STEPS.length - 1;

          return (
            <li key={step.id} className={cn('flex items-center', !isLast && 'flex-1')}>
              <button
                type="button"
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                className={cn(
                  'group flex flex-col items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg p-2 transition-all',
                  isClickable ? 'cursor-pointer' : 'cursor-not-allowed'
                )}
              >
                {/* Step circle */}
                <div
                  className={cn(
                    'relative flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-200',
                    isCompleted
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isActive
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted-foreground/30 bg-muted/50 text-muted-foreground',
                    isClickable && !isCompleted && !isActive && 'group-hover:border-primary/50 group-hover:bg-primary/5'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" strokeWidth={2.5} />
                  ) : (
                    step.id
                  )}
                </div>
                {/* Step label */}
                <div className="flex flex-col items-center gap-0.5">
                  <span
                    className={cn(
                      'text-sm font-medium transition-colors',
                      isActive ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {step.title}
                  </span>
                  <span className="text-xs text-muted-foreground hidden lg:block">
                    {step.description}
                  </span>
                </div>
              </button>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 mx-4">
                  <div
                    className={cn(
                      'h-0.5 w-full rounded-full transition-colors duration-300',
                      isCompleted ? 'bg-primary' : 'bg-border'
                    )}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile: Vertical stepper */}
      <ol className="flex md:hidden flex-col gap-4">
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isActive = currentStep === step.id;
          const isClickable = isCompleted || isActive;
          const isLast = index === STEPS.length - 1;

          return (
            <li key={step.id} className="flex gap-4">
              {/* Step indicator column */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(step.id)}
                  disabled={!isClickable}
                  className={cn(
                    'relative flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isCompleted
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isActive
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted-foreground/30 bg-muted/50 text-muted-foreground',
                    isClickable ? 'cursor-pointer' : 'cursor-not-allowed'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" strokeWidth={2.5} />
                  ) : (
                    step.id
                  )}
                </button>
                {/* Vertical connector */}
                {!isLast && (
                  <div
                    className={cn(
                      'w-0.5 flex-1 min-h-[24px] rounded-full mt-2 transition-colors duration-300',
                      isCompleted ? 'bg-primary' : 'bg-border'
                    )}
                  />
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 pb-4">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(step.id)}
                  disabled={!isClickable}
                  className={cn(
                    'text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md p-1 -m-1 transition-colors',
                    isClickable ? 'cursor-pointer' : 'cursor-not-allowed'
                  )}
                >
                  <span
                    className={cn(
                      'block text-sm font-medium transition-colors',
                      isActive ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {step.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {step.description}
                  </span>
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
