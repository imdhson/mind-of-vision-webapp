# Mind of Vision

스마트폰·PC 카메라로 주변의 일상 객체를 **실시간으로 인식·추적**하고, 객체의 **거리·위치·크기·방향을 추정**해
Tesla 차량의 주변 환경 시각화와 비슷한 **미니멀 3D 공간**에 표시하는 웹앱(PWA)입니다.
인식된 객체를 선택해 상세정보를 보고, 실제 측정값으로 **보정값을 입력·저장**할 수 있습니다.

- 브라우저 안에서 모든 처리가 이루어집니다. **백엔드·GPU 서버·CUDA·NVIDIA GPU가 필요 없습니다.**
- AMD/Intel 내장 그래픽, 모바일 GPU에서 WebGL 로 동작하며, WebGL 이 없으면 CPU 로 대체 실행합니다.
- UI 언어는 한국어이며 시스템 라이트/다크 모드를 자동으로 따릅니다.

---

## 1. 주요 기능

| 영역 | 기능 |
| --- | --- |
| 카메라 | 권한 요청, 시작/종료, 전면·후면 전환, 연결된 카메라·렌즈 검색 및 선택, 장치 연결/해제 감지, 전환 실패 시 이전 카메라 복구, 장치 제공 줌 |
| 객체 인식 | TensorFlow.js COCO-SSD(사전 학습, 80종: 사람·의자·소파·침대·테이블/책상·TV/모니터·노트북·키보드·마우스·스마트폰·컵·병·책·자동차·자전거·강아지·고양이·가방 등) |
| 추적 | 같은 종류 여러 개를 개별 ID로 추적(IoU + 중심거리 + 등속 예측 + 색상 외형), 가림 유예 기간, 추적 종료 정리 |
| 거리·좌표 | 단안 거리 추정(객체 크기 사전값 × 카메라 화각 + 바닥 접지점 + 기기 기울기), 카메라→3D 좌표 변환, 크기 추정 |
| 방향 | 이동 방향(속도 회귀)과 바라보는 방향을 구분. 사람·동물·탈것은 이동 시 진행 방향으로 추정, 정지 물체는 "미확인" + 사용자 지정 |
| 3D 시각화 | 미니멀 3D 공간, 원형 사용자 마커(텍스트 없음), 연한 바닥 격자·거리 링, 객체 종류별 형상, 회전·확대·핀치, 기본 시점 복귀, **매우 느린 자동 확대·축소**, 3D 객체 클릭/터치 선택(Raycasting) |
| 선택·상세 | 카메라·3D·목록 3개 탭이 하나의 선택 상태 공유. ID·이름·클래스·신뢰도·추정/보정 거리·3D 좌표·크기·방향·이동 상태·적용 보정값 |
| 보정 | 실제 거리·거리 보정값·실제 크기(높이/너비)·X/Y/Z 위치·방향 보정. 범위 3종(임시/개별/클래스) + 카메라(렌즈)별 보정. IndexedDB 영속 저장 |
| 앱 | 3개 하단 탭, 얇은 헤더, PWA 설치·오프라인 캐싱(모델 포함), 화면 꺼짐 방지(Wake Lock) |

---

## 2. 시스템 구조

```
카메라 장치 검색·선택 (CameraDeviceService)
  → MediaStream 수명 관리 (CameraManager, 스트림 세대 번호)
  → AI 객체 인식 (ObjectDetector: COCO-SSD / WebGL→CPU)
  → 객체별 ID 부여·추적 (ObjectTracker)
  → 거리·크기 추정 (DistanceEstimator) + 카메라 내부 파라미터 (CameraCalibration)
  → 보정값 합성 (CalibrationManager: 임시 > 개별 > 클래스) + 카메라 프로파일
  → 카메라 좌표 → 3D 좌표 (CoordinateTransformer)
  → 방향 추정 (OrientationEstimator)
  → 공통 객체 상태 (zustand objectStore) ─┬─ 카메라 화면 (Canvas 오버레이)
                                          ├─ 3D 시각화 (React Three Fiber)
                                          └─ 설정
  → 선택·상세 → 보정 입력(미리보기) → 저장(IndexedDB) → 즉시 재계산
```

- **추론 루프와 렌더링 분리**: `VisionPipeline` 은 이전 추론이 끝나야 다음 추론을 시작하는 비동기 루프입니다(최대 약 14회/초).
  카메라 오버레이와 3D 는 `requestAnimationFrame`/`useFrame` 으로 60fps 보간하므로 추론이 느려도 화면이 끊기지 않습니다.
- **오래된 결과 폐기**: 카메라 전환·해상도 변경 시 스트림 세대 번호가 증가하고, 이전 세대의 추론 결과는 버립니다.
- **보정 즉시 반영**: 보정값/카메라 설정이 바뀌면 추론을 기다리지 않고 마지막 추적 결과로 즉시 재계산합니다.
- 세 탭은 항상 마운트된 상태로 표시만 전환하므로, 탭 이동 시 카메라·추적·3D 상태가 초기화되지 않습니다.
  비활성 3D 탭은 렌더링을 멈춰(frameloop=never) GPU·배터리를 아낍니다.

### 좌표계와 단위 (`src/types/index.ts`)

| 좌표계 | 원점 | 축 | 단위 |
| --- | --- | --- | --- |
| 영상 | 좌상단 | x 오른쪽, y 아래 (0..1 정규화) | – |
| 카메라 | 광학 중심 | x 오른쪽, y 아래, z 전방 | m |
| 3D 시각화 | 사용자 발밑 바닥 | X 오른쪽, Y 위(바닥=0), **−Z 전방** | m |
| 방향(yaw) | – | Y축 회전, 0 = 사용자 쪽을 바라봄, +90° = 오른쪽 | rad(내부) / °(입력) |

3D 좌표는 **카메라 기준 상대 위치**입니다. 카메라 자체의 이동(자기 위치)은 추적하지 않으므로 절대 월드 좌표가 아닙니다.

### 디렉터리

```
public/
  icons/                 앱 아이콘 (scripts/generate-icons.mjs 로 생성)
  models/coco-ssd-lite/  기본 객체 인식 모델 (저장소에 포함, 약 18MB)
  manifest.webmanifest
scripts/
  download-models.mjs    모델 다운로드 (--all: 고정확도 모델 포함)
  generate-icons.mjs     PNG 아이콘 생성 (의존성 없음)
src/
  app/                   App 레이아웃, AppRuntime(초기화·Wake Lock)
  components/
    common/              헤더, 하단 탭, 버튼·입력 등 UI
    camera/              카메라 탭, 인식 오버레이, 카메라/렌즈 조작
    vision/              3D 시각화 탭
    objects/             설정 탭, 상세정보, 선택 객체 시트, 앱 설정
    calibration/         보정 입력 패널, 카메라 설정, 저장값 관리, 개별 보정 연결
  features/
    camera/              CameraManager, CameraDeviceService, CameraCalibration
    detection/           ObjectDetector, ModelLoader, classCatalog(클래스·크기 사전값)
    tracking/            ObjectTracker
    depth/               DistanceEstimator, CoordinateTransformer
    orientation/         OrientationEstimator
    calibration/         CalibrationManager(규칙·검증), CalibrationStorage(IndexedDB)
    pipeline/            VisionPipeline, objectBuilder
    visualization/       VisionScene, ObjectRenderer, UserMarker, shapes, AutoCameraController
  hooks/ stores/ services/ types/ utils/ styles/
tests/
  unit/                  Vitest 단위 테스트
  e2e/smoke.mjs          실제 Chromium + 모델 + 가짜 카메라 영상 E2E 테스트
```

---

## 3. 사용 기술

React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · Three.js / React Three Fiber / drei · TensorFlow.js(WebGL, CPU) +
COCO-SSD · zustand · IndexedDB(idb) · MediaDevices/MediaStream · DeviceOrientation · Screen Wake Lock ·
vite-plugin-pwa(Workbox) · Vitest · Playwright(E2E)

---

## 4. 개발 환경 요구사항

- **Node.js 20.19 이상** (22 LTS 권장) 및 npm 10 이상
- 최신 브라우저: Chrome/Edge 113+, Safari 16.4+(iOS 16.4+), Firefox 115+, Samsung Internet 21+
- 카메라(스마트폰 카메라, 노트북 내장 카메라, USB 웹캠 등)
- 별도의 GPU 서버·CUDA 불필요. Windows 11 + AMD 내장 그래픽에서 WebGL 로 동작합니다.

환경 변수나 비밀키는 필요하지 않습니다(`.env.example` 참고).

---

## 5. 설치 및 실행

```bash
# 1) 의존성 설치
npm install

# 2) (선택) 모델 파일 확인/다운로드 — 기본 모델은 저장소에 포함되어 있어 보통 필요 없음
npm run models:download          # coco-ssd-lite 가 없으면 받음
npm run models:download -- --all # 고정확도 mobilenet_v2(약 65MB)도 받음

# 3) 로컬 개발 서버 (http://localhost:5173)
npm run dev
```

PC 에서 `http://localhost:5173` 을 열고 **카메라 시작**을 누르면 됩니다(localhost 는 보안 컨텍스트로 취급되어 카메라 사용 가능).

### 스마트폰에서 테스트 (HTTPS 필요)

스마트폰에서 PC 의 LAN IP(`http://192.168.x.x:5173`)로 접속하면 **HTTP 라서 카메라가 차단**됩니다. 다음 중 하나를 사용하세요.

```bash
# 자체 서명 인증서로 HTTPS 개발 서버 (같은 Wi-Fi 에서 https://<PC IP>:5173 접속)
npm run dev:https
```

브라우저의 "안전하지 않음" 경고에서 "고급 → 계속"을 선택하면 됩니다. 인증서 경고 없이 쓰려면 빌드 결과물을 HTTPS 호스팅
(GitHub Pages, Netlify, Vercel, Cloudflare Pages 등)에 올리거나 `cloudflared`/`ngrok` 같은 HTTPS 터널을 사용하세요.

### 프로덕션 빌드

```bash
npm run build     # 타입 검사 + dist/ 생성 (Service Worker 포함)
npm run preview   # http://localhost:4173 에서 빌드 결과 확인 (--host 로 LAN 공개)
```

`dist/` 폴더를 정적 파일로 어떤 웹 서버에나 배포할 수 있습니다(`base: './'` 이므로 하위 경로 배포 가능).
PWA·카메라를 위해 **반드시 HTTPS 로 배포**하세요.

### GitHub Pages 자동 배포

`.github/workflows/deploy-pages.yml` 이 기본 브랜치에 push 될 때마다 테스트·빌드 후 GitHub Pages(HTTPS)에 배포합니다.

1. 저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 설정 (최초 1회)
2. **Actions** 탭에서 "Deploy to GitHub Pages" 를 다시 실행하거나 새 커밋을 push
3. 배포 주소: `https://<사용자명>.github.io/<저장소명>/` — 스마트폰에서 바로 카메라 사용 가능

비공개 저장소에서 Pages 를 쓰려면 GitHub Pro/Team 요금제가 필요합니다. 무료 계정이면 저장소를 공개로 바꾸거나
`dist/` 를 Netlify Drop(https://app.netlify.com/drop) 등에 끌어다 놓아 배포할 수 있습니다.

---

## 6. 객체 인식 모델

| ID | 모델 | 크기 | 위치 |
| --- | --- | --- | --- |
| `coco-ssd-lite` (기본) | SSDLite MobileNet v2 (COCO 80종) | 약 18MB | `public/models/coco-ssd-lite/` — **저장소에 포함** |
| `coco-ssd-mobilenet-v2` | SSD MobileNet v2 | 약 65MB | `npm run models:download -- --all` 로 받음 (저장소 미포함) |

- 앱은 먼저 `public/models/<id>/model.json` 을 찾고, 없으면 Google Cloud Storage 의 공식 배포본
  (`https://storage.googleapis.com/tfjs-models/savedmodel/...`)을 자동으로 사용합니다.
- 한 번 불러온 모델은 Service Worker 가 캐시하므로 이후에는 **오프라인에서도** 인식이 동작합니다.
- 모델은 설정 탭 → **AI 모델**에서 바꿀 수 있습니다.
- 모델을 교체/추가하려면 `src/features/detection/ModelLoader.ts` 의 `MODEL_REGISTRY` 와 `ObjectDetector` 구현을 추가하고,
  새 클래스는 `classCatalog.ts` 에 한국어 이름·크기 사전값·형상을 등록합니다.

---

## 7. 카메라 권한 및 HTTPS

- 카메라(getUserMedia)는 **HTTPS 또는 localhost** 에서만 동작합니다. HTTP 에서는 "HTTPS 또는 localhost 에서만 사용할 수 있습니다" 안내가 표시됩니다.
- 권한을 거부했다면 브라우저 주소창의 사이트 설정에서 카메라를 허용한 뒤 **다시 시도**를 누르세요.
- 이미 권한을 허용한 경우 앱을 열면 카메라가 자동으로 시작됩니다.
- iOS 에서는 기울기 센서 권한도 카메라 시작 버튼을 누를 때 함께 요청합니다(거부해도 동작하며 기본 기울기를 사용).

### 렌즈 선택

카메라 화면 오른쪽 위 **렌즈 버튼**을 누르면 브라우저가 제공하는 카메라 장치가 모두 표시됩니다.
장치명에서 초광각/망원/전면/외장을 판별할 수 있으면 한국어로, 판별할 수 없으면 **실제 장치명**을 그대로 보여줍니다.
브라우저가 초광각·망원 렌즈를 별도 장치로 제공하지 않으면 선택할 수 없으며, 존재하지 않는 렌즈를 임의로 표시하지 않습니다.
장치가 줌을 지원하면 같은 메뉴에 **줌** 슬라이더가 나타납니다(물리 렌즈 전환 여부는 기기가 결정).

---

## 8. 객체별 보정값 사용 방법

1. 카메라 화면에서 객체 상자를 누르거나, 3D 화면에서 도형을 누르거나, 설정 탭 목록에서 항목을 누릅니다.
2. 하단 시트에서 **보정**을 누릅니다.
3. 저장 범위를 선택합니다.
   - **이 객체 · 임시**: 지금 추적 중인 이 객체에만 적용, 저장하지 않음(추적이 끝나면 사라짐)
   - **이 객체 · 저장**: 이 물체 전용 보정값을 저장. 추적 ID 는 일시적이므로 **앱을 다시 실행하면 자동 적용되지 않고**,
     객체를 선택한 뒤 "저장된 개별 보정 연결"에서 직접 연결해야 합니다(색상 외형 유사도를 참고로 표시).
   - **모든 ○○**: 같은 종류 전체(예: 모든 컵)의 기본 보정값으로 저장
4. 값을 입력하면 **미리보기**로 즉시 반영되고(저장 전 표시), **저장/적용**을 눌러야 확정됩니다.

| 항목 | 단위 | 범위 | 적용 방식 |
| --- | --- | --- | --- |
| 실제 거리 | m (cm 입력 가능) | 0.1 ~ 100 | 입력 순간의 원본 추정 거리와의 **비율**로 저장 → 객체가 움직여도 비율 유지. **설정 시 실제 크기·거리 보정값은 거리 계산에 쓰지 않음(중복 적용 방지)** |
| 거리 보정값 | m | −20 ~ 20 | 추정 거리에 더함 (실제 거리가 없을 때만) |
| 실제 높이 / 너비 | m | 0.01 ~ 50 | 거리 추정의 입력값(클래스 사전 크기 대신 사용). 실제 거리가 없을 때만 |
| X / Y / Z 축 보정 | m | −20 ~ 20 | 3D 위치에 더함 (X 오른쪽+, Y 위+, Z 사용자 쪽+) |
| 방향 보정 | ° | −180 ~ 180 | 추정 방향에 더함. 방향 미확인 객체는 이 값이 방향이 됨 (0° = 사용자 쪽) |

- **범위 우선순위**(필드 단위 덮어쓰기, 합산 없음): 임시 > 개별 > 클래스 > 기본값
- **거리 계산 우선순위**: 실제 거리 > (실제 크기로 다시 추정 + 거리 보정값). 예: 개별 보정에 실제 거리, 클래스 보정에 실제 높이가 있으면 실제 거리만 거리에 반영됩니다.
- 바닥에 놓이는 종류(사람·가구·동물·탈것 등)는 3D 에서 바닥 위에 선 것으로 배치합니다(Y 축 보정으로 조정 가능).
- 보정 전/후 값은 항상 구분되어 표시됩니다(“추정 → 보정”).
- 유효하지 않은 값은 저장 버튼이 비활성화되며 기존 저장값을 변경하지 않습니다.
- **초기화**는 선택한 범위의 해당 객체(또는 해당 클래스) 설정만 지웁니다.
- 설정 탭 → **저장된 객체 보정값**에서 모든 저장값을 조회·수정·삭제할 수 있습니다.

### 카메라(렌즈)별 보정

설정 탭 → **카메라 설정 · 보정**에서 현재 카메라의 화각(또는 35mm 환산 초점거리), 카메라 높이, 거리 추정 기준 배율,
기본 기울기, 기울기 센서 사용 여부를 설정합니다. 값은 **카메라 장치별로 따로 저장**되므로 광각/초광각 설정이 섞이지 않습니다.
정확도를 높이려면 기기의 실제 화각(제조사 사양의 35mm 환산 초점거리)과 카메라를 드는 높이를 입력하세요.

---

## 9. PWA 설치

- **Android(Chrome/삼성 인터넷)**: 메뉴 → "앱 설치" 또는 "홈 화면에 추가". 설정 탭 → 앱 → "홈 화면에 앱 설치" 버튼도 지원.
- **iOS(Safari)**: 공유 버튼 → "홈 화면에 추가".
- **Windows/macOS(Chrome/Edge)**: 주소창 오른쪽 설치 아이콘.

설치 후에는 독립 실행형 앱으로 열리며, 앱 셸·아이콘·(한 번 불러온) 모델이 캐시되어 오프라인에서도 실행됩니다.
보정값은 IndexedDB 에 저장되어 재실행 후에도 유지됩니다. 카메라를 사용하는 동안에는 가능한 경우 화면 꺼짐 방지가 활성화됩니다.

---

## 10. 지원 브라우저 및 알려진 제한사항

| 항목 | 지원 |
| --- | --- |
| Chrome / Edge (Windows, macOS, Android) | 전체 기능 |
| Safari (iOS 16.4+, macOS) | 전체 기능. Wake Lock 은 iOS 16.4+ / Safari 16.4+ |
| Firefox | 동작. Wake Lock 은 Firefox 126+, 설치(PWA)는 데스크톱에서 제한적 |
| Samsung Internet | 동작 |

**제한사항 (정직하게 명시)**

- **단안 거리 추정은 근사치**입니다. 객체의 일반적인 크기·카메라 화각·카메라 높이·바닥 접지점을 조합하지만,
  크기 편차가 큰 객체(강아지, 소파, 테이블 등)나 화면 가장자리에서 잘린 객체는 오차가 큽니다. 실제 거리 보정으로 개선하세요.
  (거리 신뢰도와 사용한 단서는 상세정보에 표시됩니다.)
- **정지한 물체의 바라보는 방향은 추정하지 않습니다.** 외형만으로 방향을 판단하는 모델이 포함되어 있지 않아 "미확인"으로
  표시하며, 방향 보정으로 직접 지정할 수 있습니다. 사람·동물·탈것은 이동할 때만 진행 방향으로 추정합니다.
  (자세 추정 모델(MoveNet 등)의 공식 배포처가 이 개발 환경에서 차단되어 포함하지 못했습니다. `OrientationEstimator` 에 확장 지점이 있습니다.)
- **카메라 자기 위치 추적(SLAM/WebXR)은 지원하지 않습니다.** 3D 공간은 카메라 기준 상대 좌표이며, 휴대폰을 돌리면 공간도 함께 돌아갑니다.
- **렌즈 제어는 브라우저가 노출하는 장치에 한정**됩니다. 많은 Android 브라우저는 후면 카메라를 1~2개만 노출합니다.
- **기울기 보정**은 피치(앞뒤 기울기)만 반영하며 롤(좌우 기울임)은 반영하지 않습니다.
- COCO 에는 "책상" 클래스가 없어 책상·식탁은 **테이블/책상**(dining table)으로 인식됩니다. "모니터"는 **TV/모니터**(tv)입니다.
- WebGL 이 없는 환경에서는 CPU 로 추론하므로 매우 느리고, 3D 탭은 표시되지 않습니다(설정 탭 목록으로 확인 가능).
- WebGPU 백엔드는 포함하지 않았습니다(WebGL 이 AMD 내장 그래픽을 포함한 대부분의 기기에서 가장 안정적).

---

## 11. 테스트

```bash
npm test            # 단위 테스트 (Vitest + jsdom + fake-indexeddb)
npm run typecheck   # TypeScript 타입 검사
npm run build && npm run test:e2e   # E2E (Chromium + 실제 모델 + 가짜 카메라 영상)
```

**단위 테스트** (`tests/unit`): 추적기(ID 유지, 동일 클래스 구분, 교차 클래스 매칭 금지, 유예/종료), 거리 추정(핀홀,
실제 크기, 바닥 접지, 잘림, 배율), 보정 우선순위(실측 > 오프셋), 좌표 변환(피치 포함 왕복), 보정 합성·검증,
IndexedDB 영속성(재실행 시뮬레이션, 자동 연결 금지, 잘못된 값 차단, 카메라별 독립), 자동 확대·축소(지연·최대 변화율·
히스테리시스·유지), 방향 추정(이동/정지/잡음/사용자 지정), 렌즈 판별, 기울기 계산.

**E2E** (`tests/e2e/smoke.mjs`): Chromium 가짜 카메라에 실제 사진(강아지 2마리)을 넣고 실제 COCO-SSD 로
카메라 시작 → 인식 → 동일 클래스 2개 개별 ID → 거리/좌표 → 카메라 화면 클릭 선택 → 실제 거리 보정 저장·반영 →
잘못된 값 차단 → 3D 탭 선택 동기화 → 3D 객체 클릭 선택(기본/회전·확대 후) → 자동 확대·축소 해제/재개 →
설정 탭 → 새로고침 후 보정값 유지·자동 연결 안 함 → Service Worker·Manifest → 다크 모드 → 모바일(터치 선택,
얇은 헤더/탭) → 카메라 종료 정리를 검증하고 `tests/e2e/output/*.png` 스크린샷을 남깁니다.
테스트 이미지는 처음 실행 시 tfjs-models 저장소에서 내려받습니다. `CHROMIUM_PATH` 로 브라우저 경로를 지정할 수 있습니다.

### 수동 테스트 절차 (실제 기기 필요)

| # | 절차 | 기대 결과 |
| --- | --- | --- |
| 1 | PC(Windows 11, AMD 내장 그래픽)에서 `npm run dev` → Chrome 으로 접속 → 카메라 시작 | 영상 표시, 헤더에 "N개 · fps", 설정 탭의 연산 백엔드 `webgl` |
| 2 | 스마트폰으로 HTTPS 주소 접속 → 권한 허용 | 후면 카메라로 시작 |
| 3 | 전환 버튼 | 전면↔후면 전환, 인식 계속, 이전 스트림 종료(카메라 표시등 1개) |
| 4 | 렌즈 버튼 | 브라우저가 제공하는 장치만 표시, 선택 시 전환·인식 계속, 해당 카메라 보정값 적용 |
| 5 | USB 웹캠 연결/해제 | 목록 갱신, 사용 중 장치 해제 시 안내 후 다른 카메라로 복구 |
| 6 | 컵을 누르고 줄자로 잰 거리를 "실제 거리"로 저장 | 보정 거리 = 입력값, 3D 위치 갱신, 컵을 옮겨도 비율 유지 |
| 7 | 새로고침 / 설치된 앱 재실행 | 클래스·카메라 보정 유지, 개별 보정은 "연결" 후 적용 |
| 8 | 3D 탭에서 회전·핀치 후 객체 터치 | 정확히 선택되고 상세정보 표시 |
| 9 | 3D 탭 "기본 시점" | 부드럽게 복귀, 이후 객체 분포에 따라 매우 느리게 확대·축소 |
| 10 | 카메라 사용 중 수 분 대기 | 화면이 꺼지지 않음(Wake Lock 지원 브라우저). 카메라 종료 시 해제 |
| 11 | OS 다크 모드 전환 | 앱·3D 테마 즉시 전환, 격자는 연하게 유지 |
| 12 | 비행기 모드에서 설치된 PWA 실행 | 앱 실행·인식 동작(모델이 한 번 캐시된 후) |

---

## 12. 라이선스 및 출처

- COCO-SSD 모델: TensorFlow.js Models (Apache License 2.0), `public/models/coco-ssd-lite` 에 원본 그대로 포함
- 이 저장소에는 비밀키·개인 인증정보가 포함되어 있지 않습니다.
