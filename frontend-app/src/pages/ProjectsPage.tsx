import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useProjectStore } from '../contexts/StoreContext';
import { ProjectCard } from '../components/ProjectCard';
import { NewProjectDialog, type ProjectFormData } from '../components/NewProjectDialog';
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

/**
 * Projects page with project list and management
 */
export default function ProjectsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [_isLoading, _setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);

  // Get projects and actions from store
  const getProjects = useProjectStore((state) => state.getProjects);
  const addProject = useProjectStore((state) => state.addProject);
  const removeProject = useProjectStore((state) => state.removeProject);
  const _getCurrentProject = useProjectStore((state) => state.getCurrentProject);
  const currentProjectId = useProjectStore((state) => state.currentProjectId);
  const projects = useMemo(() => getProjects(), [getProjects]);

  // Filter projects based on search term
  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) {
      return projects;
    }

    const search = searchTerm.toLowerCase();
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(search) ||
        project.description?.toLowerCase().includes(search)
    );
  }, [projects, searchTerm]);

  // Navigation handler
  const handleOpenProject = useCallback((projectId: string) => {
    navigate(`/projects/${projectId}/editor`);
  }, [navigate]);

  // Delete handler - shows confirmation dialog
  const handleDeleteProject = useCallback((projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      setProjectToDelete({ id: project.id, name: project.name });
      setDeleteConfirmOpen(true);
    }
  }, [projects]);

  // Confirmed delete handler
  const handleConfirmDelete = useCallback(() => {
    if (!projectToDelete) return;

    try {
      // Check if trying to delete the currently open project
      if (currentProjectId === projectToDelete.id) {
        console.warn('Cannot delete currently open project');
        // TODO: Show warning toast
        return;
      }

      // Remove project from store
      removeProject(projectToDelete.id);
      console.log('Project deleted successfully:', projectToDelete.name);
      // TODO: Show success toast
    } catch (error) {
      console.error('Failed to delete project:', error);
      // TODO: Show error toast
    } finally {
      setProjectToDelete(null);
    }
  }, [projectToDelete, currentProjectId, removeProject]);

  const handleCreateProject = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  const handleProjectCreated = useCallback((data: ProjectFormData) => {
    try {
      // Create project in store
      const projectId = addProject(
        {
          name: data.name,
          description: data.description,
        },
        {
          fps: data.fps,
          resolution: data.resolution,
          aspectRatio: data.aspectRatio,
        }
      );

      // Close dialog
      setIsDialogOpen(false);

      console.log('Project created successfully:', projectId);
      // TODO: Show success toast notification

      // Navigate to editor
      navigate(`/projects/${projectId}/editor`);
    } catch (error) {
      console.error('Failed to create project:', error);
      // TODO: Show error toast notification
    }
  }, [addProject, navigate]);

  return (
    <>
      <NewProjectDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onCreateProject={handleProjectCreated}
      />

      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={handleConfirmDelete}
        projectName={projectToDelete?.name || ''}
      />

      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">Projects</h1>
            <p className="text-zinc-400 mt-2">Manage your video editing projects</p>
          </div>
          <Button onClick={handleCreateProject} className="gap-2">
            <Plus className="w-5 h-5" />
            New Project
          </Button>
        </div>

        {/* Search Bar */}
        {projects.length > 0 && (
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                type="text"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        )}

        {/* Project List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-zinc-400">Loading projects...</p>
          </div>
        ) : filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={handleOpenProject}
                onDelete={handleDeleteProject}
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          /* Empty State - No projects */
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-zinc-900 border-2 border-dashed border-zinc-800 rounded-lg p-12 max-w-md">
              <Plus className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-zinc-300 mb-2">No projects yet</h3>
              <p className="text-zinc-500 mb-6">
                Create your first project to start editing videos
              </p>
              <Button onClick={handleCreateProject}>Create Project</Button>
            </div>
          </div>
        ) : (
          /* No search results */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-zinc-400 mb-2">No projects found matching "{searchTerm}"</p>
            <p className="text-zinc-500 text-sm">Try a different search term</p>
          </div>
        )}
        </div>
      </div>
    </>
  );
}
