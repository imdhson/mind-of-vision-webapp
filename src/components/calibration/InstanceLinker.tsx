import { useMemo, useState } from 'react';
import type { TrackedObject } from '../../types';
import { useCalibrationStore } from '../../stores/calibrationStore';
import { useCameraStore } from '../../stores/cameraStore';
import { appearanceSimilarity } from '../../utils/appearance';
import { Button } from '../common/ui';

/**
 * 저장된 개별 보정값 ↔ 현재 추적 객체 연결
 *
 * 추적 ID는 일시적이므로, 동일한 물체라는 확신 없이 자동으로 연결하지 않습니다.
 * 같은 클래스의 저장값만 후보로 보여주고, 외형(색상 분포) 유사도를 참고로 표시합니다.
 */
export function InstanceLinker({ object }: { object: TrackedObject }) {
  const boundId = useCalibrationStore((s) => s.bindings[object.id]);
  const instances = useCalibrationStore((s) => s.instances);
  const bindings = useCalibrationStore((s) => s.bindings);
  const cameraId = useCameraStore((s) => s.active?.deviceId ?? null);
  const [pick, setPick] = useState('');

  const candidates = useMemo(() => {
    const usedElsewhere = new Set(
      Object.entries(bindings)
        .filter(([t]) => t !== object.id)
        .map(([, i]) => i),
    );
    return Object.values(instances)
      .filter((i) => i.classId === object.classId && !usedElsewhere.has(i.id))
      .map((i) => ({ inst: i, sim: appearanceSimilarity(object.appearance, i.appearance) }))
      .sort((a, b) => (b.sim ?? -1) - (a.sim ?? -1));
    // 외형은 매 프레임 조금씩 바뀌므로 의존성에서 제외: 후보 순서가 계속 바뀌어 목록이 흔들리지 않게 함
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [instances, bindings, object.id, object.classId]);

  if (boundId) {
    const inst = instances[boundId];
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
        <div className="min-w-0 text-[12px]">
          <span className="text-muted">연결됨 </span>
          <span className="font-medium">{inst?.name ?? boundId}</span>
        </div>
        <Button variant="ghost" className="h-8" onClick={() => useCalibrationStore.getState().unbind(object.id)}>
          연결 해제
        </Button>
      </div>
    );
  }
  if (candidates.length === 0) {
    return <p className="text-[11px] text-muted">저장하면 이 물체 전용 보정값이 새로 만들어집니다.</p>;
  }
  return (
    <div className="rounded-lg border border-line p-2">
      <div className="mb-1.5 text-[12px] font-medium">저장된 개별 보정 연결</div>
      <div className="flex gap-2">
        <select
          className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-[13px]"
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          aria-label="연결할 개별 보정 선택"
        >
          <option value="">새로 만들기(연결 안 함)</option>
          {candidates.map(({ inst, sim }) => (
            <option key={inst.id} value={inst.id}>
              {inst.name}
              {sim != null ? ` · 외형 ${Math.round(sim * 100)}%` : ''}
              {inst.cameraKey && inst.cameraKey !== cameraId ? ' · 다른 카메라' : ''}
            </option>
          ))}
        </select>
        <Button
          disabled={!pick}
          onClick={() => {
            useCalibrationStore.getState().bind(object.id, pick);
            setPick('');
          }}
        >
          연결
        </Button>
      </div>
      <p className="mt-1 text-[10.5px] text-muted">같은 물체인지 직접 확인한 뒤 연결하세요. 자동 연결하지 않습니다.</p>
    </div>
  );
}
