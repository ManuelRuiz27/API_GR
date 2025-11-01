export interface ElementPosition {
  x: number;
  y: number;
}

export interface ElementSize {
  width: number;
  height: number;
}

export interface ElementConfig {
  id: string;
  type: string;
  label?: string;
  iconId?: string;
  position: ElementPosition;
  size: ElementSize;
  rotation?: number;
  capacity?: number;
  metadata?: Record<string, unknown>;
}
