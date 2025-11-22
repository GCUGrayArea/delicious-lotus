import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';

interface FormContainerProps {
  children: React.ReactNode;
  currentStep: number;
  onNext: () => void;
  onPrevious: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  canGoNext?: boolean;
  onGeneratePrompts?: () => void;
  isGeneratingPrompts?: boolean;
}

export const FormContainer: React.FC<FormContainerProps> = ({
  children,
  currentStep,
  onNext,
  onPrevious,
  onSubmit,
  isSubmitting = false,
  canGoNext = true,
  onGeneratePrompts,
  isGeneratingPrompts = false,
}) => {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === 4;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Content area */}
      <div className="bg-card rounded-xl border border-border p-6 md:p-8 shadow-sm min-h-[400px]">
        {children}
      </div>

      {/* Navigation buttons */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
        {!isFirstStep ? (
          <Button
            variant="outline"
            onClick={onPrevious}
            disabled={isSubmitting}
            className="w-full sm:w-auto gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        ) : (
          <div className="hidden sm:block" />
        )}

        {isLastStep ? (
          <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3 sm:gap-2 justify-end">
            <Button
              variant="outline"
              onClick={onGeneratePrompts}
              disabled={isGeneratingPrompts}
              className="w-full sm:w-auto gap-2"
            >
              {isGeneratingPrompts ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Generating Prompts...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Prompts
                </>
              )}
            </Button>

            <Button
              onClick={onSubmit}
              disabled={isSubmitting}
              className="w-full sm:w-auto gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Run Analysis
                </>
              )}
            </Button>
          </div>
        ) : (
          <Button
            onClick={onNext}
            disabled={!canGoNext}
            className="w-full sm:w-auto gap-2"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
