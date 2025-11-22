// Store Type Definitions for Zustand State Management

// ============================================================================
// Timeline Store Types
// ============================================================================

export type TrackType = 'video' | 'audio' | 'text'

export interface Clip {
  id: string
  trackId: string
  assetId: string
  startTime: number // frame number on timeline
  duration: number // in frames
  inPoint: number // trim start point in source media (frames)
  outPoint: number // trim end point in source media (frames)
  layer: number
  // Transform properties
  opacity: number // 0-1
  scale: { x: number; y: number }
  position: { x: number; y: number }
  rotation: number // degrees
  // Transitions
  transitionIn?: Transition
  transitionOut?: Transition
}

export interface Transition {
  type: 'fade' | 'crossDissolve' | 'wipeLeft' | 'wipeRight' | 'wipeUp' | 'wipeDown'
  duration: number // in frames
}

export interface Track {
  id: string
  type: TrackType
  name: string
  height: number // in pixels
  locked: boolean
  hidden: boolean
  muted: boolean // for audio tracks
  color?: string // track color coding
  order: number // track stacking order
}

export interface TimelineState {
  clips: Map<string, Clip>
  tracks: Track[]
  playhead: number // current frame position
  zoom: number // 0.25x - 8x range
  selectedClipIds: string[]
  duration: number // total timeline duration in frames
  fps: number // frames per second (default 30)
}

export interface TimelineActions {
  // Clip operations
  addClip: (clip: Clip) => void
  removeClip: (clipId: string) => void
  updateClip: (clipId: string, updates: Partial<Clip>) => void
  moveClip: (clipId: string, trackId: string, startTime: number) => void
  duplicateClip: (clipId: string) => void
  splitClip: (clipId: string, frame: number) => void

  // Track operations
  addTrack: (track: Omit<Track, 'id'>) => void
  removeTrack: (trackId: string) => void
  updateTrack: (trackId: string, updates: Partial<Track>) => void
  reorderTracks: (trackIds: string[]) => void

  // Playhead and view
  setPlayhead: (frame: number) => void
  setZoom: (zoom: number) => void

  // Selection
  selectClip: (clipId: string, addToSelection?: boolean) => void
  clearSelection: () => void

  // Utility
  reset: () => void
}

export type TimelineStore = TimelineState & TimelineActions

// ============================================================================
// Media Store Types
// ============================================================================

export type MediaAssetType = 'image' | 'video' | 'audio'

export interface MediaAsset {
  id: string
  name: string
  type: MediaAssetType
  url: string // S3 URL or local URL
  thumbnailUrl?: string
  size: number // bytes
  duration?: number // seconds (for video/audio)
  width?: number
  height?: number
  createdAt: Date
  folderId?: string
  metadata: Record<string, unknown>
  tags?: string[]
}

export interface MediaFolder {
  id: string
  name: string
  parentId?: string
  createdAt: Date
}

export interface UploadItem {
  id: string
  file: File
  progress: number // 0-100
  status: 'queued' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled'
  error?: string
  uploadedAssetId?: string
  retryCount: number
}

export interface MediaState {
  assets: Map<string, MediaAsset>
  folders: MediaFolder[]
  uploadQueue: UploadItem[]
  thumbnailCache: Map<string, string> // assetId -> blob URL
  selectedAssetIds: string[]
  currentFolderId?: string
  extractionPromises: Map<string, Promise<void>> // assetId -> metadata extraction promise
}

export interface MediaActions {
  // Asset operations
  addAsset: (asset: MediaAsset) => void
  removeAsset: (assetId: string) => void
  updateAsset: (assetId: string, updates: Partial<MediaAsset>) => void
  moveAsset: (assetId: string, folderId?: string) => void
  selectAsset: (assetId: string, addToSelection?: boolean) => void
  clearAssetSelection: () => void

  // Folder operations
  createFolder: (folder: Omit<MediaFolder, 'id' | 'createdAt'>) => void
  removeFolder: (folderId: string) => void
  setCurrentFolder: (folderId?: string) => void

  // Upload operations
  queueUpload: (file: File) => string // returns upload ID
  updateUploadProgress: (uploadId: string, progress: number) => void
  setUploadStatus: (uploadId: string, status: UploadItem['status'], error?: string) => void
  updateUpload: (uploadId: string, updates: Partial<UploadItem>) => void
  cancelUpload: (uploadId: string) => void
  removeFromQueue: (uploadId: string) => void
  clearCompletedUploads: () => void

  // Thumbnail operations
  cacheThumbnail: (assetId: string, blobUrl: string) => void

  // Search and filter
  searchAssets: (query: string) => MediaAsset[]

  // Backend API integration
  loadAssets: (page?: number, perPage?: number) => Promise<void>
  uploadAsset: (file: File, uploadId: string) => Promise<string>
  deleteAsset: (assetId: string) => Promise<void>
  initializeWebSocket: () => void

  // Metadata extraction
  ensureMetadataExtracted: (assetId: string) => Promise<void>

  // Utility
  reset: () => void
}

export type MediaStore = MediaState & MediaActions

// ============================================================================
// Project Store Types
// ============================================================================

export interface ProjectMetadata {
  id: string
  name: string
  description?: string
  thumbnailUrl?: string
  createdAt: Date
  updatedAt: Date
  owner?: string
  version: number // for format migrations
}

export interface ProjectSettings {
  fps: number // frames per second
  resolution: { width: number; height: number }
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3'
  duration: number // in frames
  audioSampleRate: number // Hz
}

export interface ProjectState {
  // Current project being edited
  metadata: ProjectMetadata
  settings: ProjectSettings
  isDirty: boolean
  lastSaved?: Date
  autosaveInterval: number // milliseconds
  isAutoSaveEnabled: boolean

  // Loading states
  isLoading: boolean
  isSaving: boolean
  isExporting: boolean

  // Export job tracking
  exportJobStatus: Map<string, { status: string; progress?: number; error?: string }>

  // Project collection management
  projects: Map<string, ProjectMetadata>
  currentProjectId?: string
}

export interface ProjectActions {
  // Metadata operations
  updateMetadata: (updates: Partial<ProjectMetadata>) => void
  updateSettings: (updates: Partial<ProjectSettings>) => void

  // Dirty state
  setDirty: (isDirty: boolean) => void

  // Save operations
  saveProject: () => Promise<void>
  loadProject: (projectId: string) => Promise<void>
  exportProject: () => Promise<string>

  // Autosave
  enableAutoSave: (enabled: boolean) => void
  setAutosaveInterval: (interval: number) => void

  // Project collection operations
  addProject: (metadata: Omit<ProjectMetadata, 'id' | 'createdAt' | 'updatedAt' | 'version'>, settings?: Partial<ProjectSettings>) => string
  removeProject: (projectId: string) => void
  updateProject: (projectId: string, updates: Partial<ProjectMetadata>) => void
  getProjects: () => ProjectMetadata[]
  getCurrentProject: () => ProjectMetadata | undefined
  setCurrentProject: (projectId: string) => void

  // WebSocket integration
  initializeWebSocket: () => void

  // Utility
  reset: () => void
}

export type ProjectStore = ProjectState & ProjectActions

// ============================================================================
// Editor Store Types
// ============================================================================

export type EditorTool = 'select' | 'trim' | 'split' | 'text' | 'razor'

export type PreviewQuality = 'draft' | 'half' | 'full'

export interface PreviewSettings {
  quality: PreviewQuality
  resolution: { width: number; height: number }
  isFullscreen: boolean
  showSafeZones: boolean
}

export interface WorkspaceLayout {
  leftPanelWidth: number
  rightPanelWidth: number
  timelineHeight: number
  showMediaLibrary: boolean
  showProperties: boolean
  showEffects: boolean
}

export interface KeyboardShortcut {
  key: string
  modifiers: ('ctrl' | 'shift' | 'alt' | 'meta')[]
  action: string
}

export interface EditorState {
  selectedTool: EditorTool
  previewSettings: PreviewSettings
  workspace: WorkspaceLayout
  shortcuts: KeyboardShortcut[]
  isPlaying: boolean
  playbackRate: number // 0.25x - 2x
  volume: number // 0-1
}

export interface EditorActions {
  // Tool selection
  selectTool: (tool: EditorTool) => void

  // Preview settings
  setPreviewQuality: (quality: PreviewQuality) => void
  setPreviewResolution: (resolution: { width: number; height: number }) => void
  toggleFullscreen: () => void
  toggleSafeZones: () => void

  // Workspace layout
  updateWorkspace: (updates: Partial<WorkspaceLayout>) => void
  togglePanel: (panel: keyof Pick<WorkspaceLayout, 'showMediaLibrary' | 'showProperties' | 'showEffects'>) => void

  // Playback controls
  play: () => void
  pause: () => void
  togglePlayback: () => void
  setPlaybackRate: (rate: number) => void
  setVolume: (volume: number) => void

  // Shortcuts
  registerShortcut: (shortcut: KeyboardShortcut) => void
  removeShortcut: (key: string) => void

  // Utility
  reset: () => void
}

export type EditorStore = EditorState & EditorActions

// ============================================================================
// WebSocket Store Types
// ============================================================================

import type { ConnectionStatus, ConnectionMetrics, JobUpdateMessage } from './websocket'

export interface JobState {
  id: string
  type: 'export' | 'ai_generation' | 'thumbnail' | 'processing'
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled'
  progress?: number
  message?: string
  error?: string
  result?: unknown
  createdAt: Date
  updatedAt: Date
}

export interface WebSocketState {
  connectionStatus: ConnectionStatus
  connectionMetrics: ConnectionMetrics
  jobs: Map<string, JobState>
  activeJobIds: string[]
  isConnected: boolean
}

export interface WebSocketActions {
  // Connection management
  connect: () => void
  disconnect: () => void
  updateConnectionStatus: (status: ConnectionStatus) => void
  updateConnectionMetrics: (metrics: ConnectionMetrics) => void

  // Job management
  addJob: (job: JobState) => void
  updateJob: (jobId: string, updates: Partial<JobState>) => void
  removeJob: (jobId: string) => void
  handleJobUpdate: (message: JobUpdateMessage) => void

  // Utility
  reset: () => void
}

export type WebSocketStore = WebSocketState & WebSocketActions

// ============================================================================
// AI Generation Store Types
// ============================================================================

export type GenerationType = 'image' | 'video' | 'audio'
export type QualityTier = 'draft' | 'production'
export type GenerationStatus = 'queued' | 'generating' | 'completed' | 'failed' | 'cancelled'

export interface GenerationRequest {
  id: string
  type: GenerationType
  prompt: string
  qualityTier: QualityTier
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3'
  status: GenerationStatus
  progress?: number
  jobId?: string
  resultUrl?: string
  error?: string
  createdAt: Date
  completedAt?: Date
  metadata?: Record<string, unknown>
}

export interface GenerationHistory {
  id: string
  request: GenerationRequest
  assetId?: string // ID of imported media asset
  isFavorite: boolean
}

export interface AIGenerationState {
  activeGenerations: Map<string, GenerationRequest>
  completingGenerations: Map<string, GenerationRequest> // Tracks generations that are complete but waiting for assets
  generationHistory: GenerationHistory[]
  maxConcurrentGenerations: number
}

export interface AIGenerationActions {
  // Generation operations
  queueGeneration: (request: Omit<GenerationRequest, 'id' | 'status' | 'createdAt'>) => string
  updateGenerationStatus: (generationId: string, status: GenerationStatus, updates?: Partial<GenerationRequest>) => void
  updateGenerationProgress: (generationId: string, progress: number) => void
  cancelGeneration: (generationId: string) => void
  removeGeneration: (generationId: string) => void
  moveToCompleting: (generationId: string) => void
  clearCompletingGeneration: (generationId: string) => void

  // History operations
  addToHistory: (generation: GenerationRequest, assetId?: string) => void
  removeFromHistory: (historyId: string) => void
  toggleFavorite: (historyId: string) => void
  searchHistory: (query: string) => GenerationHistory[]

  // Utility
  reset: () => void
}

export type AIGenerationStore = AIGenerationState & AIGenerationActions

// ============================================================================
// Auth Store Types
// ============================================================================

export interface AuthState {
  userId: string | null
  email: string | null
  name: string | null
  shadowUserId: string // For anonymous sessions
  accessToken: string | null
  refreshToken: string | null
  tokenExpiresAt: number | null // Unix timestamp
  isAuthenticated: boolean
}

export interface AuthActions {
  // Authentication operations
  login: (credentials: { email: string; password: string }) => Promise<void>
  logout: () => Promise<void>
  refreshAuthToken: () => Promise<void>
  setShadowUser: (id: string) => void

  // Utility
  reset: () => void
}

export type AuthStore = AuthState & AuthActions

// ============================================================================
// UI Store Types
// ============================================================================

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
  description?: string
  duration: number // milliseconds
  createdAt: Date
}

export interface ModalState {
  id: string
  isOpen: boolean
  data?: Record<string, unknown>
}

export interface PanelStates {
  isPropertiesPanelOpen: boolean
  isMediaLibraryOpen: boolean
  isTimelineExpanded: boolean
}

export interface UiState {
  modalStates: Map<string, ModalState>
  toastQueue: Toast[]
  panelStates: PanelStates
  activeTool: string | null
  keyboardShortcuts: Map<string, KeyboardShortcut>
}

export interface UiActions {
  // Modal operations
  openModal: (modalId: string, data?: Record<string, unknown>) => void
  closeModal: (modalId: string) => void
  isModalOpen: (modalId: string) => boolean

  // Toast operations
  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => string
  removeToast: (toastId: string) => void
  clearToasts: () => void

  // Panel operations
  togglePanel: (panel: keyof PanelStates) => void
  setPanelState: (panel: keyof PanelStates, isOpen: boolean) => void

  // Tool operations
  setActiveTool: (tool: string | null) => void

  // Keyboard shortcut operations
  registerShortcut: (shortcut: KeyboardShortcut) => void
  removeShortcut: (key: string) => void
  getShortcut: (key: string) => KeyboardShortcut | undefined

  // Utility
  reset: () => void
}

export type UiStore = UiState & UiActions
