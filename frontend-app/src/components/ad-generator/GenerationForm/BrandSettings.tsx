import React from 'react';
import { Input } from '@/components/ad-generator/ui/Input';
import { ColorPicker } from '@/components/ad-generator/ui/ColorPicker';
import { Radio } from '@/components/ad-generator/ui/Radio';
import { AssetUploader, type UploadedAsset } from '@/components/ad-generator/AssetUploader';

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
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-foreground m-0 sm:text-xl">Brand Identity</h2>
        <p className="text-base text-muted-foreground leading-relaxed m-0">
          Configure your brand settings to ensure visual consistency throughout the video.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:gap-4">
        <h3 className="text-lg font-semibold text-foreground m-0">Basic Information</h3>
        <Input
          label="Brand Name (Optional)"
          value={brandName}
          onChange={(e) => onBrandNameChange(e.target.value)}
          onBlur={(e) => onFieldBlur('brandName', e.target.value)}
          error={errors.brandName}
          placeholder="e.g., Acme Corporation"
          helperText="Your brand name will appear in the video if provided"
          fullWidth
        />
      </div>

      <div className="flex flex-col gap-3 sm:gap-4">
        <h3 className="text-lg font-semibold text-foreground m-0">Brand Logo</h3>
        <p className="text-sm text-muted-foreground leading-normal m-0">
          Upload your logo to include it in the video (optional)
        </p>
        <AssetUploader
          accept="image/*"
          maxSize={50 * 1024 * 1024}
          maxFiles={1}
          onUploadComplete={handleLogoUpload}
          existingAssets={brandLogo ? [brandLogo] : []}
          className="min-h-[140px]"
        />
      </div>

      <div className="flex flex-col gap-3 sm:gap-4">
        <h3 className="text-lg font-semibold text-foreground m-0">Brand Colors</h3>
        <p className="text-sm text-muted-foreground leading-normal m-0">
          Choose colors that represent your brand
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 sm:grid-cols-1">
          <ColorPicker
            label="Primary Color"
            value={primaryColor}
            onChange={onPrimaryColorChange}
            error={errors['brandColors.primary']}
            fullWidth
          />
          <ColorPicker
            label="Secondary Color"
            value={secondaryColor}
            onChange={onSecondaryColorChange}
            error={errors['brandColors.secondary']}
            fullWidth
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:gap-4">
        <h3 className="text-lg font-semibold text-foreground m-0">Call-to-Action</h3>
        <p className="text-sm text-muted-foreground leading-normal m-0">
          Add a call-to-action message at the end of your video
        </p>
        <Radio
          options={[
            {
              value: 'yes',
              label: 'Include CTA',
              description: 'Add a call-to-action message at the end',
            },
            {
              value: 'no',
              label: 'No CTA',
              description: 'End without a call-to-action',
            },
          ]}
          value={includeCta ? 'yes' : 'no'}
          onChange={(value) => onIncludeCtaChange(value === 'yes')}
          name="includeCta"
          orientation="horizontal"
        />

        {includeCta && (
          <div className="mt-3 p-4 bg-secondary rounded-md border-l-4 border-primary">
            <Input
              label="CTA Text"
              value={ctaText}
              onChange={(e) => onCtaTextChange(e.target.value)}
              onBlur={(e) => onFieldBlur('ctaText', e.target.value)}
              error={errors.ctaText}
              placeholder="e.g., Visit our website, Learn more, Shop now"
              helperText="Keep it short and actionable (max 50 characters)"
              maxLength={50}
              fullWidth
            />
          </div>
        )}
      </div>

      <div className="flex gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-md items-start">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0 text-primary mt-[2px]"
        >
          <path
            d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0zm1 15H9v-6h2v6zm0-8H9V5h2v2z"
            fill="currentColor"
          />
        </svg>
        <p className="text-sm text-muted-foreground leading-relaxed m-0">
          Brand settings are optional but help create a more personalized and consistent video that aligns with your brand identity.
        </p>
      </div>
    </div>
  );
};
