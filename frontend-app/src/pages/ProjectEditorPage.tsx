import { useParams } from 'react-router';
import { useEffect, useCallback, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
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
  const { projectId: _projectId } = useParams();
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

    // Add sample media assets for testing if none exist
    if (mediaStore.assets.size === 0) {
      const sampleAssets: MediaAsset[] = [
        {
          id: 'sample-video-1',
          name: 'Sample Video.mp4',
          type: 'video',
          url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
          thumbnailUrl: 'https://via.placeholder.com/150/0000FF/FFFFFF?text=Video',
          size: 1048576,
          duration: 10,
          width: 1280,
          height: 720,
          createdAt: new Date(),
          metadata: {},
          tags: [],
        },
        {
          id: 'sample-image-1',
          name: 'Sample Image.jpg',
          type: 'image',
          url: 'https://via.placeholder.com/1920x1080/FF0000/FFFFFF?text=Sample+Image',
          thumbnailUrl: 'https://via.placeholder.com/150/FF0000/FFFFFF?text=Image',
          size: 524288,
          width: 1920,
          height: 1080,
          createdAt: new Date(),
          metadata: {},
          tags: [],
        },
        {
          id: 'sample-image-2',
          name: 'AI Generated.jpg',
          type: 'image',
          url: 'https://via.placeholder.com/1920x1080/00FF00/FFFFFF?text=AI+Generated',
          thumbnailUrl: 'https://via.placeholder.com/150/00FF00/FFFFFF?text=AI',
          size: 524288,
          width: 1920,
          height: 1080,
          createdAt: new Date(),
          metadata: { aiGenerated: true },
          tags: [],
        },
      ];

      sampleAssets.forEach(asset => mediaStore.addAsset(asset));
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

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950">
      {/* Main Editor Area - Top Section */}
      <div className="flex-1 w-full flex overflow-hidden">
        {/* Media Library Widget - Left Side */}
        <div className="w-80 flex-shrink-0">
          <MediaLibraryWidget />
        </div>

        {/* Preview Area and Properties - Right Side */}
        <div className="flex-1 flex overflow-hidden">
          {/* Preview Area */}
          <div className="flex-1 flex flex-col bg-zinc-950 p-6">
            {/* Video Preview Canvas */}
            <div className="flex-1 flex items-center justify-center rounded-lg border border-zinc-800 overflow-hidden">
              <PreviewCanvas />
            </div>

            {/* Playback Controls */}
            <div className="mt-4 flex items-center justify-center gap-4">
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

          {/* Right Panel - Media Details & Properties */}
          <div className="w-80 bg-zinc-900 border-l border-zinc-800 overflow-hidden flex flex-col">
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
              <div className="border-t border-zinc-800 overflow-hidden">
                <ClipPropertiesPanel
                  clip={selectedClip}
                  fps={fps}
                  onUpdate={timelineStore.updateClip}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline Area - Bottom Section (Full Width) */}
      <div className="h-64 w-full bg-zinc-900 border-t border-zinc-800">
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
