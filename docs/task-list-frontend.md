# Task List - Frontend Track (REVISED)
## AI Video Generation Pipeline

### Overview
This task list covers the React/Vite web application for the video generation pipeline. Team 1 (DevOps + Frontend) is responsible for these tasks.

**MVP Focus:** Ad Creative Pipeline interface (15-60 seconds)
**Post-MVP:** Add Music Video Pipeline interface (1-3 minutes)
**Timeline:** 48 hours to MVP, 8 days total

**DEPLOYMENT APPROACH:** Frontend builds to static files, served by FastAPI backend (Option B)

---

## PR Status Summary

**Completed:** 11/16 ✅
**Unblocked (Ready to Start):** 5
**Blocked (Dependencies Not Met):** 0
**Total Remaining:** 5 tasks to MVP

**COMPLETED PRs:**
- ✅ PR-F001: Project structure with React 19 + Vite + TypeScript
- ✅ PR-F002: Complete design system (CSS variables, base components)
- ✅ PR-F003: API client with all service modules and error handling
- ✅ PR-F004: WebSocket integration for real-time updates
- ✅ PR-F005: Routing and layout with React Router
- ✅ PR-F007: Ad Creative generation form (multi-step)
- ✅ PR-F008: Video preview component with player
- ✅ PR-F009: Progress tracking component with real-time updates
- ✅ PR-F010: Video preview & download page
- ✅ PR-F011: Generation history page with filtering
- ✅ PR-F012: Asset upload manager with drag-and-drop

---

## Currently Unblocked PRs (Ready to Start)

### PR-F006: Pipeline Selection Interface
**Status:** Unblocked | **Est:** 2 hours
**Dependencies:** ✅ PR-F005, ✅ PR-F002
**Description:** Create home page with pipeline selection (Ad Creative vs Music Video).

**Files to Create:**
- `frontend/src/pages/PipelineSelection.tsx` - Main selection page
- `frontend/src/components/PipelineCard.tsx` - Individual pipeline card
- `frontend/src/types/pipeline.ts` - Pipeline type definitions

**Acceptance Criteria:**
- [ ] Two large, clickable cards:
  - [ ] Ad Creative (15-60 seconds)
  - [ ] Music Video (60-180 seconds) - Disabled for MVP
- [ ] Each card shows:
  - [ ] Pipeline icon
  - [ ] Title and brief description
  - [ ] Key features list
  - [ ] Duration range
  - [ ] "Start Creating" button
- [ ] Music Video card has "Coming Soon" badge
- [ ] Clicking Ad Creative navigates to generation form
- [ ] Hover effects and animations
- [ ] Responsive layout (stacks on mobile)

---

### PR-F013: Timeline Editor Component
**Status:** Unblocked | **Est:** 6 hours
**Dependencies:** ✅ PR-F002, ✅ PR-F008, ✅ PR-F009
**Description:** Visual timeline editor for clip arrangement, trimming, and transitions.

**Files to Create:**
- `frontend/src/components/Timeline/TimelineEditor.tsx` - Main timeline
- `frontend/src/components/Timeline/ClipTrack.tsx` - Draggable clip track
- `frontend/src/components/Timeline/TransitionPicker.tsx` - Transition selector
- `frontend/src/components/Timeline/TimeRuler.tsx` - Time ruler with zoom
- `frontend/src/hooks/useTimeline.ts` - Timeline state management
- `frontend/src/utils/timeline.ts` - Timeline calculations

**Acceptance Criteria:**
- [ ] Visual timeline display:
  - [ ] Horizontal track with clip thumbnails
  - [ ] Time ruler at top (seconds)
  - [ ] Zoom in/out controls
  - [ ] Playhead indicator
- [ ] Clip manipulation:
  - [ ] Drag-and-drop reordering
  - [ ] Trim handles at clip edges (drag to trim)
  - [ ] Click to select clip
  - [ ] Delete selected clip
- [ ] Transition controls:
  - [ ] Transition icons between clips
  - [ ] Click to select transition type (fade, cut, dissolve)
  - [ ] Visual representation of transition
- [ ] Playback controls:
  - [ ] Play from timeline position
  - [ ] Pause
  - [ ] Scrub through timeline
- [ ] Timeline data management:
  - [ ] Sync with generation clip data
  - [ ] Calculate total duration
  - [ ] Validate timeline (no gaps, proper transitions)
- [ ] Save composition:
  - [ ] POST `/api/v1/compositions` with timeline config
  - [ ] Loading state during composition
  - [ ] Redirect to composition progress

**API Integration:**
- [ ] GET `/api/v1/generations/{id}/assets` for clip data
- [ ] POST `/api/v1/compositions` with timeline configuration

---

### PR-F014: Error Handling & Notifications
**Status:** Unblocked | **Est:** 3 hours
**Dependencies:** ✅ PR-F002, ✅ PR-F003, ✅ All form components
**Description:** Comprehensive error handling system with toast notifications, error boundaries, and retry mechanisms.

**Files to Create:**
- `frontend/src/components/ErrorBoundary.tsx` - React error boundary
- `frontend/src/components/Notifications/ToastContainer.tsx` - Toast container
- `frontend/src/components/Notifications/Toast.tsx` - Individual toast (enhance from PR-F002)
- `frontend/src/hooks/useNotification.ts` - Notification hook
- `frontend/src/utils/errorMessages.ts` - User-friendly error messages

**Acceptance Criteria:**
- [ ] Toast notification system:
  - [ ] Success, error, warning, info types
  - [ ] Auto-dismiss after 5 seconds
  - [ ] Manual dismiss button
  - [ ] Multiple toasts queue properly
  - [ ] Position: top-right corner
  - [ ] Slide-in animation
- [ ] Error boundary component:
  - [ ] Catches React component errors
  - [ ] Displays fallback UI
  - [ ] "Reload Page" button
  - [ ] Error logging (console)
- [ ] Error message mapping:
  - [ ] Backend error codes → user-friendly messages
  - [ ] Validation errors
  - [ ] Network errors
  - [ ] Timeout errors
- [ ] Retry mechanisms:
  - [ ] Retry button for failed API calls
  - [ ] Exponential backoff (already in API client)
  - [ ] Max retry attempts (3)
- [ ] Global error handler:
  - [ ] Catches unhandled promise rejections
  - [ ] Shows toast for critical errors
- [ ] Offline indicator:
  - [ ] Banner when network is offline
  - [ ] Auto-hide when back online

**Implementation Notes:**
- Use Toast component from PR-F002 as base (enhance if needed)
- Error messages should be actionable ("Try again" vs "Something went wrong")
- Map all error codes from Section F of API spec

---

### PR-F015: Mobile Responsive Design
**Status:** Unblocked | **Est:** 4 hours
**Dependencies:** ✅ All UI components (PR-F002 through PR-F013)
**Description:** Adapt all components for mobile and tablet viewports with touch-friendly interactions.

**Files to Modify:**
- All component CSS files
- `frontend/src/styles/responsive.css` - Update responsive utilities

**Acceptance Criteria:**
- [ ] Responsive navigation:
  - [ ] Hamburger menu for mobile
  - [ ] Slide-in drawer
  - [ ] Touch-friendly tap targets (min 44x44px)
- [ ] Responsive forms:
  - [ ] Single-column layout on mobile
  - [ ] Larger input fields
  - [ ] Touch-friendly sliders and pickers
- [ ] Responsive timeline:
  - [ ] Vertical layout option for mobile
  - [ ] Swipe to scroll
  - [ ] Simplified controls
- [ ] Responsive video player:
  - [ ] Full-width on mobile
  - [ ] Touch controls (tap to play/pause)
  - [ ] Mobile-friendly scrubber
- [ ] Responsive cards and lists:
  - [ ] Stack vertically on mobile
  - [ ] Larger tap targets
- [ ] Test on breakpoints:
  - [ ] Mobile: 375px, 414px
  - [ ] Tablet: 768px, 1024px
  - [ ] Desktop: 1280px, 1920px

---

### PR-F016: User Documentation
**Status:** Unblocked | **Est:** 2 hours
**Dependencies:** None (parallel work)
**Description:** Create user-facing documentation including user guide, FAQ, and prompt engineering best practices.

**Files to Create:**
- `docs/user-guide.md` - Comprehensive user guide
- `docs/faq.md` - Frequently asked questions
- `docs/prompt-best-practices.md` - Tips for effective prompts
- `frontend/src/components/HelpTooltip.tsx` - In-app help component
- `frontend/src/data/helpContent.ts` - Help content data

**Acceptance Criteria:**
- [ ] User guide covering:
  - [ ] Getting started
  - [ ] Creating your first Ad Creative video
  - [ ] Understanding the generation process
  - [ ] Using brand assets (logo, colors)
  - [ ] Configuring video parameters (duration, aspect ratio)
  - [ ] Downloading and sharing videos
  - [ ] Troubleshooting common issues
- [ ] FAQ with 10-15 questions:
  - [ ] What is the maximum video duration?
  - [ ] What aspect ratios are supported?
  - [ ] How long does generation take?
  - [ ] What file formats can I upload?
  - [ ] Can I cancel a generation?
  - [ ] How do I write better prompts?
  - [ ] What if generation fails?
  - [ ] Etc.
- [ ] Prompt best practices guide:
  - [ ] Structure of effective prompts
  - [ ] Example prompts for different ad types (product, service, event)
  - [ ] How to describe brand identity
  - [ ] Tips for visual consistency
  - [ ] Common mistakes to avoid
  - [ ] Character limit guidelines (500-2000 chars)
- [ ] HelpTooltip component (icon with popover)
- [ ] Help content data structure for in-app tooltips

**Implementation Notes:**
- Write in clear, user-friendly language (non-technical)
- Include placeholder images/screenshots (update later with real ones)
- Focus on MVP features (Ad Creative pipeline)
- Prepare structure for Music Video docs (post-MVP)
- Help tooltips should use design system components

---

## Post-MVP Enhancements

### PR-F017: Music Video Interface
**Status:** Post-MVP | **Est:** 8 hours
**Dependencies:** MVP Complete
**Description:** Add Music Video pipeline with audio upload, longer duration support, and music-specific parameters.

**Files to Create:**
- `frontend/src/pages/MusicVideoForm.tsx` - Music video form
- `frontend/src/components/AudioUploader.tsx` - Audio file upload
- `frontend/src/components/AudioPreview.tsx` - Audio player with waveform
- `frontend/src/components/BeatVisualizer.tsx` - Beat detection visualization

**Key Differences from Ad Creative:**
- Duration: 60-180 seconds (vs 15-60)
- Audio upload required (or system generates)
- Genre/style selector instead of brand settings
- Visual style tied to music genre
- Longer timeline support
- No CTA or brand assets

---

### PR-F018: Advanced Features
**Status:** Post-MVP | **Est:** 6 hours
**Description:** Template library, batch generation, A/B testing interface.

---

### PR-F019: Performance Optimization
**Status:** Post-MVP | **Est:** 4 hours
**Description:** Code splitting, lazy loading, caching, service worker.

---

## Critical Path for MVP (48 hours)

### Phase 1: Foundation Complete ✅ (Hours 0-8)
- ✅ PR-F001: Project Initialization (1 hour)
- ✅ PR-F002: Design System (3 hours)
- ✅ PR-F003: API Client Setup (2 hours)

### Phase 2: Core Infrastructure Complete ✅ (Hours 8-16)
- ✅ PR-F004: WebSocket Integration (3 hours)
- ✅ PR-F005: Routing and Layout (2 hours)
- ✅ PR-F008: Video Preview Component (3 hours)

### Phase 3: Generation Flow Complete ✅ (Hours 16-28)
- ✅ PR-F012: Asset Upload Manager (3 hours)
- ✅ PR-F007: Generation Form (5 hours)
- ✅ PR-F009: Progress Tracking (4 hours)

### Phase 4: Preview & History Complete ✅ (Hours 28-36)
- ✅ PR-F010: Video Preview & Download (3 hours)
- ✅ PR-F011: Generation History (4 hours)

### Phase 5: Final MVP Components (Hours 36-48)
- [ ] PR-F006: Pipeline Selection (2 hours)
- [ ] PR-F013: Timeline Editor (6 hours)
- [ ] PR-F014: Error Handling (3 hours)
- [ ] PR-F015: Mobile Responsive (4 hours)
- [ ] PR-F016: User Documentation (2 hours)
- [ ] Integration testing and bug fixes (2 hours)

---

## Success Metrics

### MVP (48 hours)
- [ ] User can select Ad Creative pipeline
- [ ] User can submit generation request with prompt and brand assets
- [ ] Real-time progress updates display correctly via WebSocket
- [ ] User can preview generated video in browser
- [ ] User can download final video
- [ ] Generation history shows all jobs with status
- [ ] Timeline editor allows clip reordering (basic)
- [ ] Mobile responsive (tablet+)
- [ ] No critical bugs in happy path
- [ ] User documentation complete

### Post-MVP (Days 3-8)
- [ ] Music Video pipeline functional
- [ ] Advanced timeline editing (trimming, transitions)
- [ ] Template library
- [ ] Performance optimized
- [ ] Full mobile support (<768px)
- [ ] Comprehensive testing suite

---

## Risk Mitigation

### High-Risk Items
1. **Timeline Complexity (PR-F013):** Start with basic reordering, add trimming later
2. **Mobile Responsiveness (PR-F015):** Test early on actual devices
3. **Error Handling (PR-F014):** Ensure all edge cases covered

### Contingency Plans
- **If timeline too complex:** Simplify to basic ordering only (no trimming)
- **If time runs short:** Skip timeline editor (use default composition)
- **If mobile issues:** Focus on tablet+ (768px+) for MVP

---

## Integration Checklist

### API Contract Compliance (From api-specification-edited.md)
- [ ] All request/response types match API spec exactly
- [ ] Error codes mapped to user messages (Section F)
- [ ] WebSocket message formats correct (Section D)
- [ ] File upload follows multipart/form-data spec
- [ ] Rate limiting headers handled (Section G)
- [ ] Request ID tracking on all calls (Section J)
- [ ] Timeout configuration matches spec (30s API, 5min idle WS)

### Backend Coordination
- [ ] GET `/api/v1/generations/{id}` polling if WS fails
- [ ] Confirm upload limits with backend (50MB images, 100MB audio)
- [ ] Verify composition timeline format with FFmpeg backend
- [ ] Test error scenarios with backend team

---

## Notes

**Completed Work:**
- Strong TypeScript foundation with strict mode
- Complete design system with CSS variables (no Tailwind)
- Comprehensive API client with all services, error handling, retry logic
- Circuit breaker, rate limiting awareness, polling helpers
- Full generation flow from form to download
- Real-time progress tracking with WebSocket
- Video preview and history pages

**Next Immediate Steps:**
1. PR-F006: Pipeline Selection (2 hours)
2. PR-F013: Timeline Editor (6 hours) - Most complex remaining
3. PR-F014: Error Handling (3 hours)
4. PR-F015: Mobile Responsive (4 hours)
5. PR-F016: User Documentation (2 hours)

**MVP is 80% complete!** Just 5 PRs remaining to finish.
