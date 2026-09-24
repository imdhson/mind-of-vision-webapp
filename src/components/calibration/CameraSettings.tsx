import { useEffect, useMemo, useState } from 'react';
import type { CameraProfile } from '../../types';
import { useCameraStore } from '../../stores/cameraStore';
import { useCalibrationStore } from '../../stores/calibrationStore';
import { useUIStore } from '../../stores/uiStore';
import {
  computeIntrinsics,
  createDefaultProfile,
  focal35ToHfov,
  hfovToFocal35,
  profileKey,
  zoomFactorOf,
} from '../../features/camera/CameraCalibration';
import { PROFILE_FIELDS, validateProfile } from '../../features/calibration/CalibrationManager';
import { deviceDisplayName } from '../../features/camera/CameraDeviceService';
import { Button, NumberField, Row, Section } from '../common/ui';
import { fmtDeg } from '../../utils/format';

/**
 * 카메라(렌즈)별 보정 설정 — 객체 목록 탭에 배치
 * 브라우저가 각 렌즈를 별도 장치로 제공하므로 장치별 프로파일 = 렌즈별 보정값입니다.
 * 저장한 값은 해당 카메라에만 적용되며 다른 카메라 설정을 덮어쓰지 않습니다.
 */
export function CameraSettings() {
  const active = useCameraStore((s) => s.active);
  const devices = useCameraStore((s) => s.devices);
  const sensorPitch = useCameraStore((s) => s.sensorPitch);
  const profiles = useCalibrationStore((s) => s.profiles);
  const toast = useUIStore((s) => s.toast);

  const key = active ? profileKey(active.deviceId) : null;
  const saved = key ? profiles[key] : undefined;
  const base: CameraProfile | null = useMemo(
    () => (active ? (saved ?? createDefaultProfile(active)) : null),
    [active?.deviceId, saved],
  );
  const [form, setForm] = useState<CameraProfile | null>(base);
  useEffect(() => setForm(base), [base]);

  const errors = useMemo(() => (form ? validateProfile(form) : {}), [form]);
  const hasErrors = Object.values(errors).some(Boolean);
  const dirty = !!form && !!base && PROFILE_FIELDS.some((f) => form[f.key] !== base[f.key]);
  const tiltDirty = !!form && !!base && form.useDeviceTilt !== base.useDeviceTilt;

  const intr =
    active && form && !hasErrors
      ? computeIntrinsics(form, active.videoWidth, active.videoHeight, zoomFactorOf(active.currentZoom, active.zoom?.min ?? null))
      : null;

  const otherProfiles = Object.values(profiles).filter((p) => p.id !== key);

  return (
    <Section title="카메라 설정 · 보정">
      {!active || !form ? (
        <p className="px-3 py-3 text-[12.5px] text-muted">카메라를 시작하면 현재 카메라의 보정값을 설정할 수 있습니다.</p>
      ) : (
        <div className="space-y-3 p-3">
          <div>
            <Row
              k="현재 카메라"
              v={deviceDisplayName(active, Math.max(0, devices.findIndex((d) => d.deviceId === active.deviceId)))}
              sub={saved ? '저장된 보정' : '기본값'}
            />
            {active.label ? <Row k="장치명" v={<span className="text-[11.5px]">{active.label}</span>} /> : null}
            <Row
              k="해상도"
              v={`${active.videoWidth} × ${active.videoHeight}`}
              sub={active.frameRate ? `${Math.round(active.frameRate)}fps` : undefined}
            />
            {active.zoom ? <Row k="줌" v={`${(active.currentZoom ?? active.zoom.min).toFixed(1)}×`} /> : null}
            <Row k="초점거리(픽셀)" v={intr ? `${intr.fx.toFixed(0)} px` : '—'} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {PROFILE_FIELDS.map((spec) => (
              <NumberField
                key={spec.key}
                label={spec.label}
                unit={spec.unit}
                min={spec.min}
                max={spec.max}
                step={spec.step}
                value={form[spec.key]}
                error={errors[spec.key]}
                onChange={(v) => setForm({ ...form, [spec.key]: v ?? NaN })}
              />
            ))}
            <NumberField
              label="35mm 환산 초점거리"
              unit="mm"
              min={5}
              max={300}
              value={Number.isFinite(form.hfovLongDeg) ? Math.round(hfovToFocal35(form.hfovLongDeg) * 10) / 10 : undefined}
              hint="입력 시 화각 자동 계산"
              onChange={(v) => {
                if (v != null && Number.isFinite(v) && v >= 5 && v <= 300)
                  setForm({ ...form, hfovLongDeg: Math.round(focal35ToHfov(v) * 10) / 10 });
              }}
            />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
            <span className="text-[12.5px]">
              기기 기울기 센서 사용
              <span className="block text-[10.5px] text-muted">
                {sensorPitch != null ? `현재 측정 기울기 ${fmtDeg(sensorPitch)} (아래+)` : '센서 값 없음 · 기본 기울기 사용'}
              </span>
            </span>
            <input
              type="checkbox"
              className="size-5 accent-current"
              checked={form.useDeviceTilt}
              onChange={(e) => setForm({ ...form, useDeviceTilt: e.target.checked })}
            />
          </label>
          <p className="text-[10.5px] leading-snug text-muted">
            화각은 영상 긴 변 기준입니다. 카메라 높이는 바닥 접지 기반 거리 추정에, 거리 추정 기준 배율은 이 카메라의 모든
            추정 거리에 곱해집니다. 이 카메라(렌즈)에만 저장됩니다.
          </p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              className="flex-1"
              disabled={hasErrors || !(dirty || tiltDirty)}
              onClick={async () => {
                const r = await useCalibrationStore.getState().saveProfile({ ...form, label: active.label });
                if (!r.ok) toast(r.error ?? '저장 실패', 'error');
                else if (!r.persisted) toast(`이번 실행에만 적용: ${r.error ?? ''}`, 'error');
                else toast('카메라 보정값을 저장했습니다', 'success');
              }}
            >
              저장
            </Button>
            <Button disabled={!dirty && !tiltDirty} onClick={() => setForm(base)}>
              되돌리기
            </Button>
            <Button
              variant="danger"
              disabled={!saved}
              onClick={async () => {
                if (!key || !confirm('이 카메라의 보정값을 기본값으로 초기화할까요?')) return;
                await useCalibrationStore.getState().resetProfile(key);
                toast('기본값으로 초기화했습니다', 'success');
              }}
            >
              초기화
            </Button>
          </div>
        </div>
      )}
      {otherProfiles.length ? (
        <div className="border-t border-line px-3 py-2">
          <div className="pb-1 text-[11.5px] font-semibold text-muted">다른 카메라·렌즈 보정값</div>
          <ul className="divide-y divide-line/60">
            {otherProfiles.map((p) => (
              <li key={p.id} className="flex items-center gap-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px]">{p.label || p.deviceId.slice(0, 12)}</div>
                  <div className="text-[11px] text-muted tabular">
                    화각 {p.hfovLongDeg}° · 높이 {p.cameraHeight}m · 배율 ×{p.distanceScale}
                  </div>
                </div>
                <Button
                  variant="danger"
                  className="h-8"
                  onClick={async () => {
                    if (!confirm('이 카메라 보정값을 삭제할까요?')) return;
                    await useCalibrationStore.getState().resetProfile(p.id);
                  }}
                >
                  삭제
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}
