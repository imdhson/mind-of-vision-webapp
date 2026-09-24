/**
 * 객체 클래스 카탈로그
 *
 * 현재 모델(COCO-SSD)이 실제로 지원하는 80개 COCO 클래스만 정의합니다.
 * 모델을 교체하거나 추가 학습한 모델을 사용할 경우, 새 클래스 ID를 이 카탈로그에 추가하면
 * 거리 추정(크기 사전값)·3D 형상·한국어 이름이 자동으로 연결됩니다.
 *
 * 크기 사전값(prior)은 "일반적인" 실제 크기(m)이며 거리 추정의 기준으로만 사용됩니다.
 * 사용자는 클래스별/개별 보정에서 실제 크기를 직접 입력하여 이 값을 덮어쓸 수 있습니다.
 */

export type ShapeKind =
  | 'person'
  | 'chair'
  | 'couch'
  | 'bed'
  | 'table'
  | 'vehicle'
  | 'twoWheeler'
  | 'animal'
  | 'screen'
  | 'laptop'
  | 'bottle'
  | 'cup'
  | 'flat'
  | 'plant'
  | 'box';

export interface ClassInfo {
  id: string;
  nameKo: string;
  /** 일반적인 실제 크기 (m) */
  prior: { height: number; width: number; depth: number };
  /** 바닥에 놓이는 객체 여부 (바닥 평면 기반 거리 추정에 사용) */
  grounded: boolean;
  shape: ShapeKind;
  /** 이동 방향으로 바라보는 방향을 추정할 수 있는 객체 (사람·동물·탈것) */
  facesMovement: boolean;
  /** 크기 편차가 커서 크기 기반 거리 신뢰도가 낮은 클래스 */
  sizeVaries?: boolean;
}

const c = (
  id: string,
  nameKo: string,
  h: number,
  w: number,
  d: number,
  shape: ShapeKind,
  grounded: boolean,
  facesMovement = false,
  sizeVaries = false,
): ClassInfo => ({
  id,
  nameKo,
  prior: { height: h, width: w, depth: d },
  grounded,
  shape,
  facesMovement,
  sizeVaries,
});

const LIST: ClassInfo[] = [
  c('person', '사람', 1.7, 0.5, 0.3, 'person', true, true),
  c('bicycle', '자전거', 1.05, 1.7, 0.6, 'twoWheeler', true, true),
  c('car', '자동차', 1.5, 4.5, 1.8, 'vehicle', true, true),
  c('motorcycle', '오토바이', 1.2, 2.0, 0.8, 'twoWheeler', true, true),
  c('airplane', '비행기', 12, 35, 35, 'vehicle', false, true, true),
  c('bus', '버스', 3.2, 11, 2.5, 'vehicle', true, true),
  c('train', '기차', 4, 20, 3, 'vehicle', true, true, true),
  c('truck', '트럭', 3.0, 7, 2.5, 'vehicle', true, true, true),
  c('boat', '보트', 1.5, 5, 2, 'vehicle', false, true, true),
  c('traffic light', '신호등', 0.9, 0.35, 0.3, 'box', false),
  c('fire hydrant', '소화전', 0.75, 0.4, 0.4, 'bottle', true),
  c('stop sign', '정지 표지판', 0.75, 0.75, 0.05, 'flat', false),
  c('parking meter', '주차 요금기', 1.4, 0.3, 0.3, 'box', true),
  c('bench', '벤치', 0.85, 1.5, 0.6, 'couch', true),
  c('bird', '새', 0.2, 0.25, 0.15, 'animal', false, true, true),
  c('cat', '고양이', 0.3, 0.45, 0.2, 'animal', true, true),
  c('dog', '강아지', 0.55, 0.75, 0.3, 'animal', true, true, true),
  c('horse', '말', 1.6, 2.2, 0.6, 'animal', true, true),
  c('sheep', '양', 0.9, 1.2, 0.5, 'animal', true, true),
  c('cow', '소', 1.4, 2.2, 0.8, 'animal', true, true),
  c('elephant', '코끼리', 3, 5, 2, 'animal', true, true),
  c('bear', '곰', 1.2, 2, 0.9, 'animal', true, true),
  c('zebra', '얼룩말', 1.4, 2.2, 0.6, 'animal', true, true),
  c('giraffe', '기린', 5, 3, 1, 'animal', true, true),
  c('backpack', '배낭', 0.45, 0.3, 0.2, 'box', false),
  c('umbrella', '우산', 0.9, 1.0, 1.0, 'plant', false, false, true),
  c('handbag', '핸드백', 0.3, 0.35, 0.15, 'box', false, false, true),
  c('tie', '넥타이', 0.45, 0.08, 0.02, 'flat', false),
  c('suitcase', '여행 가방', 0.65, 0.42, 0.25, 'box', true),
  c('frisbee', '원반', 0.03, 0.27, 0.27, 'flat', false),
  c('skis', '스키', 0.1, 1.7, 0.1, 'flat', false),
  c('snowboard', '스노보드', 0.1, 1.5, 0.3, 'flat', false),
  c('sports ball', '공', 0.22, 0.22, 0.22, 'cup', false, false, true),
  c('kite', '연', 0.8, 0.8, 0.1, 'flat', false),
  c('baseball bat', '야구 방망이', 0.85, 0.07, 0.07, 'bottle', false),
  c('baseball glove', '야구 글러브', 0.3, 0.25, 0.1, 'box', false),
  c('skateboard', '스케이트보드', 0.12, 0.8, 0.2, 'flat', true),
  c('surfboard', '서프보드', 0.1, 2, 0.5, 'flat', false),
  c('tennis racket', '테니스 라켓', 0.68, 0.27, 0.03, 'flat', false),
  c('bottle', '병', 0.25, 0.075, 0.075, 'bottle', false),
  c('wine glass', '와인잔', 0.2, 0.08, 0.08, 'cup', false),
  c('cup', '컵', 0.1, 0.085, 0.085, 'cup', false),
  c('fork', '포크', 0.19, 0.025, 0.01, 'flat', false),
  c('knife', '나이프', 0.22, 0.025, 0.01, 'flat', false),
  c('spoon', '숟가락', 0.18, 0.04, 0.01, 'flat', false),
  c('bowl', '그릇', 0.08, 0.16, 0.16, 'cup', false),
  c('banana', '바나나', 0.05, 0.19, 0.04, 'box', false),
  c('apple', '사과', 0.08, 0.08, 0.08, 'cup', false),
  c('sandwich', '샌드위치', 0.06, 0.12, 0.1, 'box', false),
  c('orange', '오렌지', 0.08, 0.08, 0.08, 'cup', false),
  c('broccoli', '브로콜리', 0.15, 0.12, 0.12, 'plant', false),
  c('carrot', '당근', 0.03, 0.18, 0.03, 'bottle', false),
  c('hot dog', '핫도그', 0.05, 0.18, 0.06, 'box', false),
  c('pizza', '피자', 0.03, 0.33, 0.33, 'flat', false),
  c('donut', '도넛', 0.04, 0.09, 0.09, 'cup', false),
  c('cake', '케이크', 0.1, 0.2, 0.2, 'cup', false, false, true),
  c('chair', '의자', 0.9, 0.5, 0.5, 'chair', true),
  c('couch', '소파', 0.85, 2.0, 0.9, 'couch', true, false, true),
  c('potted plant', '화분', 0.5, 0.35, 0.35, 'plant', true, false, true),
  c('bed', '침대', 0.6, 1.6, 2.0, 'bed', true, false, true),
  // COCO에는 "책상" 클래스가 없고 "dining table"이 책상·식탁을 포괄합니다.
  c('dining table', '테이블/책상', 0.75, 1.4, 0.8, 'table', true, false, true),
  c('toilet', '변기', 0.75, 0.4, 0.65, 'chair', true),
  c('tv', 'TV/모니터', 0.45, 0.65, 0.15, 'screen', false, false, true),
  c('laptop', '노트북', 0.22, 0.33, 0.23, 'laptop', false),
  c('mouse', '마우스', 0.04, 0.065, 0.11, 'box', false),
  c('remote', '리모컨', 0.03, 0.05, 0.18, 'box', false),
  c('keyboard', '키보드', 0.03, 0.44, 0.14, 'flat', false),
  c('cell phone', '스마트폰', 0.15, 0.072, 0.008, 'screen', false),
  c('microwave', '전자레인지', 0.3, 0.5, 0.4, 'box', false),
  c('oven', '오븐', 0.6, 0.6, 0.6, 'box', true),
  c('toaster', '토스터', 0.2, 0.28, 0.18, 'box', false),
  c('sink', '싱크대', 0.2, 0.6, 0.45, 'box', false, false, true),
  c('refrigerator', '냉장고', 1.8, 0.8, 0.75, 'box', true),
  c('book', '책', 0.23, 0.16, 0.03, 'flat', false),
  c('clock', '시계', 0.3, 0.3, 0.05, 'flat', false, false, true),
  c('vase', '꽃병', 0.3, 0.12, 0.12, 'bottle', false, false, true),
  c('scissors', '가위', 0.2, 0.08, 0.01, 'flat', false),
  c('teddy bear', '곰 인형', 0.35, 0.25, 0.18, 'animal', false, false, true),
  c('hair drier', '헤어드라이어', 0.25, 0.25, 0.08, 'box', false),
  c('toothbrush', '칫솔', 0.19, 0.02, 0.02, 'bottle', false),
];

const MAP = new Map(LIST.map((i) => [i.id, i]));

const FALLBACK: Omit<ClassInfo, 'id' | 'nameKo'> = {
  prior: { height: 0.5, width: 0.5, depth: 0.5 },
  grounded: false,
  shape: 'box',
  facesMovement: false,
  sizeVaries: true,
};

export function getClassInfo(classId: string): ClassInfo {
  return MAP.get(classId) ?? { id: classId, nameKo: classId, ...FALLBACK };
}

export function isKnownClass(classId: string): boolean {
  return MAP.has(classId);
}

export function allClasses(): readonly ClassInfo[] {
  return LIST;
}
