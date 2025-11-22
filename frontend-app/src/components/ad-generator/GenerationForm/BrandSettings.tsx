import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { AssetUploader, type UploadedAsset } from '@/components/ad-generator/AssetUploader';
import { Upload, Palette, Info, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandSettingsProps {
  brandName: string;
  brandLogo: UploadedAsset | null;
  primaryColor: string;
  secondaryColor: string;
  includeCta: boolean;
  ctaText: string;
  errors: Record<string, string>;
  onBrandNameChange: (value: string) => void;
  onBrandLogoChange: (logo: UploadedAsset | null) => void;
  onPrimaryColorChange: (color: string) => void;
  onSecondaryColorChange: (color: string) => void;
  onIncludeCtaChange: (include: boolean) => void;
  onCtaTextChange: (text: string) => void;
  onFieldBlur: (field: string, value: string) => void;
}

export const BrandSettings: React.FC<BrandSettingsProps> = ({
  brandName,
  brandLogo,
  primaryColor,
  secondaryColor,
  includeCta,
  ctaText,
  errors,
  onBrandNameChange,
  onBrandLogoChange,
  onPrimaryColorChange,
  onSecondaryColorChange,
  onIncludeCtaChange,
  onCtaTextChange,
  onFieldBlur,
}) => {
  const handleLogoUpload = (assets: UploadedAsset[]) => {
    if (assets.length > 0) {
      onBrandLogoChange(assets[0]);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Brand Identity
        </h2>
        <p className="text-muted-foreground">
          Configure your brand settings to ensure visual consistency throughout the video.
        </p>
      </div>

      {/* Brand Name & Logo */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Brand Name Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              Brand Name
            </CardTitle>
            <CardDescription>
              Your brand name will appear in the video if provided
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              value={brandName}
              onChange={(e) => onBrandNameChange(e.target.value)}
              onBlur={(e) => onFieldBlur('brandName', e.target.value)}
              placeholder="e.g., Acme Corporation"
              className={cn(errors.brandName && 'border-destructive')}
            />
            {errors.brandName && (
              <p className="text-sm text-destructive mt-2">{errors.brandName}</p>
            )}
          </CardContent>
        </Card>

        {/* Brand Logo Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Brand Logo
            </CardTitle>
            <CardDescription>
              Upload your logo to include it in the video (optional)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AssetUploader
              accept="image/*"
              maxSize={50 * 1024 * 1024}
              maxFiles={1}
              onUploadComplete={handleLogoUpload}
              existingAssets={brandLogo ? [brandLogo] : []}
              className="min-h-[100px]"
            />
          </CardContent>
        </Card>
      </div>

      {/* Brand Colors */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Brand Colors
          </CardTitle>
          <CardDescription>
            Choose colors that represent your brand
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Primary Color */}
            <div className="space-y-2">
              <Label htmlFor="primaryColor" className="text-sm">Primary Color</Label>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="color"
                    id="primaryColor"
                    value={primaryColor}
                    onChange={(e) => onPrimaryColorChange(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-lg border border-input bg-transparent p-0.5 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none"
                  />
                </div>
                <Input
                  value={primaryColor}
                  onChange={(e) => onPrimaryColorChange(e.target.value)}
                  placeholder="#000000"
                  className="flex-1 font-mono text-sm"
                />
              </div>
              {errors['brandColors.primary'] && (
                <p className="text-sm text-destructive">{errors['brandColors.primary']}</p>
              )}
            </div>

            {/* Secondary Color */}
            <div className="space-y-2">
              <Label htmlFor="secondaryColor" className="text-sm">Secondary Color</Label>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="color"
                    id="secondaryColor"
                    value={secondaryColor}
                    onChange={(e) => onSecondaryColorChange(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-lg border border-input bg-transparent p-0.5 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none"
                  />
                </div>
                <Input
                  value={secondaryColor}
                  onChange={(e) => onSecondaryColorChange(e.target.value)}
                  placeholder="#000000"
                  className="flex-1 font-mono text-sm"
                />
              </div>
              {errors['brandColors.secondary'] && (
                <p className="text-sm text-destructive">{errors['brandColors.secondary']}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call-to-Action */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Call-to-Action
              </CardTitle>
              <CardDescription>
                Add a call-to-action message at the end of your video
              </CardDescription>
            </div>
            <Switch
              checked={includeCta}
              onCheckedChange={onIncludeCtaChange}
            />
          </div>
        </CardHeader>
        {includeCta && (
          <CardContent className="pt-0">
            <div className="space-y-2">
              <Label htmlFor="ctaText" className="text-sm">CTA Text</Label>
              <Input
                id="ctaText"
                value={ctaText}
                onChange={(e) => onCtaTextChange(e.target.value)}
                onBlur={(e) => onFieldBlur('ctaText', e.target.value)}
                placeholder="e.g., Visit our website, Learn more, Shop now"
                maxLength={50}
                className={cn(errors.ctaText && 'border-destructive')}
              />
              <p className="text-xs text-muted-foreground">
                Keep it short and actionable ({ctaText.length}/50 characters)
              </p>
              {errors.ctaText && (
                <p className="text-sm text-destructive">{errors.ctaText}</p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border">
        <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Brand settings are optional but help create a more personalized and consistent video that aligns with your brand identity.
        </p>
      </div>
    </div>
  );
};
