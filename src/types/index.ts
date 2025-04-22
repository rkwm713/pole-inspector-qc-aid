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
  clientItem?: string;
}

export interface Insulator {
  id: string;
  owner?: string;
  clientItem?: string;
  offset?: {
    unit: string;
    value: number;
  };
}

export interface Equipment {
  id: string;
  owner?: string;
  clientItem?: string;
  attachmentHeight?: {
    unit: string;
    value: number;
  };
}

export interface Guy {
  id: string;
  owner?: string;
  clientItem?: string;
  attachmentHeight?: {
    unit: string;
    value: number;
  };
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
    insulators?: Insulator[];
    equipments?: Equipment[];
    guys?: Guy[];
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

export interface ClientPole {
  aliases: Array<{ id: string }>;
  shape: string;
  materialCategory: string;
  classOfPole: string;
  species: string;
  height: {
    unit: string;
    value: number;
  };
  taper: number;
  density: {
    unit: string;
    value: number;
  };
}

export interface ClientData {
  schema: string;
  version: number;
  name: string;
  poles: ClientPole[];
}

export interface Lead {
  label?: string;
  locations: Location[];
}

// Raw JSON structure for SPIDAcalc data
export interface SPIDAcalcData {
  locations?: Location[];
  poles?: Pole[];
  leads?: Lead[];
  clientData?: ClientData;
  label?: string;
  dateModified?: number;
  clientFile?: string;
  date?: string;
  schema?: string;
  version?: number;
  engineer?: string;
  comments?: string;
  generalLocation?: string;
  address?: {
    number: string;
    street: string;
    city: string;
    county: string;
    state: string;
    zip_code: string;
  };
}
