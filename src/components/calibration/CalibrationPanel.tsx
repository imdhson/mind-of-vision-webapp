import { useState } from 'react';
import type { CalibrationValues, SpatialObject } from '@/types';
import { useRuntime } from '@/app/AppRuntime';

const fields: [keyof CalibrationValues, string, string][] = [
  ['actualDistance', '실제 거리', 'm'],
  ['distanceOffset', '거리 보정', 'm'],
  ['actualHeight', '실제 높이', 'm'],
  ['actualWidth', '실제 너비', 'm'],
  ['offsetX', 'X 위치 보정', 'm'],
  ['offsetY', 'Y 위치 보정', 'm'],
  ['offsetZ', 'Z 위치 보정', 'm'],
  ['yawOffsetDeg', '방향 보정', '°'],
];
export function CalibrationPanel({ object, onApplied }: { object: SpatialObject; onApplied: () => void }) {
  const { calibration } = useRuntime();
  const [scope, setScope] = useState<'temporary' | 'object' | 'class'>('temporary');
  const [values, setValues] = useState<CalibrationValues>({});
  const [message, setMessage] = useState('');
  const [prevId, setPrevId] = useState(object.id);
  if (prevId !== object.id) {
    setPrevId(object.id);
    setValues({});
    setMessage('');
  }
  function change(k: keyof CalibrationValues, v: string) {
    setValues((s) => ({ ...s, [k]: v === '' ? undefined : Number(v) }));
  }
  async function apply() {
    try {
      calibration.validate(values);
      if (scope === 'temporary') calibration.setTemp(object.id, values);
      else await calibration.save(scope, scope === 'object' ? object.id : object.className, object.className, values);
      setMessage('적용했습니다.');
      onApplied();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <div className="panel-block">
      <h3>보정값</h3>
      <div className="segmented">
        <button className={scope === 'temporary' ? 'active' : ''} onClick={() => setScope('temporary')}>
          임시
        </button>
        <button className={scope === 'object' ? 'active' : ''} onClick={() => setScope('object')}>
          이 객체 저장
        </button>
        <button className={scope === 'class' ? 'active' : ''} onClick={() => setScope('class')}>
          모든 {object.label}
        </button>
      </div>
      <div className="form-grid">
        {fields.map(([k, l, u]) => (
          <label key={k}>
            <span>{l}</span>
            <div>
              <input type="number" step="0.01" value={values[k] ?? ''} onChange={(e) => change(k, e.target.value)} />
              <em>{u}</em>
            </div>
          </label>
        ))}
      </div>
      <button className="primary" onClick={apply}>
        저장 / 적용
      </button>
      {message && <p className="hint">{message}</p>}
    </div>
  );
}
