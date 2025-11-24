import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { X, Play, Film, ArrowRight } from 'lucide-react';
import type { MediaAsset } from '@/types/stores';
import { cn } from '@/lib/utils';
import { stripQueryParams } from '@/lib/urlUtils';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DropAnimation,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface TimelineItem {
    id: string; // Unique instance ID
    asset: MediaAsset;
}

interface SimpleTimelineProps {
    clips: TimelineItem[];
    onDrop: (asset: MediaAsset) => void;
    onReorder: (items: TimelineItem[]) => void;
    onRemove: (id: string) => void;
    onExport: () => void;
    onAdvancedEdit: () => void;
    isExporting?: boolean;
}

const dropAnimationConfig: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
        styles: {
            active: {
                opacity: '0.5',
            },
        },
    }),
};

function SortableClip({ item, onRemove, onPlay, isPlaying }: { item: TimelineItem; onRemove: (id: string) => void; onPlay: (id: string | null) => void; isPlaying: boolean }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const aspectRatio = item.asset.width && item.asset.height
        ? `${item.asset.width}/${item.asset.height}`
        : '16/9';

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        aspectRatio,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="relative group flex-shrink-0 h-full rounded-md overflow-hidden border border-border bg-background shadow-sm hover:ring-2 ring-primary/50 transition-all cursor-grab active:cursor-grabbing"
            onMouseEnter={() => item.asset.type === 'video' && onPlay(item.id)}
            onMouseLeave={() => onPlay(null)}
        >
            {/* Remove Button */}
            <button
                onClick={(e) => {
                    e.stopPropagation(); // Prevent drag start
                    onRemove(item.id);
                }}
                className="absolute top-1 right-1 z-20 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive cursor-pointer"
                onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
            >
                <X className="h-3 w-3" />
            </button>

            {/* Content */}
            {isPlaying && item.asset.type === 'video' ? (
                <video
                    src={stripQueryParams(item.asset.url)}
                    className="w-full h-full object-cover pointer-events-none"
                    autoPlay
                    muted
                    loop
                />
            ) : (
                <img
                    src={stripQueryParams(item.asset.thumbnailUrl || item.asset.url)}
                    alt="Clip thumbnail"
                    className="w-full h-full object-cover pointer-events-none"
                />
            )}
            
            {!isPlaying && item.asset.type === 'video' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent transition-colors pointer-events-none">
                     <Play className="h-6 w-6 text-white/80" fill="currentColor" />
                </div>
            )}
        </div>
    );
}

export const SimpleTimeline: React.FC<SimpleTimelineProps> = ({
    clips,
    onDrop,
    onReorder,
    onRemove,
    onExport,
    onAdvancedEdit,
    isExporting = false,
}) => {
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [playingClipId, setPlayingClipId] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Require movement before drag starts to allow clicks
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingOver(true);
    };

    const handleDragLeave = () => {
        setIsDraggingOver(false);
    };

    const handleNativeDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingOver(false);

        try {
            const assetData = e.dataTransfer.getData('application/json');
            if (assetData) {
                const asset = JSON.parse(assetData) as MediaAsset;
                onDrop(asset);
            }
        } catch (error) {
            console.error('Failed to parse dropped asset:', error);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            const oldIndex = clips.findIndex((c) => c.id === active.id);
            const newIndex = clips.findIndex((c) => c.id === over.id);
            
            if (oldIndex !== -1 && newIndex !== -1) {
                onReorder(arrayMove(clips, oldIndex, newIndex));
            }
        }
    };

    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
    };

    const activeItem = activeId ? clips.find(c => c.id === activeId) : null;

    return (
        <div className="h-full flex flex-col bg-background border-t border-border">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/10">
                <div className="flex items-center gap-2">
                    <Film className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Timeline</h3>
                    <span className="text-xs text-muted-foreground ml-2">
                        Drag and drop clips here to arrange
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        onClick={onExport}
                        disabled={clips.length === 0 || isExporting}
                        className="gap-2"
                    >
                        {isExporting ? (
                            <>
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Exporting...
                            </>
                        ) : (
                            'Quick Export'
                        )}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onAdvancedEdit}
                        className="gap-2"
                    >
                        Advanced Editor
                        <ArrowRight className="h-3 w-3" />
                    </Button>
                </div>
            </div>

            {/* Timeline Area */}
            <div
                className={cn(
                    "flex-1 relative transition-colors duration-200 min-h-0",
                    isDraggingOver ? "bg-primary/5" : "bg-muted/5"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleNativeDrop}
            >
                {clips.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground pointer-events-none">
                        <Film className="h-8 w-8 mb-2 opacity-20" />
                        <p className="text-sm">Drag clips from Session Results here</p>
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <ScrollArea className="h-full w-full whitespace-nowrap p-4">
                            <div className="flex gap-4 h-full items-center px-4 py-4 min-w-max">
                                <SortableContext 
                                    items={clips.map(c => c.id)} 
                                    strategy={horizontalListSortingStrategy}
                                >
                                    {clips.map((item) => (
                                        <SortableClip 
                                            key={item.id} 
                                            item={item} 
                                            onRemove={onRemove}
                                            onPlay={setPlayingClipId}
                                            isPlaying={playingClipId === item.id}
                                        />
                                    ))}
                                </SortableContext>
                            </div>
                            <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                        
                        <DragOverlay dropAnimation={dropAnimationConfig}>
                            {activeItem ? (
                                <div 
                                    className="h-full rounded-md overflow-hidden border border-border bg-background shadow-lg opacity-80"
                                    style={{ 
                                        aspectRatio: activeItem.asset.width && activeItem.asset.height 
                                            ? `${activeItem.asset.width}/${activeItem.asset.height}` 
                                            : '16/9' 
                                    }}
                                >
                                     <img
                                        src={stripQueryParams(activeItem.asset.thumbnailUrl || activeItem.asset.url)}
                                        alt="Dragging"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                )}
            </div>
        </div>
    );
};
