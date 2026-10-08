import { useRuntime } from '@/app/AppRuntime';
import { useState } from 'react';
export function SavedCalibrationManager() {
  const { calibration } = useRuntime();
  const [, redraw] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  return (
    <div className="panel-block">
      <h3>저장된 보정</h3>
      {!calibration.records.length ? (
        <p className="muted">저장된 보정이 없습니다.</p>
      ) : (
        <div className="saved-list">
          {calibration.records.map((r) => (
            <div key={r.id}>
              <span>
                {r.scope === 'class' ? '클래스' : '객체'} · {r.className}
              </span>
              <button
                aria-label={`${r.scope === 'class' ? '클래스' : '객체'} ${r.className} 보정 삭제`}
                disabled={deletingId === r.id}
                aria-busy={deletingId === r.id}
                onClick={async () => {
                  if (window.confirm(`${r.className} 보정을 삭제하시겠습니까?`)) {
                    setDeletingId(r.id);
                    try {
                      await calibration.remove(r.id);
                      redraw((x) => x + 1);
                    } finally {
                      setDeletingId(null);
                    }
                  }
                }}
              >
                {deletingId === r.id ? '삭제 중...' : '삭제'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
