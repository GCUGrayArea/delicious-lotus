import { useState, useMemo, useCallback } from 'react';
import { Search, Upload, Image, Video } from 'lucide-react';
import { useMediaStore } from '../../contexts/StoreContext';
import { MediaLibraryUpload } from './MediaLibraryUpload';
import type { MediaAsset, MediaAssetType } from '../../types/stores';
import { stripQueryParams } from '../../lib/urlUtils';

interface MediaLibraryWidgetProps {
  onAssetDragStart?: (asset: MediaAsset) => void;
}

/**
 * Media Library Widget for the video editor
 * Provides Library and Upload tabs with search and filters
 */
export function MediaLibraryWidget({ onAssetDragStart }: MediaLibraryWidgetProps) {
  const [activeTab, setActiveTab] = useState<'library' | 'upload'>('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<MediaAssetType | 'all'>('all');
  const [filterSource, setFilterSource] = useState<'all' | 'uploaded' | 'ai-generated'>('all');

  // Access MediaStore state and actions
  const assets = useMediaStore((state) => state.assets);
  const ensureMetadataExtracted = useMediaStore((state) => state.ensureMetadataExtracted);

  // Filter and search assets
  const filteredAssets = useMemo(() => {
    let arr = Array.from(assets.values());

    // Filter by type
    if (filterType !== 'all') {
      arr = arr.filter((asset) => asset.type === filterType);
    }

    // Filter by source (uploaded vs ai-generated)
    if (filterSource !== 'all') {
      arr = arr.filter((asset) => {
        const isAIGenerated = asset.metadata?.source === 'ai-generated' || asset.metadata?.aiGenerated;
        return filterSource === 'ai-generated' ? isAIGenerated : !isAIGenerated;
      });
    }

    // Apply search query
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      arr = arr.filter((asset) =>
        asset.name.toLowerCase().includes(lowerQuery)
      );
    }

    // Sort by creation date (newest first)
    arr.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return arr;
  }, [assets, filterType, filterSource, searchQuery]);

  // Handle drag start
  const handleDragStart = useCallback(
    (asset: MediaAsset, e: React.DragEvent) => {
      console.log('Drag started with asset:', asset);
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('application/json', JSON.stringify(asset));
      e.dataTransfer.setData('text/plain', asset.id);

      // Trigger on-demand metadata extraction for videos without duration
      if (asset.type === 'video' && !asset.duration) {
        console.log('[MediaLibrary] Triggering on-demand metadata extraction for:', asset.name);
        ensureMetadataExtracted(asset.id);
        // Don't await - let it complete in background during drag gesture
      }

      onAssetDragStart?.(asset);
    },
    [onAssetDragStart, ensureMetadataExtracted]
  );

  return (
    <div className="h-full w-full flex flex-col bg-zinc-900 border-r border-zinc-800">
      {/* Header with Tabs */}
      <div className="w-full border-b border-zinc-800">
        <div className="flex">
          <button
            onClick={() => setActiveTab('library')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'library'
                ? 'bg-zinc-800 text-zinc-100 border-b-2 border-blue-500'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            Library
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'upload'
                ? 'bg-zinc-800 text-zinc-100 border-b-2 border-blue-500'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            Upload
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'library' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search and Filters */}
          <div className="p-3 space-y-2 border-b border-zinc-800">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search media..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              {/* Type Filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as MediaAssetType | 'all')}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="image">Images</option>
                <option value="video">Videos</option>
              </select>

              {/* Source Filter */}
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value as 'all' | 'uploaded' | 'ai-generated')}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Sources</option>
                <option value="uploaded">Uploaded</option>
                <option value="ai-generated">AI Generated</option>
              </select>
            </div>
          </div>

          {/* Assets Grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {filteredAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-500">
                <Upload className="w-12 h-12 mb-2" />
                <p className="text-sm">No media found</p>
                <p className="text-xs mt-1">Upload or generate media to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {filteredAssets.map((asset) => (
                  <div
                    key={asset.id}
                    draggable
                    onDragStart={(e) => handleDragStart(asset, e)}
                    className="group relative aspect-square bg-zinc-950 rounded-lg overflow-hidden cursor-move border border-zinc-800 hover:border-blue-500 transition-colors"
                  >
                    {/* Thumbnail */}
                    {/* For images, use main URL if thumbnail not available. For videos, only show thumbnail. */}
                    {asset.thumbnailUrl || (asset.type === 'image' && asset.url) ? (
                      <img
                        src={stripQueryParams(asset.thumbnailUrl || asset.url)}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {asset.type === 'video' ? (
                          <Video className="w-8 h-8 text-zinc-600" />
                        ) : (
                          <Image className="w-8 h-8 text-zinc-600" />
                        )}
                      </div>
                    )}

                    {/* Overlay with info */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-xs text-white font-medium truncate" title={asset.name}>
                          {asset.name}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-zinc-300">
                            {asset.type === 'video' ? 'Video' : 'Image'}
                          </span>
                          {(asset.metadata?.aiGenerated || asset.metadata?.source === 'ai-generated') && (
                            <span className="text-xs text-purple-400">AI</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3">
          <MediaLibraryUpload />
        </div>
      )}
    </div>
  );
}
