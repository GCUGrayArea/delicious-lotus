import { Outlet, NavLink } from 'react-router';
import { useEffect, useRef } from 'react';
import { ROUTES } from '../types/routes';
import {
  FolderOpen,
  Film,
  Image,
} from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAIGenerationStore, useMediaStore } from '../contexts/StoreContext';

/**
 * Root layout component with horizontal navigation topbar
 * Also handles persistent AI generation job polling (fallback for WebSocket)
 */
export default function RootLayout() {
  // Polling fallback for AI generation jobs (persistent across navigation)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeGenerationsMap = useAIGenerationStore((state) => state.activeGenerations);
  const updateGenerationStatus = useAIGenerationStore((state) => state.updateGenerationStatus);
  const moveToCompleting = useAIGenerationStore((state) => state.moveToCompleting);
  const clearCompletingGeneration = useAIGenerationStore((state) => state.clearCompletingGeneration);
  const loadAssets = useMediaStore((state) => state.loadAssets);

  // Configurable polling interval (default 5 seconds)
  const POLLING_INTERVAL_MS = import.meta.env.VITE_AI_POLLING_INTERVAL_MS
    ? Number(import.meta.env.VITE_AI_POLLING_INTERVAL_MS)
    : 5000;

  useEffect(() => {
    const pollJobStatus = async () => {
      // Poll ALL jobs that are generating or queued
      const activeJobs = Array.from(activeGenerationsMap.values()).filter(
        (gen) => (gen.status === 'generating' || gen.status === 'queued') && gen.jobId
      );

      if (activeJobs.length === 0) {
        // No active jobs, stop polling
        if (pollingIntervalRef.current) {
          console.log('[RootLayout] No active jobs, stopping polling');
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        return;
      }

      console.log(`[RootLayout] Polling ${activeJobs.length} active jobs:`,
        activeJobs.map(j => `${j.id} (jobId: ${j.jobId}, status: ${j.status})`).join(', '));

      for (const job of activeJobs) {
        if (!job.jobId) continue;

        try {
          const { getGenerationStatus } = await import('../services/aiGenerationService');
          const status = await getGenerationStatus(job.jobId);

          if (status.status === 'succeeded' && job.status !== 'completed') {
            console.log(`[RootLayout] Polling detected completion for job ${job.jobId}`);
            updateGenerationStatus(job.id, 'completed', {
              resultUrl: status.result_url,
              progress: 100,
            });

            // Move to completing state to keep skeleton visible
            moveToCompleting(job.id);

            // Refresh media library and clear completing generation
            setTimeout(async () => {
              console.log('[RootLayout] Refreshing media library after polling detected completion');
              try {
                await loadAssets();
                // Clear the completing generation after assets are loaded
                clearCompletingGeneration(job.id);
              } catch (error) {
                console.error('[RootLayout] Failed to refresh media library:', error);
                // Still clear the completing generation on error to prevent stuck skeletons
                clearCompletingGeneration(job.id);
              }
            }, 1500);
          } else if (status.status === 'failed') {
            console.log(`[RootLayout] Polling detected failure for job ${job.jobId}`);
            updateGenerationStatus(job.id, 'failed', {
              error: status.error || 'Generation failed',
            });
          } else if (status.progress !== undefined && status.progress !== job.progress) {
            // Update progress if it changed
            updateGenerationStatus(job.id, 'generating', {
              progress: status.progress,
            });
          }
        } catch (error) {
          console.error(`[RootLayout] Failed to poll job ${job.jobId}:`, error);
        }
      }
    };

    // Start polling if there are active jobs and not already polling
    const hasActiveJobs = Array.from(activeGenerationsMap.values()).some(
      (gen) => (gen.status === 'generating' || gen.status === 'queued') && gen.jobId
    );

    if (hasActiveJobs && !pollingIntervalRef.current) {
      console.log(`[RootLayout] Starting persistent polling with ${POLLING_INTERVAL_MS}ms interval`);
      pollingIntervalRef.current = setInterval(pollJobStatus, POLLING_INTERVAL_MS);
      pollJobStatus(); // Run immediately
    }

    // Cleanup on unmount only (RootLayout rarely unmounts)
    return () => {
      if (pollingIntervalRef.current) {
        console.log('[RootLayout] Cleaning up polling interval on unmount');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [activeGenerationsMap, updateGenerationStatus, loadAssets, POLLING_INTERVAL_MS]);

  return (
    <div className="flex min-h-screen bg-background text-foreground flex-col">
      {/* Topbar */}
      <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-6">
          {/* Home link with Film icon and text */}
          <NavLink
            to={ROUTES.HOME}
            className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
          >
            <Film className="w-6 h-6" />
            <span className="text-lg font-semibold">Video Editor</span>
          </NavLink>

          {/* Navigation links */}
          <nav className="flex items-center gap-1">
            <NavLink
              to={ROUTES.PROJECTS}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`
              }
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                <span>Projects</span>
              </div>
            </NavLink>

            <NavLink
              to={ROUTES.MEDIA}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`
              }
            >
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4" />
                <span>Media Library</span>
              </div>
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 w-screen overflow-y-auto bg-background">
        <Outlet />
      </main>
    </div>
  );
}
