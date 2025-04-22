
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

export interface PoleLayer {
  layerName: string;
  attachments: PoleAttachment[];
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

export interface ValidationResults {
  validPoles: number;
  invalidPoles: number;
  totalPoles: number;
  poleResults: Record<string, boolean>;
}
