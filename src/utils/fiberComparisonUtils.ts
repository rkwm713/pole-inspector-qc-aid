import { KmzFiberData, Pole, PoleWire } from "@/types";
import { calculateHaversineDistance, getCapafoValue, extractFiberSize } from "@/utils/fiberUtils";

// --- Type Definitions ---

// Define type interfaces for the JSON structure 
interface JsonWire {
  id: string;
  owner?: { id: string };
  clientItem?: { 
    size?: string;
    type?: string;
  };
  size?: string;
  description?: string;
}

interface JsonWireEndPoint {
  type?: string;
  externalId?: string;
  wires?: string[];
}

interface JsonStructure {
  pole?: { externalId?: string };
  wires?: JsonWire[];
  wireEndPoints?: JsonWireEndPoint[];
}

interface JsonDesign {
  label?: string;
  structure?: JsonStructure;
}

interface JsonLocation {
  label?: string;
  designs?: JsonDesign[];
}

interface JsonLead {
  locations?: JsonLocation[];
}

// Make JsonData exportable if needed elsewhere, otherwise keep internal
export interface JsonData {
  leads?: JsonLead[];
}

// Enhanced span data structure used internally and returned
export interface ProcessedSpanData {
  fromPoleLabel: string;
  toPoleLabel: string;
  proposedFiberSize: string; // Keep for display
  remedyFiberSize: string;   // Keep for display
  kmzFiberSize: string;      // Keep for display
  proposedFiberCount: number; // Added for numerical comparison
  remedyFiberCount: number;   // Added for numerical comparison
  kmzFiberCount: number;      // Added for numerical comparison
  status: string;
  details?: string;
  proposedWireIds?: string[];
  remedyWireIds?: string[];
}

// Type for the intermediate extracted span data before KMZ matching
type InitialSpanData = Omit<ProcessedSpanData, 'kmzFiberSize' | 'kmzFiberCount' | 'status'>;

// --- Helper Functions ---

/**
 * Helper function to get fiber info (count and original string) from JSON wire data.
 */
const getFiberInfo = (wires: JsonWire[] | undefined, wireIds: string[] | undefined): { count: number, sizeString: string } => {
  let totalCount = 0;
  const sizeStrings: string[] = [];

  if (wires && wireIds) {
    const gigapowerWires = wireIds
      .map(wireId => wires.find(w => w.id === wireId))
      .filter(wire => 
        wire && wire.owner?.id && 
        wire.owner.id.toLowerCase().includes("gigapower"));
        
    if (gigapowerWires.length > 0) {
      gigapowerWires.forEach(wire => {
        if (wire) {
          // Add original size string for display
          const originalSize = wire.clientItem?.size || wire.size || wire.description || "Unknown Size";
          if (originalSize !== "Unknown Size" && !sizeStrings.includes(originalSize)) {
            sizeStrings.push(originalSize);
          }
          // Extract and sum numerical count - Cast to PoleWire for extractFiberSize
          // Note: This assumes JsonWire structure is compatible enough with PoleWire for extractFiberSize
          totalCount += extractFiberSize(wire as unknown as PoleWire); 
        }
      });
    }
  }
  
  return { 
    count: totalCount, 
    sizeString: sizeStrings.length > 0 ? sizeStrings.join(', ') : "N/A" 
  };
};

/**
 * Helper to build a mapping from pole externalId to its label from the JSON data.
 */
const buildPoleIdLookup = (jsonData: JsonData | undefined): Record<string, string> => {
  const lookup: Record<string, string> = {};
  
  if (jsonData?.leads) {
    jsonData.leads.forEach((lead) => {
      if (lead.locations) {
        lead.locations.forEach((location) => {
          if (location.designs && location.designs.length > 0) {
            // Use first design to find the externalId associated with the location label
            const design = location.designs[0]; 
            if (design.structure?.pole?.externalId && location.label) {
              lookup[design.structure.pole.externalId] = location.label;
            }
          }
        });
      }
    });
  }
  
  return lookup;
};

/**
 * Extracts initial span information (poles, fiber sizes/counts, wire IDs) from the JSON data.
 */
const extractInitialSpanData = (jsonData: JsonData | undefined): InitialSpanData[] => {
  const spans: InitialSpanData[] = [];
  if (!jsonData) return spans;

  const poleIdLookup = buildPoleIdLookup(jsonData);
  
  jsonData.leads?.forEach((lead) => {
    lead.locations?.forEach((location) => {
      const fromPoleLabel = location.label || '';
      if (!fromPoleLabel) return;
      
      const proposedDesign = location.designs?.find((d) => d.label === "Proposed" || d.label === "PROPOSED");
      const remedyDesign = location.designs?.find((d) => d.label === "Remedy" || d.label === "REMEDY");
      
      if (!proposedDesign?.structure?.wireEndPoints) return;
      
      proposedDesign.structure.wireEndPoints.forEach((wep) => {
        // Ensure the wire endpoint connects to another pole and has an external ID
        if (wep.type && 
            (wep.type === "NEXT_POLE" || wep.type === "PREVIOUS_POLE" || wep.type === "OTHER_POLE") && 
            wep.externalId) {
          
          const toPoleExternalId = wep.externalId;
          const toPoleLabel = poleIdLookup[toPoleExternalId] || `Unknown (${toPoleExternalId})`; // Include ID if label unknown

          // Get Proposed Fiber Info
          const proposedFiberInfo = getFiberInfo(proposedDesign.structure?.wires, wep.wires);
          
          // Get Remedy Fiber Info
          let remedyFiberInfo = { count: 0, sizeString: "N/A" };
          let remedyWireIds: string[] = [];
          if (remedyDesign?.structure) {
            const remedyWep = remedyDesign.structure.wireEndPoints?.find(
              w => w.externalId === toPoleExternalId
            );
            if (remedyWep) {
              remedyFiberInfo = getFiberInfo(remedyDesign.structure.wires, remedyWep.wires);
              remedyWireIds = remedyWep.wires?.filter(wireId => 
                remedyDesign.structure?.wires?.find(w => 
                  w.id === wireId && w.owner?.id?.toLowerCase().includes("gigapower")
                )
              ) || [];
            }
          }
          
          // Collect proposed wire IDs specifically for Gigapower
          const proposedWireIds = wep.wires?.filter(wireId => 
            proposedDesign.structure?.wires?.find(w => 
              w.id === wireId && w.owner?.id?.toLowerCase().includes("gigapower")
            )
          ) || [];

          // Only add span if we found Gigapower fiber count > 0 in at least one design
          if (proposedFiberInfo.count > 0 || remedyFiberInfo.count > 0) {
            spans.push({
              fromPoleLabel,
              toPoleLabel,
              proposedFiberSize: proposedFiberInfo.sizeString,
              remedyFiberSize: remedyFiberInfo.sizeString,
              proposedFiberCount: proposedFiberInfo.count,
              remedyFiberCount: remedyFiberInfo.count,
              proposedWireIds,
              remedyWireIds
            });
          }
        }
      });
    });
  });
  
  return spans;
};

/**
 * Matches KMZ data to the initial spans and performs the fiber size comparison, providing detailed status.
 */
const matchAndCompareSpans = (
  initialSpans: InitialSpanData[], 
  kmzData: KmzFiberData[], 
  poles: Pole[]
): ProcessedSpanData[] => {
  // Create a lookup for poles by their structureId (label) for quick access
  const polesLookup: Record<string, Pole> = {};
  poles.forEach(pole => {
    if (pole.structureId) polesLookup[pole.structureId] = pole;
  });

  // Handle case where no KMZ data is loaded at all
  if (!kmzData || kmzData.length === 0) {
    return initialSpans.map(span => ({
      ...span,
      kmzFiberSize: "N/A",
      kmzFiberCount: 0,
      status: "NO_KMZ_DATA_LOADED" 
    }));
  }
  
  return initialSpans.map(span => {
    const fromPole = polesLookup[span.fromPoleLabel];
    const toPole = polesLookup[span.toPoleLabel];
    
    // Check if coordinates exist for both poles
    if (!fromPole?.coordinates || !toPole?.coordinates) {
      return { 
        ...span, 
        kmzFiberSize: "N/A", 
        kmzFiberCount: 0, 
        status: "NO_POLE_COORDS" 
      };
    }
    
    // Calculate the midpoint of the span
    const midpointLat = (fromPole.coordinates.latitude + toPole.coordinates.latitude) / 2;
    const midpointLon = (fromPole.coordinates.longitude + toPole.coordinates.longitude) / 2;
    
    // Find the closest KMZ data point to the midpoint
    let closestKmz: KmzFiberData | null = null;
    let minDistance = Infinity; // Distance in meters
    
    kmzData.forEach(kmz => {
      if (!kmz.coordinates) return;
      // Use Haversine distance for accurate geographic distance
      const distance = calculateHaversineDistance(
        midpointLat, midpointLon, 
        kmz.coordinates.latitude, kmz.coordinates.longitude
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestKmz = kmz;
      }
    });
    
      // Define a reasonable distance threshold in meters (e.g., 50 meters)
      const DISTANCE_THRESHOLD_METERS = 50; 

    // If a close enough KMZ point is found, extract info and compare
    if (closestKmz && minDistance < DISTANCE_THRESHOLD_METERS) {
      const kmzFiberSizeString = getCapafoValue(closestKmz) || closestKmz.fiberSize || "Unknown";
      // Extract numerical count from KMZ data string
      const kmzFiberCount = extractFiberSize(kmzFiberSizeString);
      
      let status: string;
      const hasJsonFiber = span.proposedFiberCount > 0 || span.remedyFiberCount > 0;
      const hasKmzFiber = kmzFiberCount > 0;

      // Perform numerical comparison
      const proposedMatch = span.proposedFiberCount > 0 && span.proposedFiberCount === kmzFiberCount;
      const remedyMatch = span.remedyFiberCount > 0 && span.remedyFiberCount === kmzFiberCount;

      if (proposedMatch || remedyMatch) {
        status = "MATCH";
      } else if (hasJsonFiber && hasKmzFiber) {
        // Both have fiber, but counts don't match
        status = "MISMATCH";
      } else if (hasJsonFiber && !hasKmzFiber) {
        // Fiber in JSON, but not found/counted in nearby KMZ
        status = "JSON_ONLY";
      } else if (!hasJsonFiber && hasKmzFiber) {
        // Fiber counted in KMZ, but not found in JSON
        status = "KMZ_ONLY";
      } else {
         // Neither JSON nor KMZ has a fiber count > 0
         status = "NO_FIBER_FOUND"; 
      }
      
      return { ...span, kmzFiberSize: kmzFiberSizeString, kmzFiberCount, status };
    } else {
      // If no KMZ point is found nearby
      return { 
        ...span, 
        kmzFiberSize: "N/A", 
        kmzFiberCount: 0, 
        status: "NO_KMZ_NEARBY" 
      };
    }
  });
};


// --- Main Exported Function ---

/**
 * Processes the original JSON data, KMZ data, and pole data to generate
 * a list of spans with compared fiber information.
 * 
 * @param originalJsonData The raw JSON data object.
 * @param kmzData Array of KMZ fiber data points.
 * @param poles Array of pole data.
 * @returns An array of ProcessedSpanData objects.
 */
export const processFiberComparisonData = (
  originalJsonData: Record<string, unknown> | undefined, 
  kmzData: KmzFiberData[], 
  poles: Pole[]
): ProcessedSpanData[] => {
  console.log("processFiberComparisonData called with:", { 
    hasJson: !!originalJsonData, 
    kmzDataCount: kmzData?.length ?? 0, 
    polesCount: poles?.length ?? 0 
  });

  if (!originalJsonData) {
    console.warn("Fiber Comparison: No original JSON data provided.");
    return [];
  }

  // Type cast the generic object to our specific JsonData interface
  const jsonData = originalJsonData as JsonData; 

  // Step 1: Extract initial span information from JSON
  const initialSpans = extractInitialSpanData(jsonData);
  console.log(`Fiber Comparison: Extracted ${initialSpans.length} initial spans from JSON.`);
  if (initialSpans.length === 0) {
    console.warn("Fiber Comparison: No relevant spans found in JSON data.");
    return [];
  }

  // Step 2: Match KMZ data and compare fiber counts
  const processedSpans = matchAndCompareSpans(initialSpans, kmzData, poles);
  console.log(`Fiber Comparison: Processed ${processedSpans.length} spans after KMZ matching.`);
  // Log a sample of the processed data and statuses
  if (processedSpans.length > 0) {
    console.log("Fiber Comparison: Sample processed span:", processedSpans[0]);
    const statusCounts = processedSpans.reduce((acc, span) => {
      acc[span.status] = (acc[span.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log("Fiber Comparison: Status counts:", statusCounts);
  }


  return processedSpans;
};
