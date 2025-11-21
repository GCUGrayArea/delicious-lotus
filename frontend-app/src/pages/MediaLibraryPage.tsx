import { Upload, Search, Sparkles, Trash2, X } from 'lucide-react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import AIGenerationPanel from '../components/ai-generation/AIGenerationPanel';
import { MediaLibraryUpload } from '../components/media/MediaLibraryUpload';
import { UploadProgressList } from '../components/media/UploadProgressList';
import { MediaAssetCard } from '../components/media/MediaAssetCard';
import { MediaPreviewModal } from '../components/media/MediaPreviewModal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '../components/ui/resizable';
import { Tabs, TabsContent } from '../components/ui/tabs';
import { useMediaStore, useAIGenerationStore } from '../contexts/StoreContext';
import { MediaGenerationSkeleton } from '../components/media/MediaGenerationSkeleton';
import type { MediaAssetType, MediaAsset } from '../types/stores';

/**
 * Media library page for asset management interface
 */
export default function MediaLibraryPage() {
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'ai'>('upload');

  const [lastSelectedIndex, setLastSelectedIndex] = useState<number>(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<MediaAssetType | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [filterSource, setFilterSource] = useState<'all' | 'upload' | 'ai'>('all');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Access MediaStore state and actions
  const assets = useMediaStore((state) => state.assets);
  const selectedAssetIds = useMediaStore((state) => state.selectedAssetIds);

  const queueUpload = useMediaStore((state) => state.queueUpload);
  const selectAsset = useMediaStore((state) => state.selectAsset);
  const clearAssetSelection = useMediaStore((state) => state.clearAssetSelection);
  const deleteAsset = useMediaStore((state) => state.deleteAsset);
  const loadAssets = useMediaStore((state) => state.loadAssets);
  const updateAsset = useMediaStore((state) => state.updateAsset);

  // Get active and completing generations for skeletons
  const activeGenerationsMap = useAIGenerationStore((state) => state.activeGenerations);
  const completingGenerationsMap = useAIGenerationStore((state) => state.completingGenerations);

  // Combine active and completing generations for skeleton display
  const visibleGenerations = useMemo(() => {
    const active = Array.from(activeGenerationsMap.values())
      .filter(g => g.status === 'queued' || g.status === 'generating');
    const completing = Array.from(completingGenerationsMap.values());

    return [...active, ...completing]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [activeGenerationsMap, completingGenerationsMap]);

  // Convert assets Map to array and apply filters
  const assetsArray = useMemo(() => {
    let arr = Array.from(assets.values());

    // Filter by type
    if (filterType !== 'all') {
      arr = arr.filter((asset) => asset.type === filterType);
    }

    // Filter by source
    if (filterSource !== 'all') {
      arr = arr.filter((asset) => {
        const isAI =
          !!asset.metadata?.prompt ||
          asset.metadata?.source === 'ai_generation' ||
          asset.tags?.includes('ai-generated');
        return filterSource === 'ai' ? isAI : !isAI;
      });
    }

    // Apply search query
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      arr = arr.filter(
        (asset) =>
          asset.name.toLowerCase().includes(lowerQuery) ||
          JSON.stringify(asset.metadata).toLowerCase().includes(lowerQuery)
      );
    }

    // Sort by date
    arr.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return arr;
  }, [assets, filterType, filterSource, searchQuery, sortOrder]);

  // Handle file selection from file input
  const handleFilesSelected = useCallback((files: File[]) => {
    files.forEach((file) => {
      queueUpload(file);
    });
  }, [queueUpload]);

  // Trigger file picker programmatically - kept for future drag/drop implementation
  const _triggerUpload = useCallback(() => {
    uploadInputRef.current?.click();
  }, []);

  // Handle asset click with multi-select support
  const handleAssetClick = useCallback(
    (assetId: string, index: number, event: React.MouseEvent) => {
      if (event.shiftKey && lastSelectedIndex !== -1) {
        // Shift-click: range selection
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        const selectedRange = assetsArray.slice(start, end + 1);

        // Clear current selection and select range
        clearAssetSelection();
        selectedRange.forEach((asset) => selectAsset(asset.id, true));
      } else if (event.ctrlKey || event.metaKey) {
        // Ctrl/Cmd-click: toggle individual selection
        selectAsset(assetId, true);
        setLastSelectedIndex(index);
      } else {
        // Regular click: single selection
        selectAsset(assetId, false);
        setLastSelectedIndex(index);
      }
    },
    [assetsArray, lastSelectedIndex, selectAsset, clearAssetSelection]
  );

  // Handle asset deletion
  const handleDeleteAssets = useCallback(async () => {
    if (selectedAssetIds.length === 0) {
      setShowDeleteDialog(false);
      return;
    }

    // Delete all selected assets
    const deletePromises = selectedAssetIds.map((assetId) => deleteAsset(assetId));

    try {
      await Promise.all(deletePromises);
      clearAssetSelection();
      setShowDeleteDialog(false);
      console.log(`Successfully deleted ${selectedAssetIds.length} asset(s)`);
    } catch (error) {
      console.error('Failed to delete some assets:', error);
      // Keep dialog open on error so user can retry
    }
  }, [selectedAssetIds, deleteAsset, clearAssetSelection]);

  // Handle individual asset delete
  const handleDeleteSingleAsset = useCallback(
    async (assetId: string) => {
      try {
        await deleteAsset(assetId);
        console.log('Successfully deleted asset');
      } catch (error) {
        console.error('Failed to delete asset:', error);
      }
    },
    [deleteAsset]
  );

  // Handle asset preview
  const handleAssetPreview = useCallback(
    (asset: MediaAsset) => {
      setPreviewAsset(asset);
    },
    []
  );

  // Load assets from backend on mount
  useEffect(() => {
    console.log('[MediaLibraryPage] Loading assets from backend');
    loadAssets()
      .then(() => console.log('[MediaLibraryPage] Assets loaded successfully'))
      .catch((error) => console.error('[MediaLibraryPage] Failed to load assets:', error));
  }, [loadAssets]);

  // Keyboard shortcut for select all (Ctrl/Cmd+A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        clearAssetSelection();
        assetsArray.forEach((asset) => selectAsset(asset.id, true));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [assetsArray, selectAsset, clearAssetSelection]);

  const openSidePanel = (tab: 'upload' | 'ai') => {
    setActiveTab(tab);
    setIsSidePanelOpen(true);
  };

  return (
    <div className="h-full flex flex-col">
      <ResizablePanelGroup direction="horizontal" className="flex-1 h-full">
        {/* Main Content Area (Media Library) */}
        <ResizablePanel defaultSize={isSidePanelOpen ? 65 : 100} minSize={30}>
          <div className="h-full flex flex-col p-8 overflow-auto bg-zinc-950">
            <div className="max-w-7xl mx-auto w-full">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-zinc-100">Media Library</h1>
                  <p className="text-zinc-400 mt-2">
                    {assetsArray.length} {assetsArray.length === 1 ? 'asset' : 'assets'}
                    {selectedAssetIds.length > 0 && (
                      <span className="ml-2 text-blue-400">
                        • {selectedAssetIds.length} selected
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  {selectedAssetIds.length > 0 && (
                    <button
                      onClick={() => setShowDeleteDialog(true)}
                      className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                      Delete ({selectedAssetIds.length})
                    </button>
                  )}
                  <button
                    onClick={() => openSidePanel('ai')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isSidePanelOpen && activeTab === 'ai'
                      ? 'bg-purple-500 hover:bg-purple-600 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                      }`}
                  >
                    <Sparkles className="w-5 h-5" />
                    AI Generate
                  </button>
                  <button
                    onClick={() => openSidePanel('upload')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isSidePanelOpen && activeTab === 'upload'
                      ? 'bg-blue-500 hover:bg-blue-600 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                      }`}
                  >
                    <Upload className="w-5 h-5" />
                    Upload Media
                  </button>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="mb-6 flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search media..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as MediaAssetType | 'all')}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="image">Images</option>
                  <option value="video">Videos</option>
                  <option value="audio">Audio</option>
                </select>

                {/* Source Filter */}
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value as 'all' | 'upload' | 'ai')}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Sources</option>
                  <option value="upload">User Uploads</option>
                  <option value="ai">AI Generated</option>
                </select>

                {/* Sort Order */}
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>

              {/* Media Grid */}
              {assetsArray.length === 0 ? (
                /* Empty State */
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="bg-zinc-900 border-2 border-dashed border-zinc-800 rounded-lg p-12 max-w-md">
                    <Upload className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-zinc-300 mb-2">No media yet</h3>
                    <p className="text-zinc-500 mb-6">
                      Upload images, videos, or audio files, or generate content with AI
                    </p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => openSidePanel('upload')}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
                      >
                        Upload Media
                      </button>
                      <button
                        onClick={() => openSidePanel('ai')}
                        className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        Generate with AI
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Asset Grid */
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {/* Visible Generations Skeletons (active + completing) */}
                  {visibleGenerations.map((gen) => (
                    <MediaGenerationSkeleton key={gen.id} />
                  ))}

                  {/* Media Assets */}
                  {assetsArray.map((asset, index) => (
                    <MediaAssetCard
                      key={asset.id}
                      asset={asset}
                      isSelected={selectedAssetIds.includes(asset.id)}
                      onClick={(e) => handleAssetClick(asset.id, index, e)}
                      onDelete={() => handleDeleteSingleAsset(asset.id)}
                      onPreview={() => handleAssetPreview(asset)}
                    />
                  ))}
                </div>
              )}

              {/* Hidden file input for quick upload */}
              <input
                ref={uploadInputRef}
                type="file"
                className="hidden"
                accept="image/*,video/*,audio/*"
                multiple
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  if (files.length > 0) {
                    handleFilesSelected(files);
                  }
                  // Reset input value to allow selecting the same file again
                  if (uploadInputRef.current) {
                    uploadInputRef.current.value = '';
                  }
                }}
              />
            </div>
          </div>
        </ResizablePanel>

        {/* Side Panel (Upload / AI) */}
        {isSidePanelOpen && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={35} minSize={30} maxSize={60} className="bg-zinc-950 border-l border-zinc-800">
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'ai')} className="w-full">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setActiveTab('upload')}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${activeTab === 'upload'
                            ? 'bg-blue-500 hover:bg-blue-600 text-white'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                            }`}
                        >
                          <Upload className="w-4 h-4" />
                          Upload Media
                        </button>
                        <button
                          onClick={() => setActiveTab('ai')}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${activeTab === 'ai'
                            ? 'bg-purple-500 hover:bg-purple-600 text-white'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                            }`}
                        >
                          <Sparkles className="w-4 h-4" />
                          AI Generate
                        </button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsSidePanelOpen(false)}
                        className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    </div>

                    <div className="mt-4 h-[calc(100vh-140px)] overflow-y-auto">
                      <TabsContent value="upload" className="m-0 h-full">
                        <div className="p-1">
                          <MediaLibraryUpload />
                        </div>
                      </TabsContent>
                      <TabsContent value="ai" className="m-0 h-full">
                        <div className="p-1">
                          <AIGenerationPanel />
                        </div>
                      </TabsContent>
                    </div>
                  </Tabs>
                </div>
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      {/* Upload Progress List */}
      <UploadProgressList />

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Assets</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedAssetIds.length}{' '}
              {selectedAssetIds.length === 1 ? 'asset' : 'assets'}? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAssets}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media Preview Modal */}
      <MediaPreviewModal
        asset={previewAsset}
        isOpen={!!previewAsset}
        onClose={() => setPreviewAsset(null)}
        onUpdate={(updatedAsset) => {
          updateAsset(updatedAsset.id, updatedAsset);
          setPreviewAsset(updatedAsset);
        }}
      />
    </div>
  );
}
