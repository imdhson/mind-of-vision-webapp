import { useEffect, useRef } from 'react';
import { getCameraManager } from '../../features/camera/CameraManager';
import { useUIStore } from '../../stores/uiStore';
import { DetectionOverlay } from './DetectionOverlay';
import { CameraControls } from './CameraControls';
import { CameraStatusOverlay } from './CameraStatusOverlay';
import { SelectedObjectSheet } from '../objects/SelectedObjectSheet';

/** 카메라 탭: 실시간 영상 + 인식 오버레이 + 실시간 조작(시작/종료, 전환, 렌즈) + 선택 객체 보정 */
export function CameraTab() {
  const hostRef = useRef<HTMLDivElement>(null);
  const fitMode = useUIStore((s) => s.fitMode);

  useEffect(() => {
    const host = hostRef.current;
    const video = getCameraManager().video;
    if (host && video.parentElement !== host) host.prepend(video);
  }, []);

  useEffect(() => {
    getCameraManager().video.style.objectFit = fitMode;
  }, [fitMode]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div ref={hostRef} className="absolute inset-0" />
      <DetectionOverlay />
      <CameraStatusOverlay />
      <CameraControls />
      <SelectedObjectSheet context="camera" />
    </div>
  );
}
