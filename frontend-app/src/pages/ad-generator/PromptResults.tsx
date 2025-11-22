import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Sparkles, ChevronRight } from 'lucide-react';
import type { VideoPromptResponse, VideoPromptClip } from '@/services/ad-generator/types';
import { generateImage, generateVideo, generateAudio } from '@/services/aiGenerationService';
import { PromptInput } from '@/components/ai-generation/PromptInput';
import type { GenerationType, QualityTier } from '@/types/stores';

interface LocationState {
  promptResult?: VideoPromptResponse;
}

export function PromptResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | undefined;
  const [promptResult, setPromptResult] = useState<VideoPromptResponse | null>(state?.promptResult || null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [loadingMap, setLoadingMap] = useState<Record<number, boolean>>({});
  const [resultMap, setResultMap] = useState<Record<number, { type: GenerationType; response: string }>>({});
  const [errorMap, setErrorMap] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!promptResult) {
      const stored = sessionStorage.getItem('promptResult');
      if (stored) {
        try {
          setPromptResult(JSON.parse(stored));
        } catch (error) {
          console.warn('Failed to parse stored prompt result', error);
        }
      }
    }
  }, [promptResult]);

  const clips = useMemo(() => promptResult?.content || [], [promptResult]);

  const handleUseInMedia = (clip: VideoPromptClip, mode: 'image' | 'video') => {
    sessionStorage.setItem(
      'media_ai_prompt',
      JSON.stringify({
        mode,
        video_prompt: clip.video_prompt,
        image_prompt: clip.image_prompt,
        length: clip.length,
      })
    );
    navigate('/media');
  };

  const handleGenerate = async (
    params: {
      prompt: string
      type: GenerationType
      qualityTier: QualityTier
      aspectRatio: '16:9' | '9:16' | '1:1' | '4:3'
      model: string
      duration?: number
      resolution?: string
      imageInput?: string
      audioInput?: string
      advancedParams?: Record<string, any>
    },
    index: number
  ) => {
    setErrorMap((prev) => ({ ...prev, [index]: '' }));
    setLoadingMap((prev) => ({ ...prev, [index]: true }));
    try {
      let res: any = null;
      if (params.type === 'image') {
        res = await generateImage({
          prompt: params.prompt,
          qualityTier: params.qualityTier,
          aspectRatio: params.aspectRatio,
          model: params.model,
          ...params.advancedParams,
        });
      } else if (params.type === 'video') {
        res = await generateVideo({
          prompt: params.prompt,
          aspectRatio: params.aspectRatio,
          duration: params.duration,
          model: params.model,
          resolution: params.resolution,
          image: params.imageInput,
          ...params.advancedParams,
        });
      } else if (params.type === 'audio') {
        res = await generateAudio({
          prompt: params.prompt,
          duration: params.duration,
          model: params.model,
          ...params.advancedParams,
        });
      }
      if (res) {
        setResultMap((prev) => ({
          ...prev,
          [index]: { type: params.type, response: JSON.stringify(res, null, 2) },
        }));
      }
    } catch (error: any) {
      setErrorMap((prev) => ({ ...prev, [index]: error?.message || 'Failed to generate' }));
    } finally {
      setLoadingMap((prev) => ({ ...prev, [index]: false }));
    }
  };

  if (!promptResult) {
    return (
      <div className="min-h-screen bg-background pb-12">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-2xl font-semibold text-foreground">Clip Prompts</h1>
          </div>
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No prompt results found. Generate prompts first from the Review & Submit step.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <p className="text-xs uppercase text-primary font-semibold tracking-wide inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Prompt Generator
              </p>
              <h1 className="text-2xl font-semibold text-foreground">Generated Clip Prompts</h1>
              <p className="text-sm text-muted-foreground">{promptResult.success}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total Clips</p>
            <p className="text-lg font-semibold text-foreground">{clips.length}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* Left column: expandables */}
          <div className="space-y-4">
            {clips.map((clip, index) => (
              <Collapsible
                key={index}
                open={expanded[index] || false}
                onOpenChange={(open) => setExpanded((prev) => ({ ...prev, [index]: open }))}
              >
                <CollapsibleTrigger asChild>
                  <Card className="w-full border-border text-left cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between gap-3 py-3">
                      <div className="space-y-0.5">
                        <CardTitle className="text-base text-foreground">Clip {index + 1}</CardTitle>
                        <p className="text-xs text-muted-foreground">Length: {clip.length}s</p>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 text-muted-foreground transition-transform ${
                          expanded[index] ? 'rotate-90' : ''
                        }`}
                      />
                    </CardHeader>
                  </Card>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <Card className="border-border">
                    <CardContent className="pt-4">
                      <PromptInput
                        defaultType="image"
                        defaultPrompt={clip.image_prompt}
                        autoPrompts={{ image: clip.image_prompt, video: clip.video_prompt }}
                        isPending={loadingMap[index] || false}
                        onGenerate={(params) => handleGenerate(params, index)}
                      />
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>

          {/* Right column: raw + list */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-foreground">Raw Response</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Payload returned from /api/v1/prompts/prompts/generate-video-clips
                </p>
              </CardHeader>
              <CardContent>
                <pre className="rounded-lg bg-muted/60 p-4 text-xs text-foreground overflow-x-auto border border-border">
                  {JSON.stringify(promptResult, null, 2)}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-foreground">Generated Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.keys(resultMap).length === 0 && (
                  <p className="text-sm text-muted-foreground">No generations yet. Run one on the left.</p>
                )}
                {Object.entries(resultMap).map(([idx, info]) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border bg-muted/40 p-3 space-y-1 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">Clip {Number(idx) + 1}</span>
                      <span className="text-xs text-muted-foreground uppercase">{info.type}</span>
                    </div>
                    <pre className="text-[11px] bg-background border border-border rounded p-2 overflow-x-auto">
                      {info.response}
                    </pre>
                  </div>
                ))}
                {Object.entries(errorMap).map(([idx, msg]) => (
                  <div
                    key={`err-${idx}`}
                    className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    Clip {Number(idx) + 1}: {msg}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PromptResults;
