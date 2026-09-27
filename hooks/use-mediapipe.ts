'use client'

/**
 * Smart-Lecture v4 - MediaPipe Face Mesh Hook
 * Initializes MediaPipe FaceMesh in the browser and draws landmarks on canvas.
 * Uses getUserMedia + requestAnimationFrame (no @mediapipe/camera_utils).
 */

import { useRef, useCallback, useEffect, useState } from 'react'

interface FaceMeshResult {
  multiFaceLandmarks?: Array<Array<{ x: number; y: number; z: number }>>
}

export function useMediaPipe() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const faceMeshRef = useRef<unknown>(null)
  const animationFrameRef = useRef<number>(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onResultsCallbackRef = useRef<
    ((landmarks: Array<{ x: number; y: number; z: number }>) => void) | null
  >(null)

  const drawLandmarks = useCallback(
    (
      landmarks: Array<{ x: number; y: number; z: number }>,
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number
    ) => {
      ctx.clearRect(0, 0, width, height)

      // Draw the webcam frame
      if (videoRef.current) {
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(videoRef.current, -width, 0, width, height)
        ctx.restore()
      }

      // Draw face mesh points
      ctx.fillStyle = '#00d4aa'
      for (let i = 0; i < Math.min(landmarks.length, 468); i++) {
        const x = (1 - landmarks[i].x) * width // mirror
        const y = landmarks[i].y * height
        ctx.beginPath()
        ctx.arc(x, y, 1, 0, 2 * Math.PI)
        ctx.fill()
      }

      // Draw eye contours in brighter color
      const leftEye = [362, 385, 387, 263, 373, 380]
      const rightEye = [33, 160, 158, 133, 153, 144]

      ctx.strokeStyle = '#00d4aa'
      ctx.lineWidth = 1.5

      for (const eyeIndices of [leftEye, rightEye]) {
        ctx.beginPath()
        for (let i = 0; i < eyeIndices.length; i++) {
          const idx = eyeIndices[i]
          const x = (1 - landmarks[idx].x) * width
          const y = landmarks[idx].y * height
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.stroke()
      }

      // Draw iris markers
      if (landmarks.length >= 478) {
        ctx.fillStyle = '#3b82f6'
        for (const irisIdx of [468, 473]) {
          const x = (1 - landmarks[irisIdx].x) * width
          const y = landmarks[irisIdx].y * height
          ctx.beginPath()
          ctx.arc(x, y, 3, 0, 2 * Math.PI)
          ctx.fill()
        }
      }

      // Draw brow lines
      const leftBrow = [70, 63, 105, 66, 107]
      const rightBrow = [300, 293, 334, 296, 336]

      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 1.5

      for (const browIndices of [leftBrow, rightBrow]) {
        ctx.beginPath()
        for (let i = 0; i < browIndices.length; i++) {
          const idx = browIndices[i]
          const x = (1 - landmarks[idx].x) * width
          const y = landmarks[idx].y * height
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
    },
    []
  )

  const streamRef = useRef<MediaStream | null>(null)
  const isRunningRef = useRef(false)

  const startCamera = useCallback(async () => {
    try {
      // Release any previous stream first (prevents "Device in use" on HMR re-mounts)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      isRunningRef.current = false
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      // 1. Open the webcam exactly once via getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // Wait until the video element is actually ready to play
        await new Promise<void>((resolve) => {
          const v = videoRef.current!
          if (v.readyState >= 2) { resolve(); return }
          v.onloadeddata = () => resolve()
        })
        await videoRef.current.play()
      }

      // 2. Import and initialise FaceMesh (no Camera utility — we drive frames ourselves)
      const mediapipeModule = await import('@mediapipe/face_mesh')
      const FaceMeshConstructor =
        mediapipeModule.FaceMesh ||
        (mediapipeModule as any).default?.FaceMesh ||
        (window as any).FaceMesh

      const faceMesh = new FaceMeshConstructor({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      })

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })

      faceMesh.onResults((results: FaceMeshResult) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        if (
          results.multiFaceLandmarks &&
          results.multiFaceLandmarks.length > 0
        ) {
          const landmarks = results.multiFaceLandmarks[0]
          drawLandmarks(landmarks, ctx, canvas.width, canvas.height)

          if (onResultsCallbackRef.current) {
            onResultsCallbackRef.current(landmarks)
          }
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          if (videoRef.current) {
            ctx.save()
            ctx.scale(-1, 1)
            ctx.drawImage(videoRef.current, -canvas.width, 0, canvas.width, canvas.height)
            ctx.restore()
          }

          if (onResultsCallbackRef.current) {
            onResultsCallbackRef.current([])
          }
        }
      })

      faceMeshRef.current = faceMesh

      // 3. Drive the frame loop ourselves with requestAnimationFrame
      isRunningRef.current = true
      let sending = false

      const tick = async () => {
        if (!isRunningRef.current) return
        if (
          !sending &&
          faceMeshRef.current &&
          videoRef.current &&
          videoRef.current.readyState >= 2
        ) {
          sending = true
          try {
            await (
              faceMeshRef.current as {
                send: (opts: { image: HTMLVideoElement }) => Promise<void>
              }
            ).send({ image: videoRef.current })
          } catch {
            // ignore transient send errors
          }
          sending = false
        }
        animationFrameRef.current = requestAnimationFrame(tick)
      }

      animationFrameRef.current = requestAnimationFrame(tick)

      setIsLoaded(true)
    } catch (err) {
      console.error('MediaPipe initialization error:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to initialize face tracking'
      )
    }
  }, [drawLandmarks])

  const setOnResults = useCallback(
    (
      callback: (
        landmarks: Array<{ x: number; y: number; z: number }>
      ) => void
    ) => {
      onResultsCallbackRef.current = callback
    },
    []
  )

  useEffect(() => {
    return () => {
      // Stop the rAF loop
      isRunningRef.current = false
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      // Release the webcam stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  return {
    videoRef,
    canvasRef,
    startCamera,
    isLoaded,
    error,
    setOnResults,
  }
}
