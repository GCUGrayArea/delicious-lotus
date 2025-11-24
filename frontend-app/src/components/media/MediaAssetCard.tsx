import { memo, useCallback, useState, type KeyboardEvent } from 'react';
import { Image, Video, Music, Trash2, Download, CheckSquare, Square, Copy, Check } from 'lucide-react';
import { Card } from '../ui/card';
import type { MediaAsset } from '../../types/stores';
import { formatRelativeTime } from '../../lib/relativeTime';
import { stripQueryParams } from '../../lib/urlUtils';

interface MediaAssetCardProps {
  asset: MediaAsset;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDelete?: () => void;
  onPreview?: () => void;
}

/**
 * MediaAssetCard component for displaying media asset thumbnail and metadata
 */
export const MediaAssetCard = memo(
  ({ asset, isSelected, onClick, onDelete, onPreview }: MediaAssetCardProps) => {
    const [isCopied, setIsCopied] = useState(false);

    // Format file size
    const formatSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    };

    // Get type icon and badge
    const getTypeDisplay = () => {
      switch (asset.type) {
        case 'image':
          return {
            icon: <Image className="w-12 h-12 text-zinc-600" />,
            badge: 'Image',
            badgeColor: 'bg-blue-500/20 text-blue-400',
          };
        case 'video':
          return {
            icon: <Video className="w-12 h-12 text-zinc-600" />,
            badge: 'Video',
            badgeColor: 'bg-purple-500/20 text-purple-400',
          };
        case 'audio':
          return {
            icon: <Music className="w-12 h-12 text-zinc-600" />,
            badge: 'Audio',
            badgeColor: 'bg-green-500/20 text-green-400',
          };
        default:
          return {
            icon: <Image className="w-12 h-12 text-zinc-600" />,
            badge: 'Unknown',
            badgeColor: 'bg-zinc-500/20 text-zinc-400',
          };
      }
    };

    const typeDisplay = getTypeDisplay();

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onClick(e as unknown as React.MouseEvent);
        }
      },
      [onClick]
    );

    const handleDelete = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete?.();
      },
      [onDelete]
    );

    const handleDoubleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onPreview?.();
      },
      [onPreview]
    );

    const handleCopy = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        const cleanUrl = asset.url.split('?')[0];
        navigator.clipboard.writeText(cleanUrl);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      },
      [asset.url]
    );

    const hasDimensions = asset.width && asset.height && asset.width > 0 && asset.height > 0;
    const aspectRatio = hasDimensions
      ? `${asset.width}/${asset.height}`
      : '1/1';

    return (
      <Card
        className={`
          group relative overflow-hidden cursor-pointer transition-all duration-200
          bg-zinc-900 border-zinc-800
          hover:border-zinc-700 hover:shadow-lg hover:scale-105
          ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : ''}
        `}
        onClick={onClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-pressed={isSelected}
      >
        {/* Thumbnail */}
        <div
          className="bg-zinc-950 flex items-center justify-center relative overflow-hidden"
          style={{ aspectRatio, width: '100%' }}
        >
          {/* For images, use main URL if thumbnail not available. For videos, only show thumbnail. */}
          {asset.thumbnailUrl || (asset.type === 'image' && asset.url) ? (
            <img
              src={stripQueryParams(asset.thumbnailUrl || asset.url)}
              alt={asset.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              {typeDisplay.icon}
            </div>
          )}

          {/* Hover Overlay with Actions */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
            <button
              onClick={handleDelete}
              className="p-2 bg-red-500/80 hover:bg-red-500 rounded-lg text-white transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleCopy}
              className="p-2 bg-zinc-500/80 hover:bg-zinc-500 rounded-lg text-white transition-colors"
              title="Copy Clean URL"
            >
              {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
            <a
              href={stripQueryParams(asset.url)}
              download={asset.name}
              onClick={(e) => e.stopPropagation()}
              className="p-2 bg-blue-500/80 hover:bg-blue-500 rounded-lg text-white transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>

          {/* Selection Checkbox */}
          <div className="absolute top-2 left-2">
            {isSelected ? (
              <CheckSquare className="w-5 h-5 text-blue-500" />
            ) : (
              <Square className="w-5 h-5 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-medium text-zinc-200 truncate flex-1" title={asset.name}>
              {asset.name}
            </h3>
            <span
              className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${typeDisplay.badgeColor}`}
            >
              {typeDisplay.badge}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>{formatSize(asset.size)}</span>
            <span>{formatRelativeTime(asset.createdAt)}</span>
          </div>

          {/* Duration for video/audio */}
          {asset.duration && (
            <div className="mt-1 text-xs text-zinc-500">
              Duration: {Math.floor(asset.duration / 60)}:
              {String(Math.floor(asset.duration % 60)).padStart(2, '0')}
            </div>
          )}

          {/* Dimensions for images/videos */}
          {asset.width && asset.height && (
            <div className="mt-1 text-xs text-zinc-500">
              {asset.width} × {asset.height}
            </div>
          )}
        </div>
      </Card>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for optimization
    return (
      prevProps.asset.id === nextProps.asset.id &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.asset.name === nextProps.asset.name &&
      prevProps.asset.thumbnailUrl === nextProps.asset.thumbnailUrl &&
      prevProps.asset.width === nextProps.asset.width &&
      prevProps.asset.height === nextProps.asset.height
    );
  }
);

MediaAssetCard.displayName = 'MediaAssetCard';
