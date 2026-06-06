import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { useEffect, useRef } from "react";

import type { TotemDevicePermissionState } from "../types/totemClient";

interface PalmDetectorStatus {
  available: boolean;
  permission: TotemDevicePermissionState;
  error: string | null;
}

interface PalmDetectorProps {
  enabled: boolean;
  onPalmDetected: () => void;
  onStatusChange: (status: PalmDetectorStatus) => void;
  requiredHoldTimeMs?: number;
}

function mapCameraError(error: unknown): PalmDetectorStatus {
  if (!(error instanceof DOMException)) {
    return {
      available: false,
      permission: "unknown",
      error: "No se pudo inicializar la cámara para detección de gestos.",
    };
  }

  if (error.name === "NotAllowedError" || error.name === "SecurityError") {
    return {
      available: false,
      permission: "denied",
      error: "Permiso de cámara denegado.",
    };
  }

  if (error.name === "NotFoundError") {
    return {
      available: false,
      permission: "granted",
      error: "No se encontró una cámara disponible.",
    };
  }

  return {
    available: false,
    permission: "unknown",
    error: "No se pudo acceder a la cámara.",
  };
}

function distance2d(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function isOpenPalm(
  landmarks: { x: number; y: number }[],
  handednessLabel: string | undefined,
) {
  const fingerMargin = 0.01;

  const isIndexOpen = landmarks[8].y < landmarks[6].y - fingerMargin;
  const isMiddleOpen = landmarks[12].y < landmarks[10].y - fingerMargin;
  const isRingOpen = landmarks[16].y < landmarks[14].y - fingerMargin;
  const isPinkyOpen = landmarks[20].y < landmarks[18].y - fingerMargin;

  const isRightHand = handednessLabel === "Right";
  const thumbBySide =
    handednessLabel === undefined
      ? false
      : isRightHand
        ? landmarks[4].x < landmarks[3].x
        : landmarks[4].x > landmarks[3].x;

  const palmCenter = {
    x: (landmarks[0].x + landmarks[5].x + landmarks[9].x + landmarks[13].x + landmarks[17].x) / 5,
    y: (landmarks[0].y + landmarks[5].y + landmarks[9].y + landmarks[13].y + landmarks[17].y) / 5,
  };

  const palmWidth = distance2d(landmarks[5], landmarks[17]);
  const thumbDistanceFromPalm = distance2d(landmarks[4], palmCenter);
  const thumbByDistance = palmWidth > 0 && thumbDistanceFromPalm / palmWidth >= 0.82;

  const isThumbOpen = thumbBySide || thumbByDistance;

  return isThumbOpen && isIndexOpen && isMiddleOpen && isRingOpen && isPinkyOpen;
}

export default function PalmDetector({
  enabled,
  onPalmDetected,
  onStatusChange,
  requiredHoldTimeMs = 450,
}: PalmDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const gestureStartTimeRef = useRef<number | null>(null);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      onStatusChange({
        available: false,
        permission: "unsupported",
        error: "Este navegador no soporta acceso a cámara.",
      });
      return;
    }

    let isCancelled = false;

    const stopResources = () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const detectLoop = () => {
      if (!videoRef.current || !landmarkerRef.current || hasTriggeredRef.current) {
        return;
      }

      const results = landmarkerRef.current.detectForVideo(
        videoRef.current,
        performance.now(),
      );

      const landmarks = results.landmarks?.[0];
      const handedness = results.handedness?.[0]?.[0]?.categoryName;

      if (landmarks && isOpenPalm(landmarks, handedness)) {
        if (gestureStartTimeRef.current === null) {
          gestureStartTimeRef.current = Date.now();
        }

        const holdDuration = Date.now() - gestureStartTimeRef.current;

        if (holdDuration >= requiredHoldTimeMs) {
          hasTriggeredRef.current = true;
          onPalmDetected();
          return;
        }
      } else {
        gestureStartTimeRef.current = null;
      }

      requestRef.current = requestAnimationFrame(detectLoop);
    };

    const bootstrap = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
          },
          audio: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        onStatusChange({
          available: true,
          permission: "granted",
          error: null,
        });

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );

        if (isCancelled) {
          return;
        }

        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.35,
          minHandPresenceConfidence: 0.35,
          minTrackingConfidence: 0.35,
        });

        if (isCancelled || !videoRef.current) {
          return;
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        requestRef.current = requestAnimationFrame(detectLoop);
      } catch (error) {
        if (!isCancelled) {
          onStatusChange(mapCameraError(error));
        }
      }
    };

    hasTriggeredRef.current = false;
    gestureStartTimeRef.current = null;
    void bootstrap();

    return () => {
      isCancelled = true;
      stopResources();
    };
  }, [enabled, onPalmDetected, onStatusChange, requiredHoldTimeMs]);

  return <video ref={videoRef} autoPlay playsInline muted className="hidden" />;
}
