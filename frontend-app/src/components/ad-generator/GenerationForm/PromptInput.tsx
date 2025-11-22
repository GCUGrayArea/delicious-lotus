import React from 'react';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Lightbulb, ChevronDown, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
  error?: string;
}

const EXAMPLE_PROMPTS = [
  {
    title: 'Eco-Friendly Product',
    prompt: 'Create a dynamic 30-second ad showcasing our new eco-friendly water bottle. Start with a close-up of morning dew on leaves, transition to an active lifestyle montage (hiking, yoga, cycling), and end with the product against a natural backdrop. Emphasize sustainability and health.',
  },
  {
    title: 'Productivity App',
    prompt: 'Produce an upbeat advertisement for a productivity app. Begin with a chaotic desk scene, then show the app interface organizing tasks smoothly. Include testimonials from diverse users, and conclude with a clear call-to-action. Modern, professional aesthetic with vibrant colors.',
  },
  {
    title: 'Luxury Car',
    prompt: "Design a luxury car commercial featuring sleek cityscapes at night. Highlight the vehicle's elegant lines with cinematic camera movements, showcase advanced tech features through UI overlays, and emphasize premium craftsmanship. Sophisticated, aspirational tone throughout.",
  },
];

const TIPS = [
  'Be specific about visual elements, camera angles, and transitions',
  'Describe the mood, tone, and pacing you want',
  'Include details about colors, lighting, and aesthetic preferences',
  'Mention any text overlays, captions, or key messages',
  'Specify the target audience and desired emotional impact',
];

export const PromptInput: React.FC<PromptInputProps> = ({
  value,
  onChange,
  onBlur,
  error,
}) => {
  const [tipsOpen, setTipsOpen] = React.useState(false);
  const charCount = value.length;
  const maxLength = 2000;
  const isNearMax = charCount > 1800;

  const handleUseExample = (prompt: string) => {
    onChange(prompt);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Describe Your Video
        </h2>
        <p className="text-muted-foreground">
          Provide a detailed description of the video you want to create. The more specific you are, the better the results.
        </p>
      </div>

      {/* Textarea */}
      <div className="space-y-2">
        <Label htmlFor="prompt" className="text-sm font-medium">
          Video Prompt
        </Label>
        <div className="relative">
          <textarea
            id="prompt"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => onBlur(e.target.value)}
            placeholder="Describe your video in detail..."
            maxLength={maxLength}
            rows={6}
            className={cn(
              'flex min-h-[160px] w-full rounded-lg border bg-background px-4 py-3 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none',
              error ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
            )}
          />
          <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
            <span className={cn(isNearMax && 'text-destructive font-medium')}>
              {charCount}
            </span>
            /{maxLength}
          </div>
        </div>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>

      {/* Example prompts - shown when empty */}
      {charCount === 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Wand2 className="h-4 w-4" />
            <span>Try an example</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-3">
            {EXAMPLE_PROMPTS.map((example, index) => (
              <Card
                key={index}
                className="cursor-pointer transition-all hover:border-primary hover:shadow-md group"
                onClick={() => handleUseExample(example.prompt)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-primary">
                      {example.title}
                    </span>
                    <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      Use this
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {example.prompt}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tips collapsible */}
      <Collapsible open={tipsOpen} onOpenChange={setTipsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full">
          <Lightbulb className="h-4 w-4" />
          <span>Tips for effective prompts</span>
          <ChevronDown className={cn('h-4 w-4 ml-auto transition-transform', tipsOpen && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <ul className="space-y-2">
                {TIPS.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary mt-1">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
