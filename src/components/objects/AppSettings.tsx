import { useState } from 'react';
import { MODEL_REGISTRY } from '../../features/detection/ModelLoader';
import { allClasses } from '../../features/detection/classCatalog';
import { useCalibrationStore } from '../../stores/calibrationStore';
import { useObjectStore } from '../../stores/objectStore';
import { useUIStore } from '../../stores/uiStore';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { Button, Row, Section, cx } from '../common/ui';

/** AI 모델 · 앱 설치 · 데이터 관리 · 도움말 */
export function AppSettings() {
  const modelId = useUIStore((s) => s.modelId);
  const setModelId = useUIStore((s) => s.setModelId);
  const stats = useObjectStore((s) => s.stats);
  const detectorStatus = useObjectStore((s) => s.detectorStatus);
  const detectorMessage = useObjectStore((s) => s.detectorMessage);
  const install = useInstallPrompt();
  const [help, setHelp] = useState(false);
  const [classes, setClasses] = useState(false);

  return (
    <>
      <Section title="AI 모델">
        <div className="space-y-1 p-3">
          {MODEL_REGISTRY.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModelId(m.id)}
              className={cx(
                'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left',
                modelId === m.id ? 'border-fg' : 'border-line',
              )}
            >
              <span>
                <span className="block text-[13px] font-medium">{m.name}</span>
                <span className="block text-[11px] text-muted">
                  {m.description} · 약 {m.approxSizeMB}MB
                </span>
              </span>
              {modelId === m.id ? <span className="text-[11px] font-semibold">사용 중</span> : null}
            </button>
          ))}
          <div className="pt-1">
            <Row k="상태" v={detectorStatus === 'ready' ? '준비됨' : detectorStatus === 'loading' ? '불러오는 중' : detectorStatus === 'error' ? '오류' : '대기'} sub={detectorMessage ?? undefined} />
            <Row k="연산 백엔드" v={stats.backend ?? '—'} sub={stats.backend === 'cpu' ? 'GPU 미사용(느림)' : undefined} />
            <Row k="평균 추론 시간" v={stats.inferenceMs ? `${stats.inferenceMs.toFixed(0)} ms` : '—'} />
            <Row k="인식 주기" v={stats.detectionFps ? `${stats.detectionFps.toFixed(1)} 회/초` : '—'} />
          </div>
          <button type="button" className="text-[12px] text-muted underline" onClick={() => setClasses((v) => !v)}>
            인식 가능한 객체 {allClasses().length}종 {classes ? '접기' : '보기'}
          </button>
          {classes ? (
            <p className="text-[11.5px] leading-relaxed text-muted">{allClasses().map((c) => c.nameKo).join(', ')}</p>
          ) : null}
        </div>
      </Section>

      <Section title="앱">
        <div className="space-y-2 p-3">
          {install.installed ? (
            <Row k="설치 상태" v="앱으로 실행 중" />
          ) : install.canPrompt ? (
            <Button variant="primary" className="w-full" onClick={() => void install.prompt()}>
              홈 화면에 앱 설치
            </Button>
          ) : (
            <p className="text-[12px] text-muted">
              {install.isIOS
                ? 'Safari 공유 버튼 → "홈 화면에 추가"로 설치할 수 있습니다.'
                : '브라우저 메뉴의 "앱 설치" 또는 "홈 화면에 추가"로 설치할 수 있습니다.'}
            </p>
          )}
          <Button variant="outline" className="w-full" onClick={() => setHelp((v) => !v)}>
            {help ? '도움말 닫기' : '사용법 및 제한사항'}
          </Button>
          {help ? <Help /> : null}
          <Button
            variant="danger"
            className="w-full"
            onClick={async () => {
              if (!confirm('저장된 모든 카메라·객체 보정값을 삭제할까요? 되돌릴 수 없습니다.')) return;
              const r = await useCalibrationStore.getState().clearAll();
              useUIStore.getState().toast(r.persisted ? '모든 보정값을 삭제했습니다' : (r.error ?? '삭제 실패'), r.persisted ? 'success' : 'error');
            }}
          >
            모든 보정값 삭제
          </Button>
        </div>
      </Section>
    </>
  );
}

function Help() {
  return (
    <div className="space-y-2 rounded-lg bg-surface-2 p-3 text-[12px] leading-relaxed">
      <p>
        <b>객체 선택</b> · 카메라 화면의 상자나 3D 화면의 도형을 누르면 선택됩니다. 선택은 세 탭에서 공유됩니다.
      </p>
      <p>
        <b>보정</b> · 선택 후 "보정"에서 실제 거리(줄자로 잰 카메라→객체 거리) 등을 입력합니다. 실제 거리는 입력 순간의
        추정값과의 비율로 저장되어, 객체가 움직여도 비율이 유지됩니다.
      </p>
      <p>
        <b>저장 범위</b> · 임시(이번 추적만), 개별(이 물체 전용, 재실행 후 수동 연결), 클래스(같은 종류 전체). 우선순위는
        임시 &gt; 개별 &gt; 클래스입니다.
      </p>
      <p>
        <b>거리 추정의 한계</b> · 단일 카메라로는 절대 거리를 정확히 알 수 없습니다. 객체의 일반적인 크기, 카메라 화각,
        카메라 높이와 바닥 접지점을 조합한 추정값이며, 크기 편차가 큰 객체(강아지, 소파 등)는 오차가 큽니다.
      </p>
      <p>
        <b>방향</b> · 사람·동물·탈것은 이동할 때 이동 방향을 바라보는 방향으로 추정합니다. 정지한 물체의 방향은 알 수 없어
        "미확인"으로 표시되며, 방향 보정으로 직접 지정할 수 있습니다.
      </p>
      <p>
        <b>좌표</b> · 3D 공간은 카메라 기준 상대 좌표입니다. 휴대폰을 움직이거나 돌리면 공간도 함께 바뀝니다(자기 위치
        추적 미지원).
      </p>
      <p>
        <b>렌즈</b> · 브라우저가 초광각·망원 렌즈를 별도 장치로 제공하는 경우에만 선택할 수 있습니다.
      </p>
    </div>
  );
}
