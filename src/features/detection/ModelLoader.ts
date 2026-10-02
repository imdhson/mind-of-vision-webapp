export type ModelId = 'coco-ssd-lite' | 'coco-ssd-mobilenet-v2';
export const MODEL_REGISTRY: Record<ModelId, { label: string; base: 'lite_mobilenet_v2' | 'mobilenet_v2' }> = {
  'coco-ssd-lite': { label: 'COCO-SSD Lite (권장)', base: 'lite_mobilenet_v2' },
  'coco-ssd-mobilenet-v2': { label: 'COCO-SSD MobileNet V2', base: 'mobilenet_v2' }
};
