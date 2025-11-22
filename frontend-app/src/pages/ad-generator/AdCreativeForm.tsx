import React from 'react';
import { useGenerationForm } from '@/hooks/ad-generator/useGenerationForm';
import { isStepComplete } from '@/utils/ad-generator/formValidation';
import {
  FormContainer,
  StepIndicator,
  PromptInput,
  BrandSettings,
  VideoParameters,
  ReviewStep,
} from '@/components/ad-generator/GenerationForm';
import { ConfirmDialog } from '@/components/ad-generator/ui/ConfirmDialog';
import { Sparkles } from 'lucide-react';

export const AdCreativeForm: React.FC = () => {
  const {
    currentStep,
    formData,
    errors,
    isSubmitting,
    submitError,
    analysisResult,
    promptResult,
    promptError,
    isGeneratingPrompts,
    updateField,
    handleFieldBlur,
    nextStep,
    previousStep,
    goToStep,
    submitForm,
    generatePrompts,
    showRestoreDialog,
    handleResume,
    handleDiscard,
  } = useGenerationForm();

  const renderJsonBlock = (data: unknown) => {
    if (!data) return <p className="text-sm text-muted-foreground">No data returned.</p>;
    return (
      <pre className="rounded-lg bg-muted/60 p-4 text-xs text-foreground overflow-x-auto border border-border">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  // Calculate completed steps
  const completedSteps: number[] = [];
  for (let step = 1; step <= 3; step++) {
    if (isStepComplete(step, formData)) {
      completedSteps.push(step);
    }
  }

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <PromptInput
            value={formData.prompt}
            onChange={(value) => updateField('prompt', value)}
            onBlur={(value) => handleFieldBlur('prompt', value)}
            error={errors.prompt}
          />
        );

      case 2:
        return (
          <BrandSettings
            brandName={formData.brandName}
            brandLogo={formData.brandLogo}
            primaryColor={formData.brandColors.primary}
            secondaryColor={formData.brandColors.secondary}
            includeCta={formData.includeCta}
            ctaText={formData.ctaText}
            errors={errors}
            onBrandNameChange={(value) => updateField('brandName', value)}
            onBrandLogoChange={(logo) => updateField('brandLogo', logo)}
            onPrimaryColorChange={(color) => updateField('brandColors.primary', color)}
            onSecondaryColorChange={(color) => updateField('brandColors.secondary', color)}
            onIncludeCtaChange={(include) => updateField('includeCta', include)}
            onCtaTextChange={(text) => updateField('ctaText', text)}
            onFieldBlur={handleFieldBlur}
          />
        );

      case 3:
        return (
          <VideoParameters
            duration={formData.duration}
            aspectRatio={formData.aspectRatio}
            style={formData.style}
            musicStyle={formData.musicStyle}
            errors={errors}
            onDurationChange={(value) => updateField('duration', value)}
            onAspectRatioChange={(value) => updateField('aspectRatio', value)}
            onStyleChange={(value) => updateField('style', value)}
            onMusicStyleChange={(value) => updateField('musicStyle', value)}
          />
        );

      case 4:
        return (
          <ReviewStep
            formData={formData}
            onEdit={(step) => goToStep(step as 1 | 2 | 3 | 4)}
            isSubmitting={isSubmitting}
            submitError={submitError}
            onParallelizeChange={(checked) => updateField('parallelizeGenerations', checked)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-primary mb-3">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-medium uppercase tracking-wider">AI Video Generator</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Create Ad Creative Video
          </h1>
          <p className="mt-2 text-muted-foreground">
            Generate a professional ad creative video in minutes with AI
          </p>
        </header>

        {/* Stepper */}
        <div className="mb-8">
          <StepIndicator
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={(step) => goToStep(step as 1 | 2 | 3 | 4)}
          />
        </div>

        {/* Form Content */}
        <FormContainer
          currentStep={currentStep}
          onNext={nextStep}
          onPrevious={previousStep}
          onSubmit={submitForm}
          isSubmitting={isSubmitting}
          canGoNext={true}
          onGeneratePrompts={generatePrompts}
          isGeneratingPrompts={isGeneratingPrompts}
        >
          {renderStepContent()}
        </FormContainer>
      </div>

      {/* Restore Draft Dialog */}
      <ConfirmDialog
        isOpen={showRestoreDialog}
        title="Previous Draft Found"
        message="A previous draft was found. Would you like to resume where you left off?"
        confirmLabel="Resume"
        cancelLabel="Discard"
        confirmVariant="primary"
        cancelVariant="outline"
        onConfirm={handleResume}
        onCancel={handleDiscard}
      />

      {(analysisResult || promptResult || promptError) && (
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 mt-8">
          <div className="bg-card border border-primary/30 rounded-xl shadow-sm p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-primary mb-2">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Analysis Output</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground">We analyzed your request</h3>
                <p className="text-sm text-muted-foreground">
                  Prompt analysis, brand insights, scene breakdown, and generated micro-prompts are returned below.
                </p>
              </div>
              {analysisResult?.generation_id && (
                <div className="text-right">
                  <p className="text-xs uppercase text-muted-foreground">Generation ID</p>
                  <p className="font-mono text-sm text-foreground">{analysisResult.generation_id}</p>
                </div>
              )}
            </div>

            {analysisResult && (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Scenes</p>
                  <p className="text-lg font-semibold text-foreground">{analysisResult.scenes?.length ?? 0}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Micro-prompts</p>
                  <p className="text-lg font-semibold text-foreground">{analysisResult.micro_prompts?.length ?? 0}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Brand Config</p>
                  <p className="text-lg font-semibold text-foreground">
                    {analysisResult.brand_config ? 'Returned' : 'None'}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-lg font-semibold text-foreground capitalize">{analysisResult.status}</p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {analysisResult && (
                <>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">Prompt Analysis</p>
                    {renderJsonBlock(analysisResult.prompt_analysis)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">Brand Analysis</p>
                    {renderJsonBlock(analysisResult.brand_config)}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-1">Scene Decomposition</p>
                      {renderJsonBlock(analysisResult.scenes)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-1">Micro-prompts</p>
                      {renderJsonBlock(analysisResult.micro_prompts)}
                    </div>
                  </div>
                </>
              )}

              {promptResult && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-foreground">Clip Prompts (OpenAI)</p>
                    <p className="text-xs text-muted-foreground">
                      {promptResult.content?.length ?? 0} clips
                    </p>
                  </div>
                  {renderJsonBlock(promptResult)}
                </div>
              )}

              {promptError && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <span className="text-sm text-destructive">{promptError}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
