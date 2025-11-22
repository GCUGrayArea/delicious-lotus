/**
 * Route parameter types for type-safe routing
 */
export interface ProjectEditorParams {
  projectId: string;
}

/**
 * Route path constants to prevent hardcoded strings
 */
export const ROUTES = {
  HOME: '/',
  PROJECTS: '/projects',
  PROJECT_EDITOR: '/projects/:projectId/editor',
  MEDIA: '/media',
  AD_GENERATOR: '/ad-generator',
  AD_GENERATOR_PROMPT_RESULTS: '/ad-generator/prompt-results',
  SETTINGS: '/settings',
} as const;

/**
 * Type for all valid route paths
 */
export type RoutePath = typeof ROUTES[keyof typeof ROUTES];

/**
 * Helper to generate project editor route
 */
export const generateProjectEditorRoute = (projectId: string): string => {
  return `/projects/${projectId}/editor`;
};
