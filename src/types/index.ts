// SPIDAcalc Data Types

export type QCCheckStatus = "PASS" | "FAIL" | "WARNING" | "NOT_CHECKED";

export interface PoleAttachment {
  id?: string;
  externalId?: string;
  description: string;
  owner: {
    id: string;
    industry?: string;
  };
  type?: string; 
  clientItemAlias?: string;
  model?: string;
  size?: string;
  height: {
    value: number;
    unit: string;
  };
  heightInFeet?: string; // Calculated value in feet and inches
  bearing?: number;
  assemblyUnit: string;
  attachmentType?: "COMMUNICATION" | "POWER" | "EQUIPMENT" | "ANCHOR" | "GUY" | "INSULATOR" | "OTHER";
  qcIssues?: string[];
}

export interface PoleWire {
  id?: string;
  externalId?: string;
  owner: {
    id: string;
    industry?: string;
  };
  attachmentHeight?: {
    value: number;
    unit: string;
  };
  size?: string;
  type?: string;
  tension?: number;
  clientItem?: {
    size?: string;
    type?: string;
  };
  associatedAttachments?: string[]; // IDs of related attachments
  usageGroup?: string; // E.g., "UTILITY_SERVICE", "COMMUNICATION_SERVICE", etc.
}

export interface WireEndPoint {
  id?: string;
  externalId?: string;
  direction: number; // Direction in degrees
  distance: {
    value: number;
    unit: string;
  };
  relativeElevation?: {
    value: number;
    unit: string;
  };
  type?: string;
  wires: string[]; // Wire IDs connected to this WEP
  connectionId?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  environment?: string; // The environment field from original data
  environmentStatus?: 'E' | 'NE'; // Entered (E) or Not Entered (NE)
}

export interface RemedyItem {
  description: string;
}

export interface PoleProperties {
  clientItemAlias?: string;
  species?: string;
  class?: string;
  length?: number;
  glc?: {
    value: number;
    unit: string;
  };
  agl?: {
    value: number;
    unit: string;
  };
  remedies?: RemedyItem[];
  environment?: string; // Added environment field
}

export interface ClearanceResult {
  id?: string;
  clearanceRuleName: string;
  status: "PASSING" | "FAILING" | "UNKNOWN";
  distance?: {
    value: number;
    unit: string;
  };
  required?: {
    value: number;
    unit: string;
  };
  actualDistance?: number;
  requiredDistance?: number;
  failingDetails?: string;
}

export interface PoleLayer {
  layerName: string;
  attachments: PoleAttachment[];
  wires: PoleWire[];
  wireEndPoints?: WireEndPoint[];
  poleProperties?: PoleProperties;
  clearanceResults?: ClearanceResult[];
}

export interface QCCheckResult {
  status: QCCheckStatus;
  message: string;
  details: string[];
}

export interface QCResults {
  ownerCheck: QCCheckResult;
  anchorCheck: QCCheckResult;
  poleSpecCheck: QCCheckResult;
  assemblyUnitsCheck: QCCheckResult;
  glcCheck: QCCheckResult;
  poleOrderCheck: QCCheckResult;
  tensionCheck: QCCheckResult;
  attachmentSpecCheck: QCCheckResult;
  heightCheck: QCCheckResult;
  specFileCheck: QCCheckResult;
  clearanceCheck: QCCheckResult;
  overallStatus: QCCheckStatus;
  passCount: number;
  failCount: number;
  warningCount: number;
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
  qcResults?: QCResults;
}

export interface ValidationResults {
  validPoles: number;
  invalidPoles: number;
  totalPoles: number;
  poleResults: Record<string, boolean>;
  qcSummary?: {
    passCount: number;
    failCount: number;
    warningCount: number;
    totalChecks: number;
  };
}
