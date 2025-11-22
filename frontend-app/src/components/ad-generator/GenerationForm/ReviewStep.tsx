import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FileText, Palette, Settings, Timer, Pencil, AlertCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdCreativeFormData } from '@/types/ad-generator/form';

interface ReviewStepProps {
  formData: AdCreativeFormData;
  onEdit: (step: 1 | 2 | 3) => void;
  isSubmitting: boolean;
  submitError?: string | null;
  onParallelizeChange?: (checked: boolean) => void;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({
  formData,
  onEdit,
  isSubmitting,
  submitError,
  onParallelizeChange,
}) => {
  const estimatedTime = formData.duration <= 30 ? '3-5 minutes' : formData.duration <= 45 ? '5-7 minutes' : '7-10 minutes';

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Review & Submit
        </h2>
        <p className="text-muted-foreground">
          Please review your settings before creating your video.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="space-y-4">
        {/* Prompt Summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Video Prompt
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(1)}
                disabled={isSubmitting}
                className="h-8 gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-4">
              {formData.prompt}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {formData.prompt.length} characters
            </p>
          </CardContent>
        </Card>

        {/* Brand Summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Brand Identity
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(2)}
                disabled={isSubmitting}
                className="h-8 gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Brand Name</Label>
                <p className="text-sm text-foreground">
                  {formData.brandName || 'Not specified'}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Logo</Label>
                <div className="flex items-center gap-2">
                  {formData.brandLogo ? (
                    <>
                      <img
                        src={formData.brandLogo.url}
                        alt="Brand logo"
                        className="h-8 w-8 rounded object-contain border border-border"
                      />
                      <span className="text-sm text-foreground truncate">
                        {formData.brandLogo.filename}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">No logo uploaded</span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Colors</Label>
                <div className="flex items-center gap-2">
                  <div
                    className="h-6 w-6 rounded border border-border"
                    style={{ backgroundColor: formData.brandColors.primary }}
                  />
                  <div
                    className="h-6 w-6 rounded border border-border"
                    style={{ backgroundColor: formData.brandColors.secondary }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {formData.brandColors.primary} / {formData.brandColors.secondary}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Call-to-Action</Label>
                <p className="text-sm text-foreground">
                  {formData.includeCta ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-flex h-5 items-center rounded-full bg-primary/10 px-2 text-xs font-medium text-primary">
                        Enabled
                      </span>
                      <span className="text-muted-foreground italic">"{formData.ctaText}"</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Not included</span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Video Config Summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Video Configuration
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(3)}
                disabled={isSubmitting}
                className="h-8 gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Duration</Label>
                <p className="text-sm font-medium text-foreground">{formData.duration}s</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Aspect Ratio</Label>
                <p className="text-sm font-medium text-foreground">{formData.aspectRatio}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Visual Style</Label>
                <p className="text-sm font-medium text-foreground capitalize">{formData.style}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Music</Label>
                <p className="text-sm font-medium text-foreground capitalize">{formData.musicStyle}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estimated Time */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Timer className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Estimated Generation Time</p>
                <p className="text-xl font-bold text-primary">{estimatedTime}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Parallelization Option */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Zap className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="parallelize" className="text-sm font-medium cursor-pointer">
                    Parallel Generation
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Generate clips simultaneously for faster processing
                  </p>
                </div>
              </div>
              <Switch
                id="parallelize"
                checked={formData.parallelizeGenerations}
                onCheckedChange={(checked) => onParallelizeChange?.(checked)}
                disabled={isSubmitting}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Message */}
      {submitError && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{submitError}</p>
        </div>
      )}
    </div>
  );
};
