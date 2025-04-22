// SPIDAcalc Data Types

export interface PoleAttachment {
  id?: string;
  description: string;
  owner: string;
  height: {
    value: number;
    unit: string;
  };
  assemblyUnit: string;
  isValid?: boolean;
}

export interface WireEndPoint {
  direction: string;
  distance: number;
  wireType: string;
  connectionId?: string;
}

export interface PoleDetails {
  owner: string;
  glc?: number;  // Ground Line Circumference
  agl?: number;  // Above Ground Length
  poleType?: string;
}

export interface PoleLayer {
  layerName: string;
  layerType: 'Measured' | 'Theoretical' | 'Recommended';
  attachments: PoleAttachment[];
  wireEndPoints?: WireEndPoint[];
  poleDetails?: PoleDetails;
}

export interface ValidationResults {
  validPoles: number;
  invalidPoles: number;
  totalPoles: number;
  poleResults: Record<string, boolean>;
}

export interface Pole {
  structureId: string;
  alias?: string;
  id?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  layers: Record<string, PoleLayer>;
}
