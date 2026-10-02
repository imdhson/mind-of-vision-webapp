# Mind of Vision

스마트폰/PC 카메라에서 객체를 실시간 인식·추적하고, 단안 카메라 기반 거리/상대 위치/크기/이동 방향을 추정해 Tesla 스타일의 미니멀 3D 공간으로 보여주는 브라우저 전용 PWA입니다.

## 최신 프로젝트 구성
- React 19 + TypeScript + Vite
- Three.js / React Three Fiber / drei
- TensorFlow.js + COCO-SSD
- zustand
- IndexedDB(idb) 기반 보정값 저장
- vite-plugin-pwa / Workbox
- 브라우저 내부 처리만 사용하며 별도 백엔드나 CUDA/NVIDIA GPU가 필요하지 않습니다.
- WebGL 우선, TensorFlow.js CPU fallback
- 한국어 UI, 시스템 라이트/다크 모드 자동 연동

## 실행
```bash
npm install
npm run dev
```
카메라는 HTTPS 또는 localhost에서만 동작합니다. 스마트폰 실기기 테스트는 HTTPS 개발 서버/HTTPS 정적 호스팅을 사용하세요.

```bash
npm run build
npm run preview
npm test
```

## 모델
앱은 `@tensorflow-models/coco-ssd` 공식 모델을 사용합니다. 첫 모델 로딩에는 인터넷 연결이 필요하며 PWA Workbox가 TensorFlow.js 모델 자산을 런타임 캐시에 저장합니다.

공식 모델 파일 자체를 로컬 폴더에도 보관하려면:
```bash
npm run models:download
npm run models:download -- --all
```
다운로드 위치: `public/models/`

## 주요 동작
- 카메라 권한/시작/중지, 브라우저가 노출하는 다중 카메라 선택
- 초광각/망원/전면/외장 카메라 라벨 휴리스틱 분류
- COCO-SSD 객체 인식
- IoU + 중심 거리 + 속도 기반 객체별 ID 추적
- 객체 크기/FOV/바닥 접점/기울기 기반 단안 거리 추정
- 카메라 기준 3D 좌표 변환
- 이동 중 객체의 이동 방향 추정, 정지 객체는 `미확정`
- 카메라 / 3D 시각화 / 설정 탭을 항상 마운트한 상태로 유지
- 3D 객체 클릭/터치 선택, 카메라 화면 bbox 선택과 선택 상태 공유
- 매우 느린 자동 3D 확대/축소, 드래그 회전/핀치·휠 줌
- 사용자 위치는 텍스트 없이 원형 마커만 표시
- 약한 바닥 격자와 거리 링
- 객체별/클래스별/임시 보정값
- 보정 우선순위: 임시 > 객체 > 클래스 > 기본값
- 보정값 IndexedDB 저장
- 설정의 객체 목록은 2초마다 갱신하며 객체 선택 중에는 갱신을 멈춤
- Wake Lock 지원 브라우저에서 사용 중 화면 꺼짐 방지

## 디렉터리
```text
public/
  icons/
  models/coco-ssd-lite/
  manifest.webmanifest
scripts/
src/
  app/
  components/
  features/
  hooks/
  stores/
  styles/
  types/
  utils/
tests/
  unit/
  e2e/
```

## 제한사항
단안 카메라 거리 추정은 실제 LiDAR/스테레오 깊이 센서처럼 절대 정확하지 않습니다. 객체의 실제 크기 차이, 화면 가장자리 왜곡, 카메라 FOV 오차에 따라 편차가 날 수 있으므로 실제 거리/크기 보정 기능을 함께 사용하세요. COCO-SSD만으로는 정지 객체의 실제 바라보는 방향을 신뢰성 있게 판정할 수 없어 이동 중 방향을 우선 사용하고 정지 시에는 `미확정`으로 표시합니다.

## 배포
`npm run build` 후 생성되는 `dist/`를 HTTPS 정적 호스팅에 배포하면 됩니다. `base: './'`로 구성되어 하위 경로 배포도 지원합니다.
