import { calibrationStorage } from '../features/calibration/CalibrationStorage';
import { MODEL_REGISTRY } from '../features/detection/ModelLoader';
import { useUIStore, type FitMode } from '../stores/uiStore';

/** 앱 설정(선택 카메라, 모델, 화면 맞춤, 안전 알림, 차선 인식)을 IndexedDB 에 보존합니다. */
export async function initSettings(): Promise<void> {
  try {
    const s = await calibrationStorage.loadSettings();
    const ui = useUIStore.getState();
    if (typeof s.modelId === 'string' && MODEL_REGISTRY.some((m) => m.id === s.modelId)) ui.setModelId(s.modelId);
    if (typeof s.preferredDeviceId === 'string') ui.setPreferredDeviceId(s.preferredDeviceId);
    if (s.fitMode === 'contain' || s.fitMode === 'cover') ui.setFitMode(s.fitMode as FitMode);
    if (typeof s.proximityAlertEnabled === 'boolean') ui.setProximityAlertEnabled(s.proximityAlertEnabled);
    if (typeof s.proximityAlertDistance === 'number' && Number.isFinite(s.proximityAlertDistance))
      ui.setProximityAlertDistance(s.proximityAlertDistance);
    if (typeof s.laneDetectionEnabled === 'boolean') ui.setLaneDetectionEnabled(s.laneDetectionEnabled);
  } catch {
    // 저장소 사용 불가: 기본값 사용
  }
  useUIStore.subscribe((st, prev) => {
    if (st.modelId !== prev.modelId) void calibrationStorage.putSetting('modelId', st.modelId).catch(() => undefined);
    if (st.preferredDeviceId !== prev.preferredDeviceId)
      void calibrationStorage.putSetting('preferredDeviceId', st.preferredDeviceId).catch(() => undefined);
    if (st.fitMode !== prev.fitMode) void calibrationStorage.putSetting('fitMode', st.fitMode).catch(() => undefined);
    if (st.proximityAlertEnabled !== prev.proximityAlertEnabled)
      void calibrationStorage.putSetting('proximityAlertEnabled', st.proximityAlertEnabled).catch(() => undefined);
    if (st.proximityAlertDistance !== prev.proximityAlertDistance)
      void calibrationStorage.putSetting('proximityAlertDistance', st.proximityAlertDistance).catch(() => undefined);
    if (st.laneDetectionEnabled !== prev.laneDetectionEnabled)
      void calibrationStorage.putSetting('laneDetectionEnabled', st.laneDetectionEnabled).catch(() => undefined);
  });
}
