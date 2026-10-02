export type ClassMeta = {
  ko: string;
  heightM: number;
  widthM: number;
  depthM: number;
  shape: 'person' | 'vehicle' | 'animal' | 'box' | 'round';
};

const common: Record<string, ClassMeta> = {
  person: { ko: '사람', heightM: 1.70, widthM: 0.48, depthM: 0.28, shape: 'person' },
  bicycle: { ko: '자전거', heightM: 1.05, widthM: 1.75, depthM: 0.45, shape: 'vehicle' },
  car: { ko: '자동차', heightM: 1.48, widthM: 1.80, depthM: 4.4, shape: 'vehicle' },
  motorcycle: { ko: '오토바이', heightM: 1.15, widthM: 0.75, depthM: 2.1, shape: 'vehicle' },
  bus: { ko: '버스', heightM: 3.1, widthM: 2.5, depthM: 10.0, shape: 'vehicle' },
  truck: { ko: '트럭', heightM: 3.0, widthM: 2.5, depthM: 7.0, shape: 'vehicle' },
  dog: { ko: '강아지', heightM: 0.55, widthM: 0.8, depthM: 0.35, shape: 'animal' },
  cat: { ko: '고양이', heightM: 0.35, widthM: 0.5, depthM: 0.25, shape: 'animal' },
  chair: { ko: '의자', heightM: 0.85, widthM: 0.5, depthM: 0.5, shape: 'box' },
  couch: { ko: '소파', heightM: 0.85, widthM: 2.0, depthM: 0.9, shape: 'box' },
  'dining table': { ko: '식탁', heightM: 0.75, widthM: 1.4, depthM: 0.8, shape: 'box' },
  tv: { ko: 'TV', heightM: 0.65, widthM: 1.1, depthM: 0.08, shape: 'box' },
  bottle: { ko: '병', heightM: 0.25, widthM: 0.07, depthM: 0.07, shape: 'round' },
  cup: { ko: '컵', heightM: 0.12, widthM: 0.09, depthM: 0.09, shape: 'round' },
  backpack: { ko: '백팩', heightM: 0.45, widthM: 0.32, depthM: 0.18, shape: 'box' },
  umbrella: { ko: '우산', heightM: 0.9, widthM: 0.12, depthM: 0.12, shape: 'round' },
  potted_plant: { ko: '화분', heightM: 0.6, widthM: 0.45, depthM: 0.45, shape: 'round' }
};

export const DEFAULT_META: ClassMeta = { ko: '객체', heightM: 0.6, widthM: 0.6, depthM: 0.6, shape: 'box' };
export function classMeta(className: string): ClassMeta {
  return common[className] ?? DEFAULT_META;
}
