import { Routes, Route } from 'react-router';
import { ROUTES } from '../types/routes';
import RootLayout from '../layouts/RootLayout';
import LandingPage from '../pages/LandingPage';
import ProjectsPage from '../pages/ProjectsPage';
import ProjectEditorPage from '../pages/ProjectEditorPage';
import MediaLibraryPage from '../pages/MediaLibraryPage';
import SettingsPage from '../pages/SettingsPage';
import NotFoundPage from '../pages/NotFoundPage';
import { AdGeneratorLayout } from '../layouts/AdGeneratorLayout';
import { PipelineSelection } from '../pages/ad-generator/PipelineSelection';
import { AdCreativeForm } from '../pages/ad-generator/AdCreativeForm';
import { History } from '../pages/ad-generator/History';
import { GenerationProgress } from '../pages/ad-generator/GenerationProgress';
import { VideoPreview } from '../pages/ad-generator/VideoPreview';
import { NotFound } from '../pages/ad-generator/NotFound';
import { PromptResults } from '../pages/ad-generator/PromptResults';

/**
 * Main application routes configuration with type-safe paths
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.HOME} element={<RootLayout />}>
        <Route index element={<LandingPage />} />
        <Route path={ROUTES.PROJECTS} element={<ProjectsPage />} />
        <Route path={ROUTES.PROJECT_EDITOR} element={<ProjectEditorPage />} />
        <Route path={ROUTES.MEDIA} element={<MediaLibraryPage />} />
        <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
        <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />

        {/* Ad Generator Routes */}
        <Route path={ROUTES.AD_GENERATOR} element={<AdGeneratorLayout />}>
          <Route index element={<PipelineSelection />} />
          <Route path="create/ad-creative" element={<AdCreativeForm />} />
          <Route path="history" element={<History />} />
          <Route path="generation/:id" element={<GenerationProgress />} />
          <Route path="preview/:id" element={<VideoPreview />} />
          <Route path="prompt-results" element={<PromptResults />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
