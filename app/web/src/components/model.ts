export interface Annotation {
  type: 'line' | 'box';
  xMin: number;
  xMax: number;
  yMin?: number;
  yMax?: number;
  borderColor?: string;
  borderWidth?: number;
  backgroundColor?: string;
  label?: {
    content: string;
    enabled?: boolean;
    position?: 'start' | 'end' | 'center';
  };
  [key: string]: any;
}