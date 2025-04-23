// SPIDAcalc JSON Parser Utilities

import { 
  Pole, 
  PoleAttachment, 
  PoleWire,
  PoleLayer, 
  PoleProperties,
  ClearanceResult,
  QCResults,
  QCCheckResult,
  QCCheckStatus,
  WireEndPoint,
  ProjectInfo,
  ParsedData
} from "@/types";

import {
  runQCChecks as runQCValidations
} from "@/utils/qcChecks";

// Minimal interfaces for raw SPIDAcalc data structures (based on usage)
interface RawGeoCoord {
  type?: string;
  coordinates?: number[];
}

interface RawRemedy {
  description?: string;
}

interface RawLocation {
  label?: string;
  id?: string;
  comments?: string | unknown;
  geographicCoordinate?: RawGeoCoord;
  designs?: RawDesign[];
  clearanceResults?: RawClearanceResult[];
  remedies?: RawRemedy[];
}

interface RawDesign {
  label?: string;
  structure?: RawStructure;
  clearanceResults?: RawClearanceResult[];
}

interface RawStructure {
  pole?: RawPoleProperties;
  attachments?: RawAttachment[];
  wires?: RawWire[];
  wireEndPoints?: RawWEP[];
}

interface RawOwner {
  id?: string;
  industry?: string;
}

interface RawHeight {
  value?: number;
  unit?: string;
}

interface RawClientItem {
  size?: string;
  type?: string;
  species?: string;
  classOfPole?: string;
  usageGroup?: string;
}

interface RawPoleProperties {
  clientItemAlias?: string;
  clientItem?: RawClientItem;
  height?: RawHeight;
  glc?: RawHeight; // Assuming same structure as height
  agl?: RawHeight; // Assuming same structure as height
}

interface RawAttachment {
  id?: string;
  externalId?: string;
  description?: string;
  owner?: RawOwner;
  type?: string;
  clientItemAlias?: string;
  model?: string;
  clientItem?: RawClientItem;
  height?: RawHeight;
  bearing?: number;
}

interface RawTensionGroup {
  tension?: number;
}

interface RawWire {
  id?: string;
  externalId?: string;
  owner?: RawOwner;
  attachmentHeight?: RawHeight;
  clientItem?: RawClientItem;
  tensionGroups?: RawTensionGroup[];
  associatedAttachments?: unknown[];
  usageGroup?: string;
}

interface RawDistance {
  value?: number;
  unit?: string;
}

interface RawWEP {
  id?: string;
  externalId?: string;
  direction?: number;
  distance?: RawDistance;
  relativeElevation?: RawHeight; // Assuming same structure
  type?: string;
  wires?: string[];
  connectionId?: string;
  environment?: string | null;
}

interface RawClearanceResult {
  id?: string;
  clearanceRuleName?: string;
  status?: string; // "PASSING" | "FAILING" | "UNKNOWN";
  distance?: RawDistance;
  required?: RawDistance;
  failingDetails?: string;
}


/**
 * Convert meters to feet and inches
 * @param meters Value in meters
 * @returns Formatted string in feet and inches (e.g., "15' 6\"")
 */
export const metersToFeetInches = (meters: number): string => {
  // 1 meter = 3.28084 feet
  const totalFeet = meters * 3.28084;
  
  // Extract the whole feet part
  const feet = Math.floor(totalFeet);
  
  // Convert the decimal part to inches (1 foot = 12 inches)
  const inches = Math.round((totalFeet - feet) * 12);
  
  // Handle case where inches round to 12
  if (inches === 12) {
    return `${feet + 1}' 0"`;
  }
  
  return `${feet}' ${inches}"`;
};

/**
 * Extract pole data and project info from SPIDAcalc JSON following the specified structure
 * @param jsonData The parsed JSON data from SPIDAcalc (type unknown as structure can vary)
 * @returns Object containing pole array and project info
 */
export const extractPoleData = (jsonData: unknown): ParsedData => {
  // Extract project info
  const projectInfo: ProjectInfo = {
    engineer: undefined,
    comments: undefined,
    generalLocation: undefined,
    address: undefined,
    defaultLoadCases: undefined
  };
  
  // Extract top-level project fields if they exist
  if (typeof jsonData === 'object' && jsonData !== null) {
    const data = jsonData as Record<string, unknown>;
    
    // Extract engineer
    if (typeof data.engineer === 'string') {
      projectInfo.engineer = data.engineer;
    }
    
    // Extract comments
    if (typeof data.comments === 'string') {
      projectInfo.comments = data.comments;
    }
    
    // Extract generalLocation
    if (typeof data.generalLocation === 'string') {
      projectInfo.generalLocation = data.generalLocation;
    }
    
    // Extract address (which might be an object with various fields)
    if (typeof data.address === 'object' && data.address !== null) {
      projectInfo.address = data.address as Record<string, unknown>;
    }
    
    // Extract defaultLoadCases
    if (Array.isArray(data.defaultLoadCases)) {
      projectInfo.defaultLoadCases = data.defaultLoadCases
        .filter(item => typeof item === 'string')
        .map(item => item as string);
    }
  }
  // Type guard to ensure jsonData is an object with a 'leads' array
  // Initialize the array to hold the parsed pole data
  const poles: Pole[] = [];
  
  // Check for leads structure
  if (
    typeof jsonData !== 'object' || 
    jsonData === null || 
    !('leads' in jsonData) || 
    !Array.isArray((jsonData as { leads: unknown }).leads) || 
    (jsonData as { leads: unknown[] }).leads.length === 0
  ) {
    console.error("Invalid JSON structure: Missing or empty leads array", jsonData);
    return { poles, projectInfo };
  }

  // Now we know jsonData has a leads array
  const leads = (jsonData as { leads: unknown[] }).leads;
  // Access the primary lead object (assuming it's an object)
  const primaryLead = leads[0] as Record<string, unknown>; // Asserting it's an object-like structure
  if (!primaryLead || typeof primaryLead !== 'object' || !('locations' in primaryLead) || !Array.isArray(primaryLead.locations)) {
    console.error("Invalid lead structure: Missing or invalid locations array", primaryLead);
    return { poles, projectInfo };
  }
  
  // Process each location (pole site) in the locations array
  primaryLead.locations.forEach((location: unknown) => {
    // Type guard for location
    if (!location || typeof location !== 'object') {
      console.error("Invalid location data (not an object)", location);
      return;
    }
    const loc = location as RawLocation; // Use specific interface

    // Extract the pole's unique identifier/label
    const structureId = loc.label ?? `unknown-${Math.random().toString(36).substring(2, 9)}`; // Use nullish coalescing
    
    // Debug log for specific pole
    if (structureId === "H14C378") {
      console.log("Found target pole H14C378");
      console.log("Location remedies:", loc.remedies);
    }
    // Extract coordinates if available (Handles GeoJSON Point format)
    let coordinates;
    const geoCoord = loc.geographicCoordinate; // No assertion needed if RawLocation is correct
    if (geoCoord &&
        geoCoord.type === 'Point' &&
        Array.isArray(geoCoord.coordinates) &&
        geoCoord.coordinates.length === 2 &&
        typeof geoCoord.coordinates[0] === 'number' &&
        typeof geoCoord.coordinates[1] === 'number') {
      coordinates = {
        latitude: geoCoord.coordinates[1], // Latitude is the second element (index 1)
        longitude: geoCoord.coordinates[0] // Longitude is the first element (index 0)
      };
    }
    
    // Use comments as alias if available
    let alias: string | undefined = undefined;
    if (loc.comments && typeof loc.comments === 'string') {
        alias = loc.comments;
    } else if (loc.comments && typeof loc.comments === 'object') {
        alias = JSON.stringify(loc.comments);
    }
    // Process designs as layers (EXISTING, PROPOSED, REMEDY)
    const layers: Record<string, PoleLayer> = {};
    
    if (loc.designs && Array.isArray(loc.designs)) {
      // Iterate through each design layer (Existing, Proposed, Remedy)
      loc.designs.forEach((design: unknown) => {
        // Type guard for design
        if (!design || typeof design !== 'object') {
          console.warn(`Invalid design data (not an object) in pole ${structureId}`);
          return;
        }
        const des = design as RawDesign; // Use specific interface

        const layerName = des.label ?? "UNKNOWN"; // Use nullish coalescing
        
        // Skip if no structure data is available
        if (!des.structure || typeof des.structure !== 'object') {
          console.warn(`No structure data or invalid structure for ${layerName} layer in pole ${structureId}`);
          return;
        }
        
        const currentStructure = des.structure as RawStructure; // Use specific interface
        const attachments: PoleAttachment[] = [];
        const wires: PoleWire[] = [];
        
        // Extract pole properties
        let poleProperties: PoleProperties | undefined;
        if (currentStructure.pole && typeof currentStructure.pole === 'object') {
          // Extract basic pole properties
          poleProperties = extractPoleProperties(currentStructure.pole);
          // Add remedies from the location level to all layers
          if (loc.remedies && Array.isArray(loc.remedies)) {
            // Ensure remedies is initialized if not present
            if (!poleProperties) poleProperties = { remedies: [] }; // Initialize if undefined
            if (!poleProperties.remedies) poleProperties.remedies = [];
            // Filter remedies and map to ensure required 'description' exists
            const validRemedies = loc.remedies
              .filter(r => r && typeof r === 'object' && typeof r.description === 'string')
              .map(r => ({ description: r.description as string })); // Ensure description is string
            poleProperties.remedies.push(...validRemedies);
          }
        }
        
        // Extract attachments
        if (currentStructure.attachments && Array.isArray(currentStructure.attachments)) {
          console.log(`[${structureId} - ${layerName}] Found ${currentStructure.attachments.length} attachments at path.`); // DEBUG LOG
          currentStructure.attachments.forEach((attachment: unknown, index: number) => {
            console.log(`[${structureId} - ${layerName}] Processing raw attachment ${index}:`, JSON.stringify(attachment)); // DEBUG LOG
            const processedAttachment = extractAttachment(attachment); // extractAttachment now handles unknown
            if (processedAttachment) {
              attachments.push(processedAttachment);
              // console.log(`[${structureId} - ${layerName}] Successfully processed attachment ${index}:`, JSON.stringify(processedAttachment)); // DEBUG LOG - Removed redundant log
            } else {
              console.warn(`[${structureId} - ${layerName}] extractAttachment returned null for attachment ${index}`); // DEBUG LOG
            }
          });
        } else if (currentStructure.attachments === null || currentStructure.attachments === undefined) {
          console.log(`[${structureId} - ${layerName}] Attachments array is null or undefined.`); // DEBUG LOG
        } else if (currentStructure.attachments.length === 0) {
          console.log(`[${structureId} - ${layerName}] Attachments array is empty.`); // DEBUG LOG
        }
        
        // Extract wires
        if (currentStructure.wires && Array.isArray(currentStructure.wires)) {
          currentStructure.wires.forEach((wire: unknown) => {
            const processedWire = extractWire(wire); // extractWire now handles unknown
            if (processedWire) {
              wires.push(processedWire);
            }
          });
        }
        
        // Extract clearance results (check both possible locations)
        let clearanceResults: ClearanceResult[] = [];
        
        // Check location clearance results
        if (loc.clearanceResults && Array.isArray(loc.clearanceResults)) {
          clearanceResults = extractClearanceResults(loc.clearanceResults);
        }
        
        // Check design clearance results (if not found at location level)
        if (clearanceResults.length === 0 && des.clearanceResults && Array.isArray(des.clearanceResults)) {
          clearanceResults = extractClearanceResults(des.clearanceResults);
        }
        
        // Extract wire end points
        const wireEndPoints: WireEndPoint[] = [];
        if (currentStructure.wireEndPoints && Array.isArray(currentStructure.wireEndPoints)) {
          currentStructure.wireEndPoints.forEach((wep: unknown) => {
            // Type guard for wire end point
            if (wep && typeof wep === 'object') {
              const wepObj = wep as RawWEP; // Use specific interface

              // Check the environment field to determine status
              const environment = wepObj.environment;
              let environmentStatus: 'E' | 'NE';
              
              // Environment is considered "Not Entered" if it's missing, null, empty string, or "None"
              if (!environment || environment === "" || environment === "None") {
                environmentStatus = 'NE';
              } else {
                // A specific value exists, so it's "Entered"
                environmentStatus = 'E';
              }
              
              wireEndPoints.push({
                id: wepObj.id,
                externalId: wepObj.externalId,
                direction: wepObj.direction,
                distance: { // Ensure value and unit are present
                  value: wepObj.distance?.value ?? 0,
                  unit: wepObj.distance?.unit ?? 'METRE'
                },
                relativeElevation: { // Ensure value and unit are present
                  value: wepObj.relativeElevation?.value ?? 0,
                  unit: wepObj.relativeElevation?.unit ?? 'METRE'
                },
                type: wepObj.type,
                wires: wepObj.wires ?? [], // Default to empty array
                connectionId: wepObj.connectionId,
                environment: wepObj.environment, // Add the original environment value
                environmentStatus // Add the derived status
              });
            } else {
               console.warn(`Invalid wire end point data (not an object) in pole ${structureId}, layer ${layerName}`);
            }
          });
        }
        
        // Create layer with all data
        layers[layerName] = {
          layerName,
          attachments,
          wires,
          wireEndPoints: wireEndPoints.length > 0 ? wireEndPoints : undefined,
          poleProperties,
          clearanceResults: clearanceResults.length > 0 ? clearanceResults : undefined
        };
      });
    }
    
    // Create pole object with all extracted data
    poles.push({
      structureId,
      alias,
      id: loc.id, // Use checked loc
      coordinates,
      layers
    });
  });
  
  return { poles, projectInfo };
};

/**
 * Extract attachment data from a SPIDAcalc attachment object
 */
const extractAttachment = (attachment: unknown): PoleAttachment | null => {
  // Type guard for attachment
  if (!attachment || typeof attachment !== 'object') {
    console.warn("extractAttachment received invalid input (not an object), returning null."); // DEBUG LOG
    return null;
  }
  const att = attachment as RawAttachment; // Use specific interface

  let attachmentType: PoleAttachment["attachmentType"] = "OTHER";

  // Add more detailed logging to see what types of attachments we're processing
  console.log("Attachment Data:", {
    type: att.type,
    description: att.description,
    clientItemAlias: att.clientItemAlias,
  });

  if (att.type) {
    const typeString = String(att.type).toLowerCase();
    if (typeString.includes('guy')) attachmentType = "GUY";
    else if (typeString.includes('anchor')) attachmentType = "ANCHOR";
    else if (typeString.includes('insulator')) attachmentType = "INSULATOR";
    else if (typeString.includes('transformer') || typeString.includes('equipment')) attachmentType = "EQUIPMENT";
    else if (typeString.includes('comm') || typeString.includes('telecom')) attachmentType = "COMMUNICATION";
    else if (typeString.includes('primary') || typeString.includes('secondary') || typeString.includes('power')) attachmentType = "POWER";
  } else {
    // If type is not defined, try to determine based on description or clientItemAlias
    const description = (att.description || "").toLowerCase();
    const clientItemAlias = (att.clientItemAlias || "").toLowerCase();

    if (
      description.includes("insulator") ||
      clientItemAlias.includes("insulator") ||
      description.includes("cutout") ||
      clientItemAlias.includes("cutout") ||
      description.includes("arrester") ||
      clientItemAlias.includes("arrester")
    ) {
      attachmentType = "INSULATOR";
    } else if (
      description.includes("transformer") ||
      clientItemAlias.includes("transformer") ||
      description.includes("clamp") ||
      clientItemAlias.includes("clamp") ||
      description.includes("mount") ||
      clientItemAlias.includes("mount") ||
      description.includes("bracket") ||
      clientItemAlias.includes("bracket") ||
      description.includes("drip loop") ||
      clientItemAlias.includes("drip loop") ||
      description.includes("switch") ||
      clientItemAlias.includes("switch")
    ) {
      attachmentType = "EQUIPMENT";
    }
  }
  
  // Extract description
  const description = att.clientItemAlias || 
                     att.description || 
                     (att.type && typeof att.type === 'string' ? att.type : 'Unknown Attachment');

  // Extract owner info (using optional chaining for safety)
  const ownerId = att.owner?.id ?? 'Unknown'; // Use nullish coalescing
  const ownerIndustry = att.owner?.industry;
  const owner = { id: ownerId, industry: ownerIndustry };

  // Get attachment height and convert to feet (using optional chaining)
  const heightValue = att.height?.value ?? 0; // Use nullish coalescing
  const heightUnit = att.height?.unit ?? 'METRE'; // Use nullish coalescing
  const heightInFeet = metersToFeetInches(heightValue);

  // Extract clientItem size (using optional chaining)
  const clientItemSize = att.clientItem?.size;
  
  // Create attachment object
  const processedAttachment: PoleAttachment = {
    id: att.id,
    externalId: att.externalId,
    description,
    owner,
    type: att.type,
    clientItemAlias: att.clientItemAlias,
    model: att.model,
    size: clientItemSize, // Use safely extracted size
    height: {
      value: heightValue,
      unit: heightUnit
    },
    heightInFeet,
    bearing: att.bearing,
    assemblyUnit: att.externalId || 'N/A',
    attachmentType,
    qcIssues: []
  };
  // console.log("extractAttachment output:", JSON.stringify(processedAttachment)); // DEBUG LOG - Use correct variable if re-enabled
  return processedAttachment;
};

/**
 * Extract wire data from a SPIDAcalc wire object
 */
const extractWire = (wire: unknown): PoleWire | null => {
  // Type guard for wire
  if (!wire || typeof wire !== 'object') {
     console.warn("extractWire received invalid input (not an object), returning null.");
     return null;
  }
  const w = wire as RawWire; // Use specific interface

  // Extract owner info safely
  const ownerId = w.owner?.id ?? 'Unknown'; // Use nullish coalescing
  const ownerIndustry = w.owner?.industry;
  const owner = { id: ownerId, industry: ownerIndustry };

  // Extract clientItem info safely
  const clientItemSize = w.clientItem?.size;
  const clientItemType = w.clientItem?.type;
  const clientItemUsageGroup = w.clientItem?.usageGroup;
  const clientItem = { size: clientItemSize, type: clientItemType };

  // Extract tension safely
  const tension = w.tensionGroups?.[0]?.tension ?? 0; // Use optional chaining and nullish coalescing

  // Extract associatedAttachments safely and ensure they're all strings
  const associatedAttachments: string[] = [];
  
  if (w.associatedAttachments && Array.isArray(w.associatedAttachments)) {
    // Create a new string array with only string values
    for (let i = 0; i < w.associatedAttachments.length; i++) {
      const id = w.associatedAttachments[i];
      if (typeof id === 'string') {
        associatedAttachments.push(id);
      } else {
        console.warn(`Non-string attachment ID found in wire ${w.id || 'unknown'} at index ${i}`);
      }
    }
  }

  return {
    id: w.id,
    externalId: w.externalId,
    owner,
    attachmentHeight: { // Ensure value and unit are present
      value: w.attachmentHeight?.value ?? 0,
      unit: w.attachmentHeight?.unit ?? 'METRE'
    },
    size: clientItemSize, // Use safely extracted value
    type: clientItemType, // Use safely extracted value
    tension, // Use safely extracted value
    clientItem, // Use safely extracted object
    associatedAttachments, // Use safely extracted array
    usageGroup: w.usageGroup || clientItemUsageGroup // Use safely extracted value
  };
};

/**
 * Extract pole properties from a SPIDAcalc pole object
 */
const extractPoleProperties = (poleData: RawPoleProperties): PoleProperties => { // Use specific interface
  // Extract clientItem info safely
  const clientItemSpecies = poleData.clientItem?.species;
  const clientItemClass = poleData.clientItem?.classOfPole;

  // Extract height value safely
  const heightValue = poleData.height?.value;

  return {
    clientItemAlias: poleData.clientItemAlias,
    species: clientItemSpecies,
    class: clientItemClass,
    length: heightValue,
    glc: { // Ensure value and unit are present
      value: poleData.glc?.value ?? 0,
      unit: poleData.glc?.unit ?? 'METRE'
    },
    agl: { // Ensure value and unit are present
      value: poleData.agl?.value ?? 0,
      unit: poleData.agl?.unit ?? 'METRE'
    },
    remedies: [] // Initialize remedies, will be populated in extractPoleData
  };
};

/**
 * Extract clearance results from a SPIDAcalc clearance results array
 */
const extractClearanceResults = (clearanceResultsData: unknown[]): ClearanceResult[] => { // Expect array of unknown
  if (!clearanceResultsData || !Array.isArray(clearanceResultsData)) return [];
  
  const mappedResults = clearanceResultsData.map((result: unknown): ClearanceResult | null => {
    // Type guard for each result
    if (!result || typeof result !== 'object') {
      console.warn("Invalid clearance result item (not an object)");
      return null; // Return null for invalid items
    }
    const res = result as RawClearanceResult; // Use specific interface

    // Extract distance and required values safely, providing defaults
    const distanceValue = res.distance?.value ?? 0;
    const requiredValue = res.distance?.value ?? 0;
    const distanceUnit = res.distance?.unit ?? 'METRE';
    const requiredUnit = res.required?.unit ?? 'METRE';

    // Validate and cast status
    let status: ClearanceResult["status"] = "UNKNOWN";
    if (res.status === "PASSING" || res.status === "FAILING" || res.status === "UNKNOWN") {
      status = res.status;
    } else if (res.status) {
        console.warn(`Invalid clearance status "${res.status}", defaulting to UNKNOWN.`);
    }

    // Construct the object carefully matching ClearanceResult type
    const clearanceResult: ClearanceResult = {
      clearanceRuleName: res.clearanceRuleName ?? 'Unknown Rule',
      status: status,
      distance: { value: distanceValue, unit: distanceUnit },
      required: { value: requiredValue, unit: requiredUnit },
      actualDistance: distanceValue,
      requiredDistance: requiredValue,
      // Only include id and failingDetails if they exist in the raw data and are not null/undefined
      ...(res.id != null && { id: res.id }), 
      ...(res.failingDetails != null && { failingDetails: res.failingDetails }),
    };
    return clearanceResult;
  });

  // Filter out null values using a type predicate
  return mappedResults.filter((cr): cr is ClearanceResult => cr !== null);
};

/**
 * Validate pole data against PNM specifications
 * @param poles Array of pole objects
 * @param projectInfo Project information for validation
 * @returns Array of validated pole objects with QC results
 */
export const validatePoleData = (poleData: ParsedData): Pole[] => {
  const { poles, projectInfo } = poleData;
  
  return poles.map(pole => {
    // Deep clone the pole object to avoid mutating the original
    const validatedPole = JSON.parse(JSON.stringify(pole)) as Pole;
    
    // Initialize QC results object using the imported function from qcChecks.ts
    validatedPole.qcResults = runQCValidations(validatedPole, projectInfo);
    
    return validatedPole;
  });
};

// QC checks have been moved to qcChecks.ts
