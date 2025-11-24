import { memo } from 'react';
import { Trash2, Play, Hash, Tag, Sparkles, Film } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from './ui/card';
import { Button } from './ui/button';
import type { ProjectMetadata } from '../types/stores';

interface ProjectCardProps {
  project: ProjectMetadata;
  onOpen: (projectId: string) => void;
  onDelete: (projectId: string) => void;
}

const ProjectCard = memo(({ project, onOpen, onDelete }: ProjectCardProps) => {
  const navigate = useNavigate();

  const formatDate = (date: Date) => {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return 'Unknown date';
    }
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const formatProjectType = (type: string) => {
    // Format the project type for display
    return type
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getProjectTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'ad-creative':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'music-video':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'educational-video':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'custom':
      default:
        return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent card click if clicking on buttons
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    onOpen(project.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(project.id);
  };

  const handleOpenClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpen(project.id);
  };

  const handleAdModeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/ad-generator/create/ad-creative?projectId=${project.id}`);
  };

  const handleAdvancedEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/projects/${project.id}/editor`);
  };

  return (
    <Card
      className="group cursor-pointer overflow-hidden border-zinc-800 bg-zinc-900 transition-all hover:border-zinc-700 hover:shadow-lg hover:shadow-blue-500/10"
      onClick={handleCardClick}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-zinc-800">
        {project.thumbnailUrl ? (
          <img
            src={project.thumbnailUrl}
            alt={project.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Play className="h-12 w-12 text-zinc-600" />
          </div>
        )}

        {/* Project type badge in top left corner */}
        <div className="absolute top-2 left-2 z-10">
          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border backdrop-blur-sm ${getProjectTypeBadgeColor(project.type)}`}>
            <Tag className="w-3 h-3" />
            {formatProjectType(project.type)}
          </span>
        </div>

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center gap-2">
          {project.type === 'ad-creative' ? (
            <>
              <Button
                size="sm"
                onClick={handleAdModeClick}
                className="gap-1 bg-purple-600 hover:bg-purple-700"
              >
                <Sparkles className="h-4 w-4" />
                Ad Mode
              </Button>
              <Button
                size="sm"
                onClick={handleAdvancedEditClick}
                className="gap-1"
              >
                <Film className="h-4 w-4" />
                Timeline
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDelete}
                className="gap-1"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={handleOpenClick}
                className="gap-1"
              >
                <Play className="h-4 w-4" />
                Open
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDelete}
                className="gap-1"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="mb-2 truncate text-lg font-semibold text-zinc-100">
          {project.name}
        </h3>

        {/* Project Type and ID Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border ${getProjectTypeBadgeColor(project.type)}`}>
            <Tag className="w-3 h-3" />
            {formatProjectType(project.type)}
          </span>
          <span
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono rounded-md border bg-zinc-800/50 text-zinc-500 border-zinc-700 cursor-default"
            title={`Project ID: ${project.id}`}
          >
            <Hash className="w-3 h-3" />
            {project.id.slice(0, 8)}
          </span>
        </div>

        {project.description && (
          <p className="mb-3 line-clamp-2 text-sm text-zinc-400">
            {project.description}
          </p>
        )}

        {/* Action buttons for Ad Creative projects */}
        {project.type === 'ad-creative' && (
          <div className="flex gap-2 mb-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleAdModeClick}
              className="flex-1 gap-1 h-8 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30"
            >
              <Sparkles className="h-3 w-3" />
              Ad Mode
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleAdvancedEditClick}
              className="flex-1 gap-1 h-8 text-xs"
            >
              <Film className="h-3 w-3" />
              Timeline Editor
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Modified {formatDate(project.updatedAt)}</span>
          {/* Duration placeholder - would need to be stored in metadata */}
          {/* <span>{formatDuration(0)}</span> */}
        </div>
      </div>
    </Card>
  );
});

ProjectCard.displayName = 'ProjectCard';

export { ProjectCard };
