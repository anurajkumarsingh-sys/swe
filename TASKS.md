# Smart-Lecture v4 - Development Tasks

## Overview
Smart-Lecture v4 is an AI-powered video learning platform that uses real-time emotion detection (via MediaPipe Face Mesh) to intervene with AI-generated quizzes and summaries when students show signs of confusion or drowsiness. This document outlines all required features, current implementation status, and remaining work.

---

## Project Architecture

**Frontend**: Next.js 16 (App Router) with React 19, TypeScript, Tailwind CSS v4
**Vision Engine**: MediaPipe Face Mesh (in-browser face tracking)
**AI Backend**: OpenAI API (gpt-4-turbo)
**Video Source**: YouTube (IFrame Player API)
**Transcript Source**: YouTube Innertube API

---

## Phase 1: Core Features (Version 1) - Status & Tasks

### 1. **Video Player with YouTube Integration**
**Status**: ✅ Implemented
**Files**: `components/smart-lecture/video-player.tsx`

**What Works**:
- YouTube IFrame Player API integration
- Custom video controls (Play/Pause, Skip ±10s, Seek bar)
- Mute toggle, Fullscreen button, Time display
- Player API exposed via `forwardRef` for external control
- Video state tracking (playing, duration, current time)

**Remaining Tasks**: None - COMPLETE

---

### 2. **Real-Time Transcript Synchronization**
**Status**: ⚠️ Partially Implemented
**Files**: 
- `app/api/load-video/route.ts` (Transcript fetching)
- `components/smart-lecture/transcript-panel.tsx` (Display)
- `app/page.tsx` (Sync logic)

**What Works**:
- YouTube Innertube player API for transcript URL extraction
- Timed-text caption fetching in JSON3 format
- Fallback to watch-page scrape and demo data
- Transcript display in right sidebar

**Issues & Remaining Tasks**:
- [x] **CRITICAL**: Transcript sync not highlighting current entry in real-time
  - Problem: `currentTime` from VideoPlayer not being used to match transcript entries
  - Solution: In `TranscriptPanel`, add logic to find matching entry based on video time and apply highlight class
  - Task location: `components/smart-lecture/transcript-panel.tsx` line ~60
  
- [x] Transcript entries missing timing data in some cases
  - Verify that `tStartMs` and `dDurationMs` are always present in API response
  - Task: Add data validation and logging in `app/api/load-video/route.ts`

---

### 3. **Confusion-Triggered Summary (Quick Help)**
**Status**: ⚠️ Partially Implemented
**Files**:
- `lib/vision-engine.ts` (Confusion detection)
- `lib/content-engine.ts` (Summary generation)
- `app/api/generate-summary/route.ts` (OpenAI integration)
- `components/smart-lecture/summary-overlay.tsx` (UI display)
- `app/page.tsx` (Trigger logic)

**What Works**:
- Confusion detection via Brow Ratio spike analysis
- 15-second cooldown to prevent spam
- API route calls OpenAI `gpt-4-turbo` with the prompt: "The user is confused. Summarize the last 2 minutes of this lecture simply."
- Summary overlay displays with Acknowledge button

**Issues & Remaining Tasks**:
- [x] **CRITICAL**: Transcript slicing for "last 2 minutes" may be empty or undefined
  - Problem: When confusion is triggered, code slices transcript from `currentTime - 120` to `currentTime`, but logic may not be correct
  - Solution: In `app/page.tsx` (around line 300), verify transcript entries are properly filtered and joined
  - Task: Add debug logging to console to verify transcript content before sending to API
  
- [x] Summary overlay not fully styled to match dark theme
  - Task: Update `components/smart-lecture/summary-overlay.tsx` with glow effects and neon accents

- [x] Confusion threshold may be too sensitive or insensitive
  - Current threshold: 18% increase in Brow Ratio
  - Task: Test and adjust `BROW_SPIKE_THRESHOLD` in `lib/vision-engine.ts` line 150

---

### 4. **Drowsiness-Triggered Quiz (3-Question MCQ)**
**Status**: ⚠️ Partially Implemented
**Files**:
- `lib/vision-engine.ts` (Drowsiness detection)
- `app/api/generate-quiz/route.ts` (Quiz generation)
- `components/smart-lecture/quiz-overlay.tsx` (UI)
- `app/page.tsx` (Trigger logic)

**What Works**:
- Drowsiness detection via Eye Aspect Ratio (EAR) drop
- Sustained duration requirement (1.5 seconds) before triggering
- 15-second cooldown after quiz completion
- Quiz overlay walks through 3 MCQ questions sequentially
- Quiz pauses video; user must answer all 3 correctly to resume
- OpenAI generates questions based on transcript up to current time

**Issues & Remaining Tasks**:
- [x] **CRITICAL**: OpenAI does not generate questions based on running video transcript up to current time
  - Problem: When `app/api/generate-quiz/route.ts` calls OpenAI, it sends the entire transcript or a static excerpt, NOT the dynamic transcript from video start to current playback time
  - Root cause: `app/page.tsx` passes transcript array to API, but API doesn't slice it based on `currentTime` from video playback
  - Solution: In `app/page.tsx` (line ~250-280), filter transcript entries where `entry.start <= currentTime` BEFORE sending to API
  - Expected behavior: If user is at 5:30 in video, quiz should ask about content from 0:00 to 5:30 only, not the entire lecture
  - Task: Implement transcript slicing by currentTime in the drowsy state handler
  - Verification: Add console.log to show sliced transcript sent to API
  
- [x] **CRITICAL**: Quiz correct option is always the 2nd option (not random)
  - Problem: When OpenAI generates quiz with options A, B, C, D; the correct answer is hardcoded or always placed in position 2
  - Root cause: Either OpenAI response is not being parsed correctly OR options are not being shuffled
  - Solution: In `app/api/generate-quiz/route.ts`, after parsing OpenAI response, randomize option order and track which option is now correct
  - Expected behavior: Correct answer should appear randomly in positions 1-4
  - Task: Add shuffle logic that maintains correct answer reference while randomizing display order
  - Verification: Generate multiple quizzes; confirm correct answer varies in position
  
- [x] **CRITICAL**: Quiz not actually checking answer correctness
  - Problem: Quiz overlay doesn't verify selected answers against correct option
  - Solution: In `components/smart-lecture/quiz-overlay.tsx`, add answer validation logic
  - Task: Parse OpenAI response to extract correct answers, compare user selection, show feedback
  
- [x] Quiz text may be cut off in UI
  - Task: Update scrolling/overflow in `components/smart-lecture/quiz-overlay.tsx` to handle longer questions
  
- [x] Video not pausing when quiz is triggered
  - Problem: `playerRef.pauseVideo()` may not be called or may be failing silently
  - Solution: In `app/page.tsx` (line ~180), add debug log to confirm pause is called
  - Task: Add error handling around player pause/resume

- [x] Quiz generation may timeout or fail silently (OpenAI API not responding)
  - Task: Add error state UI to quiz overlay to show "Failed to generate quiz. Try again."
  - Task location: `components/smart-lecture/quiz-overlay.tsx` near state definition

---

### 5. **Enhanced Player Controls**
**Status**: ✅ Implemented
**Files**: `components/smart-lecture/video-player.tsx`

**What Works**:
- Play/Pause button (toggles `player.playVideo()` / `player.pauseVideo()`)
- Skip Forward (+10s) and Skip Backward (-10s) buttons (`player.seekTo()`)
- Seek bar with progress indicator (draggable)
- Mute toggle with visual indicator
- Fullscreen button
- Time display (current / duration)
- All buttons fully styled with neon accents

**Remaining Tasks**: None - COMPLETE

---

### 6. **Full Video Summarization**
**Status**: ✅ Implemented
**Files**:
- `app/api/summarize-video/route.ts` (OpenAI integration)
- `components/smart-lecture/full-summary-overlay.tsx` (UI display)
- `app/page.tsx` (Trigger logic)

**What Works**:
- "Summarize Full Video" button below player
- OpenAI generates structured summary with sections and key takeaways
- Full summary overlay displays with dismiss button
- Overlay styled with dark theme neon accents

**Remaining Tasks**: None - COMPLETE

---

### 7. **Real-Time Emotion Detection & State Machine**
**Status**: ⚠️ Partially Implemented
**Files**:
- `lib/vision-engine.ts` (Core state machine)
- `hooks/use-mediapipe.ts` (Face tracking)
- `components/smart-lecture/metric-bars.tsx` (Metric display)
- `components/smart-lecture/gaze-toast.tsx` (Gaze away notification)

**What Works**:
- MediaPipe Face Mesh loaded and running
- Real-time face detection with 90-frame calibration phase
- EAR calculation (Eye Aspect Ratio) for drowsiness detection
- Brow Ratio calculation for confusion detection
- Gaze offset calculation (iris position relative to eye center)
- 4-state emotion model: Focused → Confused → Drowsy → Away
- 15-second cooldown between interventions
- Sustained-duration requirements (1.5s drowsy, 2s confused, 3s away)
- Attention score calculation and display
- Metric bars (EAR, Brow Ratio, Attention Score, Gaze Offset)

**Issues & Remaining Tasks**:
- [x] **CRITICAL**: Camera "Device in use" error on startup
  - Problem: Multiple webcam access attempts conflict (older versions tried Camera utility + manual getUserMedia)
  - Status: FIXED in latest code - using single getUserMedia + rAF loop
  - Task: Verify fix is working by testing camera startup
  
- [x] Gaze-away detection triggering too frequently
  - Problem: User looks slightly to the side (natural eye movement) and "away" state triggers
  - Solution: Already addressed with calibration-relative thresholds (2.5x baseline)
  - Task: Test gaze threshold with various users; may need tuning in `lib/vision-engine.ts` line 293

- [x] Attention score calculation may be inaccurate
  - Task: Verify formula in `lib/vision-engine.ts` (currently simple average of 3 metrics)
  - Task: Consider exponential moving average for smoother transitions

---

## Phase 2: Advanced Features (Future Enhancements)

### 8. **Session Analytics & History**
**Status**: ✅ Implemented
**Files**:
- `lib/analytics.ts` (Persistence logic)
- `components/smart-lecture/analytics-dashboard.tsx` (UI)
- `app/page.tsx` (Tracking integration)

**Tasks**:
- [x] Track session duration, emotion timeline, quiz scores
- [x] Persist data to local storage
- [x] Dashboard showing learning patterns

### 9. **Multi-Language Transcript Support**
**Status**: ✅ Implemented
**Files**:
- `app/api/load-video/route.ts` (Language detection)
- `lib/content-engine.ts` (Language propagation)
- `app/api/generate-quiz/route.ts` (Localized generation)
- `app/api/generate-summary/route.ts` (Localized generation)

**Tasks**:
- [x] Detect video language
- [x] Support transcripts in non-English languages
- [x] Translate summaries/quizzes if needed (AI generated in target language)

### 11. **Session Dashboard UI Integration**
**Status**: ✅ Implemented
**Files**:
- `app/page.tsx` (Navigation logic)
- `components/smart-lecture/analytics-dashboard.tsx` (UI)

**Tasks**:
- [x] Implement sidebar toggle between Player and Analytics
- [x] Integrate dashboard into main application layout

### 12. **Debug Panel for Development**
**Status**: ✅ Implemented
**Files**:
- `components/smart-lecture/debug-panel.tsx` (UI)
- `app/page.tsx` (Integration)

**Tasks**:
- [x] Create real-time metrics monitor
- [x] Monitor EAR, Brow Ratio, and calibration status
- [x] Add toggleable developer overlay

---

## Development Priorities

### 🔴 CRITICAL (Must Fix for MVP)
1. **OpenAI quiz generation not using current video time** (`app/page.tsx` + `app/api/generate-quiz/route.ts`)
   - Problem: Quiz questions are generated from entire transcript, not just content up to current playback time
   - Estimated effort: 1-2 hours
   - Impact: CRITICAL - Quiz is asking about material student hasn't seen yet
   - Files: `app/page.tsx` (add transcript slicing logic), `app/api/generate-quiz/route.ts` (verify receipt of sliced transcript)
   
2. **Quiz correct answer always in 2nd position (not random)** (`app/api/generate-quiz/route.ts`)
   - Problem: Correct answer placement is not randomized across multiple choice options
   - Estimated effort: 1 hour
   - Impact: CRITICAL - Makes quiz trivial/invalid; defeats learning assessment purpose
   - Files: `app/api/generate-quiz/route.ts` (add shuffle logic), `components/smart-lecture/quiz-overlay.tsx` (display randomized options)
   
3. **Quiz answer validation** (`quiz-overlay.tsx`)
   - Estimated effort: 2-3 hours
   - Impact: High - quiz must actually test learning
   
4. **Confusion summary transcript slicing** (`app/page.tsx`)
   - Estimated effort: 1 hour
   - Impact: High - feature won't work without correct transcript excerpt
   
5. **Video pause on quiz trigger** (`app/page.tsx`)
   - Estimated effort: 30 minutes
   - Impact: High - essential behavior
   
6. **Transcript real-time sync highlighting** (`transcript-panel.tsx`)
   - Estimated effort: 1-2 hours
   - Impact: High - core user experience feature

### 🟡 HIGH (Should Have)
5. **Gaze threshold tuning** (`lib/vision-engine.ts`)
   - Estimated effort: 2-3 hours (testing)
   - Impact: Medium - reduces false "away" positives
   
6. **Quiz UI overflow handling** (`quiz-overlay.tsx`)
   - Estimated effort: 30 minutes
   - Impact: Medium - some questions may not display fully
   
7. **Error handling for API failures** (multiple files)
   - Estimated effort: 1 hour
   - Impact: Medium - graceful degradation

### 🟢 NICE-TO-HAVE (Polish)
8. **Summary overlay styling** (`summary-overlay.tsx`)
   - Estimated effort: 1 hour
   - Impact: Low - visual consistency
   
9. **Debug panel for development** (new component)
   - Estimated effort: 2 hours
   - Impact: Low - developer experience

---

## Testing Checklist

- [ ] Camera opens without "Device in use" errors
- [ ] Face tracking runs smoothly (FPS visible in metric bars)
- [ ] Calibration phase completes in ~3 seconds
- [ ] Load YouTube video by URL (extract video ID, fetch transcript)
- [ ] Play/pause/seek video player controls work
- [ ] Transcript displays and scrolls
- [ ] Transcript current entry highlights as video plays
- [ ] Manually trigger confusion (simulate button) → Quick Help overlay appears
- [ ] Manually trigger drowsiness (simulate button) → Quiz pauses video and appears
- [ ] Quiz: Answer 3 questions correctly to resume video
- [ ] Quiz: Wrong answer shows feedback and allows retry
- [ ] Gaze away for 3+ seconds → Toast notification appears
- [ ] "Summarize Full Video" button generates structured summary
- [ ] No console errors in DevTools

---

## Environment Variables Required

```bash
# .env.local
OPENAI_API_KEY=sk-your-openai-api-key-here
```

Without `OPENAI_API_KEY`:
- Quizzes will return dummy data (3 hardcoded questions)
- Summaries will return dummy data (placeholder text)
- Video still plays and transcript loads normally

---

## File Structure
```
/vercel/share/v0-project/
├── app/
│   ├── api/
│   │   ├── generate-quiz/route.ts          ⚠️ Needs answer validation
│   │   ├── generate-summary/route.ts       ✅ Complete
│   │   ├── summarize-video/route.ts        ✅ Complete
│   │   └── load-video/route.ts             ✅ Complete
│   ├── layout.tsx                          ✅ Complete
│   ├── page.tsx                            ⚠️ Needs transcript slicing fix
│   └── globals.css                         ✅ Complete
├── components/smart-lecture/
│   ├── video-player.tsx                    ✅ Complete
│   ├── transcript-panel.tsx                ⚠️ Needs sync highlighting
│   ├── quiz-overlay.tsx                    ⚠️ Needs answer validation
│   ├── summary-overlay.tsx                 ⚠️ Needs styling
│   ├── full-summary-overlay.tsx            ✅ Complete
│   ├── metric-bars.tsx                     ✅ Complete
│   ├── top-bar.tsx                         ✅ Complete
│   ├── gaze-toast.tsx                      ✅ Complete
│   └── simulate-buttons.tsx                ✅ Complete
├── hooks/
│   └── use-mediapipe.ts                    ✅ Complete (camera fixed)
├── lib/
│   ├── vision-engine.ts                    ⚠️ Gaze threshold may need tuning
│   ├── content-engine.ts                   ✅ Complete
│   └── utils.ts                            ✅ Complete
└── package.json                            ✅ Complete
```

---

## Legend
- ✅ **Complete** - Fully implemented and tested
- ⚠️ **Partially Implemented** - Core logic done but has known issues
- ❌ **Not Implemented** - Placeholder or missing entirely
- 🔴 **CRITICAL** - Blocks MVP functionality
- 🟡 **HIGH** - Important for user experience
- 🟢 **NICE-TO-HAVE** - Polish and extras
