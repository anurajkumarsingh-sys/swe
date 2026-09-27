/**
 * Smart-Lecture v4 - Vision Engine
 * Browser-based MediaPipe Face Mesh tracking for:
 * - EAR (Eye Aspect Ratio) — Drowsiness detection
 * - Brow Furrow / Squint / Brow Knit / Brow Raise — Multi-cue Confusion detection
 * - Gaze Tracking — Away detection
 * - Calibration — 3-second baseline (~90 frames)
 */

// MediaPipe Face Mesh landmark indices
// Left eye: [362, 385, 387, 263, 373, 380]
// Right eye: [33, 160, 158, 133, 153, 144]
// Left iris center: 468, Right iris center: 473
// Left eyebrow: [70, 63, 105, 66, 107]
// Right eyebrow: [300, 293, 334, 296, 336]
// Nose tip: 1

const LEFT_EYE = [362, 385, 387, 263, 373, 380]
const RIGHT_EYE = [33, 160, 158, 133, 153, 144]
const LEFT_IRIS = 468
const RIGHT_IRIS = 473
const LEFT_EYE_CENTER = [362, 263] // outer corners for bounding box
const RIGHT_EYE_CENTER = [33, 133]

// Outer eye corners for face scale normalization
const RIGHT_EYE_OUTER = 33
const LEFT_EYE_OUTER = 263

// Brow landmarks (inner brow points & eye tops)
const LEFT_BROW_INNER = 107
const RIGHT_BROW_INNER = 336
const LEFT_EYE_TOP = 386
const RIGHT_EYE_TOP = 159

export type ConfusionType = 'none' | 'squint' | 'furrow' | 'knit' | 'raise' | 'combined'

export interface FaceMetrics {
  ear: number
  earRatio: number // relative to baseline
  browRatio: number
  browRatioChange: number // relative to baseline (- for furrow/squint, + for raise)
  interBrowDist: number
  interBrowChange: number // relative to baseline (- for knitting brows together)
  confusionScore: number // 0-100 continuous score
  confusionType: ConfusionType
  gazeOffCenter: number
  isCalibrating: boolean
  calibrationProgress: number
  faceDetected: boolean
}

export interface VisionState {
  emotion: 'focused' | 'confused' | 'drowsy' | 'away' | 'calibrating' | 'no_face'
  attention: number
  metrics: FaceMetrics
  pausedReason: string | null
  lastConfusedTime: number
  lastDrowsyTime: number
  lastAwayTime: number
  awayStartTime: number | null
  confusedStartTime: number | null
  drowsyStartTime: number | null
}

function euclideanDist(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)
}

function calculateEAR(
  landmarks: Array<{ x: number; y: number; z: number }>,
  eyeIndices: number[]
): number {
  const p1 = landmarks[eyeIndices[0]]
  const p2 = landmarks[eyeIndices[1]]
  const p3 = landmarks[eyeIndices[2]]
  const p4 = landmarks[eyeIndices[3]]
  const p5 = landmarks[eyeIndices[4]]
  const p6 = landmarks[eyeIndices[5]]

  const vertical1 = euclideanDist(p2, p6)
  const vertical2 = euclideanDist(p3, p5)
  const horizontal = euclideanDist(p1, p4)

  if (horizontal === 0) return 0
  return (vertical1 + vertical2) / (2.0 * horizontal)
}

function calculateBrowMetrics(
  landmarks: Array<{ x: number; y: number; z: number }>
): { browRatio: number; interBrowDist: number } {
  // Eye span for distance-invariant normalization
  const eyeSpan = euclideanDist(landmarks[RIGHT_EYE_OUTER], landmarks[LEFT_EYE_OUTER]) || 1

  const leftBrowDist = euclideanDist(
    landmarks[LEFT_BROW_INNER],
    landmarks[LEFT_EYE_TOP]
  )
  const rightBrowDist = euclideanDist(
    landmarks[RIGHT_BROW_INNER],
    landmarks[RIGHT_EYE_TOP]
  )
  const avgBrowEyeDist = (leftBrowDist + rightBrowDist) / 2

  const interBrow = euclideanDist(
    landmarks[LEFT_BROW_INNER],
    landmarks[RIGHT_BROW_INNER]
  )

  return {
    browRatio: avgBrowEyeDist / eyeSpan,
    interBrowDist: interBrow / eyeSpan,
  }
}

function calculateGazeOffset(
  landmarks: Array<{ x: number; y: number; z: number }>
): number {
  const leftOuter = landmarks[LEFT_EYE_CENTER[0]]
  const leftInner = landmarks[LEFT_EYE_CENTER[1]]
  const leftIris = landmarks[LEFT_IRIS]
  const leftCenterX = (leftOuter.x + leftInner.x) / 2
  const leftWidth = Math.abs(leftOuter.x - leftInner.x)

  const rightOuter = landmarks[RIGHT_EYE_CENTER[0]]
  const rightInner = landmarks[RIGHT_EYE_CENTER[1]]
  const rightIris = landmarks[RIGHT_IRIS]
  const rightCenterX = (rightOuter.x + rightInner.x) / 2
  const rightWidth = Math.abs(rightOuter.x - rightInner.x)

  if (leftWidth === 0 || rightWidth === 0) return 0

  const leftOffsetX = Math.abs(leftIris.x - leftCenterX) / leftWidth
  const rightOffsetX = Math.abs(rightIris.x - rightCenterX) / rightWidth

  return ((leftOffsetX + rightOffsetX) / 2) * 100
}

export class VisionEngine {
  private baselineEAR: number = 0
  private baselineBrow: number = 0
  private baselineInterBrow: number = 0
  private baselineGaze: number = 0

  private calibrationFrames: number[] = []
  private calibrationBrowFrames: number[] = []
  private calibrationInterBrowFrames: number[] = []
  private gazeCalibrationFrames: number[] = []

  private isCalibrated: boolean = false
  private readonly CALIBRATION_FRAMES = 90 // ~3 seconds at 30fps

  // State tracking
  private attention: number = 100
  private state: VisionState

  // Timing constants (ms)
  private readonly COOLDOWN_MS = 12000
  private readonly DROWSY_SUSTAIN_MS = 1500
  private readonly CONFUSED_SUSTAIN_MS = 1000 // Fast responsive trigger (1s)
  private readonly AWAY_SUSTAIN_MS = 15000 // Sustained 15 seconds for away intervention

  // Thresholds
  private readonly EAR_DROWSY_THRESHOLD = 0.65 // < 65% of baseline is drowsy
  private readonly GAZE_MULTIPLIER = 2.5

  constructor() {
    this.state = {
      emotion: 'calibrating',
      attention: 100,
      metrics: {
        ear: 0,
        earRatio: 1,
        browRatio: 0,
        browRatioChange: 0,
        interBrowDist: 0,
        interBrowChange: 0,
        confusionScore: 0,
        confusionType: 'none',
        gazeOffCenter: 0,
        isCalibrating: true,
        calibrationProgress: 0,
        faceDetected: false,
      },
      pausedReason: null,
      lastConfusedTime: 0,
      lastDrowsyTime: 0,
      lastAwayTime: 0,
      awayStartTime: null,
      confusedStartTime: null,
      drowsyStartTime: null,
    }
  }

  getState(): VisionState {
    return { ...this.state }
  }

  resetState(): void {
    this.state.pausedReason = null
    this.state.emotion = 'focused'
    this.state.confusedStartTime = null
    this.state.drowsyStartTime = null
    this.state.awayStartTime = null
  }

  processLandmarks(
    landmarks: Array<{ x: number; y: number; z: number }>
  ): VisionState {
    if (!landmarks || landmarks.length < 478) {
      this.state.metrics.faceDetected = false
      const now = Date.now()
      if (!this.state.pausedReason) {
        if (!this.state.awayStartTime) {
          this.state.awayStartTime = now
        } else if (
          now - this.state.awayStartTime >= this.AWAY_SUSTAIN_MS &&
          now - this.state.lastAwayTime >= this.COOLDOWN_MS
        ) {
          this.state.emotion = 'away'
          this.state.pausedReason = 'away'
          this.state.lastAwayTime = now
          this.state.awayStartTime = null
          this.attention = Math.max(0, this.attention - 15)
        } else {
          this.state.emotion = 'no_face'
        }
      }
      return this.getState()
    }

    this.state.metrics.faceDetected = true

    // Calculate raw metrics
    const leftEAR = calculateEAR(landmarks, LEFT_EYE)
    const rightEAR = calculateEAR(landmarks, RIGHT_EYE)
    const avgEAR = (leftEAR + rightEAR) / 2.0
    const { browRatio, interBrowDist } = calculateBrowMetrics(landmarks)
    const gazeOffset = calculateGazeOffset(landmarks)

    this.state.metrics.ear = avgEAR
    this.state.metrics.browRatio = browRatio
    this.state.metrics.interBrowDist = interBrowDist
    this.state.metrics.gazeOffCenter = gazeOffset

    // Calibration phase
    if (!this.isCalibrated) {
      this.calibrationFrames.push(avgEAR)
      this.calibrationBrowFrames.push(browRatio)
      this.calibrationInterBrowFrames.push(interBrowDist)
      this.gazeCalibrationFrames.push(gazeOffset)

      this.state.metrics.calibrationProgress =
        this.calibrationFrames.length / this.CALIBRATION_FRAMES
      this.state.metrics.isCalibrating = true
      this.state.emotion = 'calibrating'

      if (this.calibrationFrames.length >= this.CALIBRATION_FRAMES) {
        this.baselineEAR =
          this.calibrationFrames.reduce((a, b) => a + b, 0) /
          this.calibrationFrames.length
        this.baselineBrow =
          this.calibrationBrowFrames.reduce((a, b) => a + b, 0) /
          this.calibrationBrowFrames.length
        this.baselineInterBrow =
          this.calibrationInterBrowFrames.reduce((a, b) => a + b, 0) /
          this.calibrationInterBrowFrames.length
        this.baselineGaze =
          this.gazeCalibrationFrames.reduce((a, b) => a + b, 0) /
          this.gazeCalibrationFrames.length

        this.isCalibrated = true
        this.state.metrics.isCalibrating = false
        this.state.emotion = 'focused'
      }

      return this.getState()
    }

    // Relative ratios vs baseline
    const earRatio = this.baselineEAR > 0 ? avgEAR / this.baselineEAR : 1
    const browRatioChange =
      this.baselineBrow > 0
        ? (browRatio - this.baselineBrow) / this.baselineBrow
        : 0
    const interBrowChange =
      this.baselineInterBrow > 0
        ? (interBrowDist - this.baselineInterBrow) / this.baselineInterBrow
        : 0

    this.state.metrics.earRatio = earRatio
    this.state.metrics.browRatioChange = browRatioChange
    this.state.metrics.interBrowChange = interBrowChange

    // Compute Multi-Factor Confusion State & Scores
    // Cues:
    // 1. Eye Squint (Ankhe sikurna): EAR is moderately narrowed (0.65 <= earRatio <= 0.88)
    // 2. Brow Furrow (Bhowe neeche khichna): browRatioChange < -0.06
    // 3. Brow Knit (Bhowe aapas me jodna): interBrowChange < -0.05
    // 4. Brow Raise (Ankhe/Bhowe badi krna): browRatioChange > +0.09

    const isSquinting = earRatio >= 0.65 && earRatio <= 0.88 && (browRatioChange < -0.03 || interBrowChange < -0.03)
    const isFurrowing = browRatioChange < -0.06
    const isKnitting = interBrowChange < -0.05
    const isRaising = browRatioChange > 0.09

    const squintScore = (earRatio >= 0.60 && earRatio <= 0.90) 
      ? Math.max(0, Math.min(100, (0.92 - earRatio) * 330 + Math.abs(browRatioChange) * 150))
      : 0
    const furrowScore = isFurrowing 
      ? Math.min(100, Math.abs(browRatioChange) * 450) 
      : 0
    const knitScore = isKnitting 
      ? Math.min(100, Math.abs(interBrowChange) * 500) 
      : 0
    const raiseScore = isRaising 
      ? Math.min(100, browRatioChange * 380) 
      : 0

    const cueScores: Array<{ type: ConfusionType; score: number }> = [
      { type: 'squint', score: squintScore },
      { type: 'furrow', score: furrowScore },
      { type: 'knit', score: knitScore },
      { type: 'raise', score: raiseScore },
    ]

    const highestCue = cueScores.reduce((max, cur) => cur.score > max.score ? cur : max, { type: 'none', score: 0 })
    let finalConfusionScore = Math.round(highestCue.score)
    let confusionType: ConfusionType = 'none'

    const activeCueCount = [isSquinting, isFurrowing, isKnitting, isRaising].filter(Boolean).length
    if (activeCueCount >= 2 && finalConfusionScore >= 30) {
      finalConfusionScore = Math.min(100, finalConfusionScore + 15)
      confusionType = 'combined'
    } else if (finalConfusionScore >= 25) {
      confusionType = highestCue.type
    }

    this.state.metrics.confusionScore = finalConfusionScore
    this.state.metrics.confusionType = confusionType

    // If already paused for an intervention, lock the state
    if (this.state.pausedReason) {
      return this.getState()
    }

    const now = Date.now()

    // === Live State & Intervention Evaluation ===

    // 1. Drowsy detection: EAR < 65% of baseline for 1.5s
    const isDrowsyCandidate = earRatio < this.EAR_DROWSY_THRESHOLD
    if (isDrowsyCandidate) {
      if (!this.state.drowsyStartTime) {
        this.state.drowsyStartTime = now
      } else if (
        now - this.state.drowsyStartTime >= this.DROWSY_SUSTAIN_MS &&
        now - this.state.lastDrowsyTime >= this.COOLDOWN_MS
      ) {
        this.state.emotion = 'drowsy'
        this.state.pausedReason = 'drowsy'
        this.state.lastDrowsyTime = now
        this.state.drowsyStartTime = null
        this.attention = Math.max(0, this.attention - 20)
      }
    } else {
      this.state.drowsyStartTime = null
    }

    // 2. Confused detection: Confusion Score >= 35% sustained for 1.0s
    const isConfusedCandidate = finalConfusionScore >= 35
    if (isConfusedCandidate && !this.state.pausedReason && !isDrowsyCandidate) {
      if (!this.state.confusedStartTime) {
        this.state.confusedStartTime = now
      } else if (
        now - this.state.confusedStartTime >= this.CONFUSED_SUSTAIN_MS &&
        now - this.state.lastConfusedTime >= this.COOLDOWN_MS
      ) {
        this.state.emotion = 'confused'
        this.state.pausedReason = 'confused'
        this.state.lastConfusedTime = now
        this.state.confusedStartTime = null
        this.attention = Math.max(0, this.attention - 15)
      }
    } else {
      this.state.confusedStartTime = null
    }

    // 3. Gaze away detection (15-second sustained threshold)
    const gazeThreshold = Math.max(this.baselineGaze * this.GAZE_MULTIPLIER, 25)
    const isAwayCandidate = gazeOffset > gazeThreshold && !this.state.pausedReason
    if (isAwayCandidate) {
      if (!this.state.awayStartTime) {
        this.state.awayStartTime = now
      } else if (
        now - this.state.awayStartTime >= this.AWAY_SUSTAIN_MS &&
        now - this.state.lastAwayTime >= this.COOLDOWN_MS
      ) {
        this.state.emotion = 'away'
        this.state.pausedReason = 'away'
        this.state.lastAwayTime = now
        this.state.awayStartTime = null
        this.attention = Math.max(0, this.attention - 15)
      }
    } else if (!isDrowsyCandidate && !isConfusedCandidate) {
      this.state.awayStartTime = null
    }

    // Real-time responsive live emotion mapping
    if (!this.state.pausedReason) {
      if (isDrowsyCandidate) {
        this.state.emotion = 'drowsy'
      } else if (isConfusedCandidate) {
        this.state.emotion = 'confused'
      } else if (isAwayCandidate && (now - (this.state.awayStartTime || now) > 1000)) {
        this.state.emotion = 'away'
      } else {
        this.state.emotion = 'focused'
        this.attention = Math.min(100, this.attention + 0.5)
      }
    }

    this.state.attention = Math.round(this.attention)
    return this.getState()
  }

  simulateState(emotion: 'confused' | 'drowsy' | 'away'): VisionState {
    const now = Date.now()
    this.state.emotion = emotion
    this.state.pausedReason = emotion
    if (emotion === 'away') {
      this.state.lastAwayTime = now
      this.attention = Math.max(0, this.attention - 10)
    } else if (emotion === 'drowsy') {
      this.attention = Math.max(0, this.attention - 20)
      this.state.lastDrowsyTime = now
    } else if (emotion === 'confused') {
      this.attention = Math.max(0, this.attention - 20)
      this.state.lastConfusedTime = now
      this.state.metrics.confusionScore = 85
      this.state.metrics.confusionType = 'combined'
    }
    this.state.attention = Math.round(this.attention)
    return this.getState()
  }

  isCalibrationComplete(): boolean {
    return this.isCalibrated
  }

  getBaselines(): { ear: number; brow: number; interBrow: number; gaze: number } {
    return {
      ear: this.baselineEAR,
      brow: this.baselineBrow,
      interBrow: this.baselineInterBrow,
      gaze: this.baselineGaze,
    }
  }
}

