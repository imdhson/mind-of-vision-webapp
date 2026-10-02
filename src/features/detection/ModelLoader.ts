export type ModelId = 'coco-ssd-lite' | 'coco-ssd-mobilenet-v2';
// localPath: 앱과 함께 배포되는 모델(public/models). 없으면 Google Cloud Storage 공식 배포본으로 대체합니다.
export const MODEL_REGISTRY: Record<
  ModelId,
  { label: string; base: 'lite_mobilenet_v2' | 'mobilenet_v2'; localPath: string }
> = {
  'coco-ssd-lite': {
    label: 'COCO-SSD Lite (권장)',
    base: 'lite_mobilenet_v2',
    localPath: 'models/coco-ssd-lite/model.json',
  },
  'coco-ssd-mobilenet-v2': {
    label: 'COCO-SSD MobileNet V2',
    base: 'mobilenet_v2',
    localPath: 'models/coco-ssd-mobilenet-v2/model.json',
  },
};
