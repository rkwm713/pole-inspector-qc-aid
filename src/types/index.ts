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

export interface Wire {
  id: string;
  description?: string;
  attachmentHeight: {
    unit: string;
    value: number;
  };
  owner?: string;
}

export interface Remedy {
  description: string;
  type: string;
}

export interface GeographicCoordinate {
  type: string;
  coordinates: [number, number]; // [longitude, latitude]
}

export interface Location {
  label: string;
  geographicCoordinate?: GeographicCoordinate;
  designs: Design[];
  remedies?: Remedy[];
}

export interface Design {
  structure: {
    pole: {
      id: string;
      externalId: string;
    };
    wires?: Wire[];
    clearanceCases?: {
      upperId: string;
      lowerId: string;
    }[];
  };
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
