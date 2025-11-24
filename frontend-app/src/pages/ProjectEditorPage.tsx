import { useParams, useNavigate } from 'react-router';
import { useEffect, useCallback, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useShallow } from 'zustand/react/shallow';
import { PanelResizeHandle, Panel, PanelGroup } from 'react-resizable-panels';
import { Timeline } from '../components/timeline';
import { MediaLibraryWidget } from '../components/media/MediaLibraryWidget';
import { ClipsListPanel } from '../components/timeline/ClipsListPanel';
import { ClipPropertiesPanel } from '../components/timeline/ClipPropertiesPanel';
import { PreviewCanvas } from '../components/preview/PreviewCanvas';
import { ExportDialog } from '../components/ExportDialog';
import { ExportProgress } from '../components/export/ExportProgress';
import { useTimelineStore, useMediaStore, useEditorStore, useProjectStore, useWebSocketStore } from '../contexts/StoreContext';
import type { MediaAsset, Clip } from '../types/stores';
import type { ExportSettings, CompositionCreateRequest } from '../types/composition';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

/**
 * Project editor page with basic editor shell and route param handling
 */
export default function ProjectEditorPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const timelineStore = useTimelineStore();
  const mediaStore = useMediaStore();
  const editorStore = useEditorStore();
  const projectStore = useProjectStore();
  const addJob = useWebSocketStore((state) => state.addJob);
  const removeJob = useWebSocketStore((state) => state.removeJob);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportPayload, setExportPayload] = useState<{
    clips: Array<{
      video_url: string
      start_time: number
      end_time: number
      trim_start: number
      trim_end: number
    }>
    overlays: unknown[]
  } | null>(null);

  // Select Timeline state with useShallow for optimized re-renders
  const { tracks, clips, selectedClipIds, playhead, zoom, fps } = useTimelineStore(
    useShallow((state) => ({
      tracks: state.tracks,
      clips: state.clips,
      selectedClipIds: state.selectedClipIds,
      playhead: state.playhead,
      zoom: state.zoom,
      fps: state.fps,
    }))
  );

  // Select Editor state
  const { isPlaying } = useEditorStore(
    useShallow((state) => ({
      isPlaying: state.isPlaying,
    }))
  );

  // Initialize default track on component mount (single track for mixed media)
  useEffect(() => {
    if (timelineStore.tracks.length === 0) {
      // Add default track that can handle all media types
      timelineStore.addTrack({
        type: 'video', // Type is now just cosmetic for color
        name: 'Track 1',
        height: 80,
        locked: false,
        hidden: false,
        muted: false,
        order: 0,
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate duration (default to 5 minutes if not set)
  const duration = timelineStore.duration > 0 ? timelineStore.duration : timelineStore.fps * 300;

  // Event handler for adding tracks
  const handleAddTrack = useCallback(() => {
    const trackNumber = timelineStore.tracks.length + 1;
    timelineStore.addTrack({
      type: 'video', // Type is now just cosmetic for color
      name: `Track ${trackNumber}`,
      height: 80,
      locked: false,
      hidden: false,
      muted: false,
      order: timelineStore.tracks.length,
    });
  }, [timelineStore]);

  // Event handler for deleting tracks
  const handleDeleteTrack = useCallback((trackId: string) => {
    timelineStore.removeTrack(trackId);
  }, [timelineStore]);

  // Handle dropping media asset onto timeline track
  const handleAssetDrop = useCallback((asset: MediaAsset, trackId: string, startFrame: number) => {
    console.log('=== ASSET DROP DEBUG ===');
    console.log('Asset dropped:', asset);
    console.log('Asset.duration (raw):', asset.duration);
    console.log('Asset.duration type:', typeof asset.duration);
    console.log('Asset.duration truthy?:', !!asset.duration);
    console.log('Asset metadata:', asset.metadata);
    console.log('FPS:', fps);

    // Convert duration from seconds to frames
    const durationInFrames = asset.duration ? Math.floor(asset.duration * fps) : fps * 2; // Default 2 seconds for images

    console.log('Duration calculation:');
    console.log('  - asset.duration:', asset.duration);
    console.log('  - fps:', fps);
    console.log('  - durationInFrames (calculated):', durationInFrames);
    console.log('  - Used fallback?:', !asset.duration);

    // Create a new clip from the media asset
    const newClip: Clip = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      trackId,
      assetId: asset.id,
      startTime: startFrame,
      duration: durationInFrames,
      inPoint: 0,
      outPoint: durationInFrames,
      layer: 0,
      opacity: 1,
      scale: { x: 1, y: 1 },
      position: { x: 0, y: 0 },
      rotation: 0,
    };

    console.log('Created clip:', newClip);
    console.log('Clip duration (frames):', newClip.duration);
    console.log('Clip outPoint (frames):', newClip.outPoint);
    console.log('Clip duration (seconds):', newClip.duration / fps);
    console.log('======================');

    // Add the clip to the timeline
    timelineStore.addClip(newClip);
  }, [timelineStore, fps]);

  // Playback control handlers
  const handleTogglePlayback = useCallback(() => {
    editorStore.togglePlayback();
  }, [editorStore]);

  const handleSkipBack = useCallback(() => {
    // Skip back 1 second
    const newPlayhead = Math.max(0, playhead - fps);
    timelineStore.setPlayhead(newPlayhead);
  }, [timelineStore, playhead, fps]);

  const handleSkipForward = useCallback(() => {
    // Skip forward 1 second
    const newPlayhead = Math.min(duration, playhead + fps);
    timelineStore.setPlayhead(newPlayhead);
  }, [timelineStore, playhead, fps, duration]);

  // Get selected clip for properties panel
  const selectedClip = selectedClipIds.length === 1
    ? clips.get(selectedClipIds[0])
    : undefined;

  // Export handlers
  const handleExport = useCallback(() => {
    try {
      // Get all clips from the timeline
      const allClips = Array.from(clips.values());

      if (allClips.length === 0) {
        toast.error('No clips to export', {
          description: 'Add some clips to the timeline before exporting.',
        });
        return;
      }

      // Transform clips to the backend format
      const transformedClips = allClips.map((clip) => {
        // Get the asset URL from the media store
        const asset = mediaStore.assets.get(clip.assetId);
        if (!asset) {
          throw new Error(`Asset not found for clip ${clip.id}`);
        }

        // Convert frames to seconds
        const startTime = clip.startTime / fps;
        const duration = clip.duration / fps;
        const endTime = startTime + duration;

        // trim_start: where to start in the source video (in seconds)
        const trimStart = clip.inPoint / fps;

        // trim_end: where to end in the source video (in seconds)
        // This is the outPoint converted to seconds
        const trimEnd = clip.outPoint / fps;

        return {
          video_url: asset.url,
          start_time: startTime,
          end_time: endTime,
          trim_start: trimStart,
          trim_end: trimEnd,
        };
      });

      // Sort clips by start_time
      transformedClips.sort((a, b) => a.start_time - b.start_time);

      // Prepare the payload
      const payload = {
        clips: transformedClips,
        overlays: [],
      };

      // Set the payload and open the dialog
      setExportPayload(payload);
      setIsExportDialogOpen(true);
    } catch (error) {
      console.error('Failed to prepare export:', error);
      toast.error('Failed to prepare export', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }, [clips, mediaStore, fps]);

  const handleConfirmExport = useCallback(async (settings: ExportSettings) => {
    if (!exportPayload) return;

    try {
      // Get project name for the composition title
      const projectName = projectStore.metadata.name || 'Untitled Composition';

      // Construct the complete composition request payload
      const compositionPayload: CompositionCreateRequest = {
        title: projectName,
        description: settings.description,
        clips: exportPayload.clips,
        overlays: exportPayload.overlays as any[], // TODO: Implement overlay support
        output: settings.output,
      };

      // Show loading toast
      toast.info('Exporting...', {
        description: 'Sending your composition to the backend.',
      });

      console.log('[Export] Sending composition payload:', compositionPayload);

      // Send to the backend API
      const response = await api.post<{
        jobId: string;
        status: 'queued' | 'processing' | 'completed' | 'failed';
        message?: string;
        createdAt: string;
      }>('/compositions', compositionPayload);

      console.log('[Export] Response:', response);

      // Add job to WebSocket store for progress tracking
      addJob({
        id: response.jobId,
        type: 'export',
        status: response.status === 'processing' ? 'running' : 'queued',
        message: response.message || 'Export queued',
        createdAt: new Date(response.createdAt),
        updatedAt: new Date(),
      });

      toast.success('Export started successfully!', {
        description: 'Your video is being processed. Check progress in the bottom right.',
      });
    } catch (error) {
      console.error('[Export] Failed:', error);
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
      throw error; // Re-throw to let the dialog handle the error state
    }
  }, [exportPayload, projectStore.metadata.name, addJob]);

  // Handle download of completed export
  const handleExportDownload = useCallback((downloadUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Download started', {
      description: `Downloading ${fileName}`,
    });
  }, []);

  // Handle closing export job card
  const handleExportClose = useCallback((jobId: string) => {
    removeJob(jobId);
  }, [removeJob]);

  // Navigate to Ad Mode
  const handleAdMode = useCallback(() => {
    navigate(`/ad-generator/create/ad-creative?projectId=${projectId}`);
  }, [navigate, projectId]);

  return (
    <div className="h-screen w-full bg-zinc-950 overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-400">Timeline Editor</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleAdMode}
            className="gap-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30"
          >
            <Sparkles className="h-4 w-4" />
            Ad Mode
          </Button>
        </div>
      </div>

      {/* Main Editor Content */}
      <div className="flex-1 overflow-hidden">
      <PanelGroup direction="vertical">
        {/* Top Section: Media Library | Preview | Details */}
        <Panel defaultSize={67} minSize={40}>
          <PanelGroup direction="horizontal" className="h-full">
            {/* Media Library - Left Side */}
            <Panel defaultSize={20} minSize={15} maxSize={35}>
              <div className="h-full w-full">
                <MediaLibraryWidget />
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-zinc-800 hover:bg-blue-500 transition-colors" />

            {/* Preview Area - Center */}
            <Panel defaultSize={60} minSize={35}>
              <div className="h-full w-full flex flex-col bg-zinc-950 p-6">
                {/* Video Preview Canvas */}
                <div className="flex-1 flex items-center justify-center rounded-lg border border-zinc-800 overflow-hidden relative">
                  <PreviewCanvas />
                </div>

                {/* Playback Controls */}
                <div className="mt-4 flex items-center justify-center gap-4 flex-shrink-0">
                  <button
                    onClick={handleSkipBack}
                    className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                    title="Skip back 1 second"
                  >
                    <SkipBack className="w-5 h-5 text-zinc-300" />
                  </button>
                  <button
                    onClick={handleTogglePlayback}
                    className="p-4 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6 text-white" />
                    ) : (
                      <Play className="w-6 h-6 text-white" />
                    )}
                  </button>
                  <button
                    onClick={handleSkipForward}
                    className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                    title="Skip forward 1 second"
                  >
                    <SkipForward className="w-5 h-5 text-zinc-300" />
                  </button>
                </div>
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-zinc-800 hover:bg-blue-500 transition-colors" />

            {/* Media Details & Properties - Right Side */}
            <Panel defaultSize={20} minSize={15} maxSize={35}>
              <div className="h-full w-full bg-zinc-900 border-l border-zinc-800 overflow-hidden flex flex-col">
                {/* Media Details Panel - Shows all clips with expandable details */}
                <div className="flex-1 overflow-hidden">
                  <ClipsListPanel
                    clips={clips}
                    fps={fps}
                    selectedClipIds={selectedClipIds}
                    onClipSelect={timelineStore.selectClip}
                  />
                </div>

                {/* Clip Properties Panel - Shows editable properties for selected clip */}
                {selectedClip && (
                  <div className="border-t border-zinc-800 overflow-y-auto flex-shrink-0">
                    <ClipPropertiesPanel
                      clip={selectedClip}
                      fps={fps}
                      onUpdate={timelineStore.updateClip}
                    />
                  </div>
                )}
              </div>
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="h-1 bg-zinc-800 hover:bg-blue-500 transition-colors" />

        {/* Bottom Section: Timeline */}
        <Panel defaultSize={33} minSize={20} maxSize={60}>
          <div className="h-full w-full bg-zinc-900 border-t border-zinc-800 overflow-hidden">
            <Timeline
              tracks={tracks}
              clips={clips}
              selectedClipIds={selectedClipIds}
              playhead={playhead}
              zoom={zoom}
              duration={duration}
              fps={fps}
              onPlayheadChange={timelineStore.setPlayhead}
              onZoomChange={timelineStore.setZoom}
              onClipSelect={timelineStore.selectClip}
              onClipMove={timelineStore.moveClip}
              onClipTrim={timelineStore.updateClip}
              onSplitClip={timelineStore.splitClip}
              onDuplicateClips={(clipIds) => clipIds.forEach(id => timelineStore.duplicateClip(id))}
              onDeleteClips={(clipIds) => clipIds.forEach(id => timelineStore.removeClip(id))}
              onTrackUpdate={timelineStore.updateTrack}
              onAddTrack={handleAddTrack}
              onDeleteTrack={handleDeleteTrack}
              onAssetDrop={handleAssetDrop}
              onExport={handleExport}
            />
          </div>
        </Panel>
      </PanelGroup>
      </div>

      {/* Export Dialog */}
      <ExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        payload={exportPayload}
        onConfirm={handleConfirmExport}
      />

      {/* Export Progress Tracker */}
      <ExportProgress
        onDownload={handleExportDownload}
        onClose={handleExportClose}
      />
    </div>
  );
}
