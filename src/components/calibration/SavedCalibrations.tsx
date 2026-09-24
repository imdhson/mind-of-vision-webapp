import { useState } from 'react';
import { useCalibrationStore } from '../../stores/calibrationStore';
import { useObjectStore } from '../../stores/objectStore';
import { useUIStore } from '../../stores/uiStore';
import { getClassInfo } from '../../features/detection/classCatalog';
import { Button, Section } from '../common/ui';
import { ValuesEditor, summarizeValues } from './ValuesEditor';

/** 저장된 보정값 조회·수정·삭제 (클래스별 / 개별 객체별) */
export function SavedCalibrations() {
  const classCals = useCalibrationStore((s) => s.classCals);
  const instances = useCalibrationStore((s) => s.instances);
  const bindings = useCalibrationStore((s) => s.bindings);
  const loadError = useCalibrationStore((s) => s.loadError);
  const selected = useObjectStore((s) => (s.selectedId ? s.objects[s.selectedId] : null));
  const toast = useUIStore((s) => s.toast);
  const [editing, setEditing] = useState<string | null>(null);

  const classList = Object.values(classCals).sort((a, b) => b.updatedAt - a.updatedAt);
  const instList = Object.values(instances).sort((a, b) => b.updatedAt - a.updatedAt);
  const boundTo = (instId: string) => Object.entries(bindings).find(([, i]) => i === instId)?.[0];

  const report = (r: { ok: boolean; persisted: boolean; error?: string }, okMsg: string) => {
    if (!r.ok) toast(r.error ?? '실패', 'error');
    else if (!r.persisted) toast(`이번 실행에만 적용: ${r.error ?? ''}`, 'error');
    else toast(okMsg, 'success');
  };

  return (
    <Section title="저장된 객체 보정값">
      {loadError ? <p className="px-3 pt-2 text-[12px] text-danger">{loadError}</p> : null}
      <div className="px-3 pb-1 pt-2.5 text-[11.5px] font-semibold text-muted">클래스 기본 보정 (같은 종류 전체)</div>
      {classList.length === 0 ? (
        <p className="px-3 pb-2 text-[12px] text-muted">없음</p>
      ) : (
        <ul className="divide-y divide-line">
          {classList.map((c) => (
            <li key={c.id} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">모든 {getClassInfo(c.classId).nameKo}</div>
                  <div className="truncate text-[11px] text-muted">{summarizeValues(c.values)}</div>
                </div>
                <Button className="h-8" onClick={() => setEditing(editing === c.id ? null : c.id)}>
                  수정
                </Button>
                <Button
                  variant="danger"
                  className="h-8"
                  onClick={async () => {
                    if (!confirm(`모든 '${getClassInfo(c.classId).nameKo}' 보정값을 삭제할까요?`)) return;
                    report(await useCalibrationStore.getState().deleteClass(c.classId), '삭제했습니다');
                  }}
                >
                  삭제
                </Button>
              </div>
              {editing === c.id ? (
                <div className="mt-2">
                  <ValuesEditor
                    initial={c.values}
                    onCancel={() => setEditing(null)}
                    onSave={async (v) => {
                      const r = await useCalibrationStore.getState().saveClass(c.classId, v);
                      report(r, '저장했습니다');
                      if (r.ok) setEditing(null);
                    }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-line px-3 pb-1 pt-2.5 text-[11.5px] font-semibold text-muted">
        개별 객체 보정 (특정 물체 전용)
      </div>
      <p className="px-3 pb-1.5 text-[10.5px] leading-snug text-muted">
        추적 ID는 실행할 때마다 바뀌므로 개별 보정은 자동 적용되지 않습니다. 객체를 선택한 뒤 연결하세요.
      </p>
      {instList.length === 0 ? (
        <p className="px-3 pb-2.5 text-[12px] text-muted">없음</p>
      ) : (
        <ul className="divide-y divide-line">
          {instList.map((i) => {
            const bound = boundTo(i.id);
            const canLink = selected && selected.classId === i.classId && !bound && !bindings[selected.id];
            return (
              <li key={i.id} className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">
                      {i.name}
                      <span className="ml-1.5 text-[11px] font-normal text-muted">{getClassInfo(i.classId).nameKo}</span>
                    </div>
                    <div className="truncate text-[11px] text-muted">
                      {bound ? '연결됨 · ' : ''}
                      {summarizeValues(i.values)}
                    </div>
                  </div>
                  {canLink ? (
                    <Button className="h-8" onClick={() => useCalibrationStore.getState().bind(selected.id, i.id)}>
                      {selected.label}에 연결
                    </Button>
                  ) : null}
                  {bound ? (
                    <Button className="h-8" onClick={() => useCalibrationStore.getState().unbind(bound)}>
                      연결 해제
                    </Button>
                  ) : null}
                  <Button className="h-8" onClick={() => setEditing(editing === i.id ? null : i.id)}>
                    수정
                  </Button>
                  <Button
                    variant="danger"
                    className="h-8"
                    onClick={async () => {
                      if (!confirm(`'${i.name}' 보정값을 삭제할까요?`)) return;
                      report(await useCalibrationStore.getState().deleteInstance(i.id), '삭제했습니다');
                    }}
                  >
                    삭제
                  </Button>
                </div>
                {editing === i.id ? (
                  <div className="mt-2 space-y-2">
                    <RenameField
                      initial={i.name}
                      onSave={async (name) => report(await useCalibrationStore.getState().renameInstance(i.id, name), '이름을 바꿨습니다')}
                    />
                    <ValuesEditor
                      initial={i.values}
                      onCancel={() => setEditing(null)}
                      onSave={async (v) => {
                        const r = await useCalibrationStore.getState().saveInstance({
                          trackId: null,
                          instanceId: i.id,
                          classId: i.classId,
                          name: i.name,
                          values: v,
                          cameraKey: i.cameraKey,
                          appearance: i.appearance,
                        });
                        report(r, '저장했습니다');
                        if (r.ok) setEditing(null);
                      }}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function RenameField({ initial, onSave }: { initial: string; onSave: (n: string) => void }) {
  const [name, setName] = useState(initial);
  return (
    <div className="flex gap-2">
      <input
        className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[13px] outline-none focus:border-fg"
        value={name}
        maxLength={40}
        aria-label="보정 이름"
        onChange={(e) => setName(e.target.value)}
      />
      <Button disabled={!name.trim() || name === initial} onClick={() => onSave(name)}>
        이름 변경
      </Button>
    </div>
  );
}
