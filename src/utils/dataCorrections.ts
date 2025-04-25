import { Pole, WireEndPoint } from "@/types";

// Define interfaces for the SPIDAcalc data structure
export interface WireEndPointData extends WireEndPoint {
  id: string; // Make id required for this operation
}

export interface Design {
  label: string;
  structure?: {
    wireEndPoints?: WireEndPointData[];
  };
}

export interface Location {
  label: string;
  designs?: Design[];
}

export interface Lead {
  locations?: Location[];
}

export interface SPIDAcalcData {
  leads?: Lead[];
}

/**
 * Reorders wireEndPoints in the Remedy design layer of a specific location to match
 * the order in the Proposed layer.
 *
 * @param jsonData The entire JSON data object
 * @param locationLabel The label of the location to correct
 * @returns A new JSON data object with the reordered wireEndPoints
 */
export const reorderWireEndPointsForLocation = (jsonData: SPIDAcalcData, locationLabel: string): SPIDAcalcData => {
  // Create a deep copy of the input data to avoid mutations
  const newData = JSON.parse(JSON.stringify(jsonData));

  try {
    // Navigate to the leads array
    if (!newData.leads || !Array.isArray(newData.leads) || newData.leads.length === 0) {
      console.error("No leads found in the JSON data");
      return newData;
    }

    // For simplicity, we'll use the first lead (usually there's only one)
    const lead = newData.leads[0];

    // Navigate to the locations array
    if (!lead.locations || !Array.isArray(lead.locations)) {
      console.error("No locations found in the lead");
      return newData;
    }

    // Find the target location
    const targetLocation = lead.locations.find(
      (location: Location) => location.label === locationLabel
    );

    if (!targetLocation) {
      console.error(`Location "${locationLabel}" not found`);
      return newData;
    }

    // Navigate to the designs array
    if (!targetLocation.designs || !Array.isArray(targetLocation.designs)) {
      console.error(`No designs found in location "${locationLabel}"`);
      return newData;
    }

    // Find the Proposed and Remedy designs
    const proposedDesign = targetLocation.designs.find(
      (design: Design) => design.label === "Proposed"
    );

    const remedyDesign = targetLocation.designs.find(
      (design: Design) => design.label === "Remedy"
    );

    if (!proposedDesign) {
      console.error(`"Proposed" design not found in location "${locationLabel}"`);
      return newData;
    }

    if (!remedyDesign) {
      console.error(`"Remedy" design not found in location "${locationLabel}"`);
      return newData;
    }

    // Check if both designs have wireEndPoints
    if (!proposedDesign.structure?.wireEndPoints || !Array.isArray(proposedDesign.structure.wireEndPoints)) {
      console.error(`No wireEndPoints found in "Proposed" design`);
      return newData;
    }

    if (!remedyDesign.structure?.wireEndPoints || !Array.isArray(remedyDesign.structure.wireEndPoints)) {
      console.error(`No wireEndPoints found in "Remedy" design`);
      return newData;
    }

    // Extract the id sequence from Proposed wireEndPoints
    const proposedIds = proposedDesign.structure.wireEndPoints.map((wep: WireEndPointData) => wep.id);

    // Create a map of id to wireEndPoint from Remedy for quick lookup
    const remedyWepMap = new Map<string, WireEndPointData>();
    remedyDesign.structure.wireEndPoints.forEach((wep: WireEndPointData) => {
      if (wep.id) {
        remedyWepMap.set(wep.id, wep);
      }
    });

    // Create a new array of wireEndPoints for Remedy, following the Proposed order
    const newRemedyWeps = proposedIds
      .filter(id => remedyWepMap.has(id)) // Only include ids that exist in both arrays
      .map(id => remedyWepMap.get(id));

    // Add any wireEndPoints in Remedy that aren't in Proposed at the end
    remedyDesign.structure.wireEndPoints.forEach((wep: WireEndPointData) => {
      if (wep.id && !proposedIds.includes(wep.id)) {
        newRemedyWeps.push(wep);
      }
    });

    // Replace the Remedy wireEndPoints array with the reordered one
    remedyDesign.structure.wireEndPoints = newRemedyWeps;

    return newData;
  } catch (error) {
    console.error("Error reordering wireEndPoints:", error);
    return newData;
  }
};

/**
 * Reorders wireEndPoints in the Remedy design layer for all locations to match
 * the order in the Proposed layer if they differ.
 *
 * @param jsonData The entire JSON data object
 * @returns An object containing the potentially corrected JSON data and a summary report.
 */
export const correctWireEndPointOrderForAllLocations = (jsonData: SPIDAcalcData) => {
  // Create a deep copy of the input data to avoid mutations
  const correctedData = JSON.parse(JSON.stringify(jsonData));
  const summaryReport: Array<{ locationLabel: string, status: string, message?: string }> = [];

  try {
    // Navigate to the leads array
    if (!correctedData.leads || !Array.isArray(correctedData.leads) || correctedData.leads.length === 0) {
      summaryReport.push({ locationLabel: 'N/A', status: 'Skipped', message: 'No leads found in the JSON data' });
      return { correctedData, summary: summaryReport };
    }

    // Iterate through all leads
    correctedData.leads.forEach((lead: Lead) => {
      // Navigate to the locations array
      if (!lead.locations || !Array.isArray(lead.locations)) {
        // This case is less likely if leads exist, but good for robustness
        summaryReport.push({ locationLabel: 'N/A', status: 'Skipped', message: 'No locations found in a lead' });
        return; // Continue to next lead
      }

      // Iterate through all locations
      lead.locations.forEach((location: Location) => {
        const locationLabel = location.label || 'Unknown Location';

        // Navigate to the designs array
        if (!location.designs || !Array.isArray(location.designs)) {
          summaryReport.push({ locationLabel, status: 'Skipped', message: 'No designs found' });
          return; // Continue to next location
        }

        // Find the Proposed and Remedy designs
        const proposedDesign = location.designs.find(
          (design: Design) => design.label === "Proposed"
        );

        const remedyDesign = location.designs.find(
          (design: Design) => design.label === "Remedy"
        );

        if (!proposedDesign || !remedyDesign) {
          summaryReport.push({ locationLabel, status: 'Skipped', message: '"Proposed" or "Remedy" design not found' });
          return; // Continue to next location
        }

        // Check if both designs have wireEndPoints
        const proposedWeps = proposedDesign.structure?.wireEndPoints;
        const remedyWeps = remedyDesign.structure?.wireEndPoints;

        if (!proposedWeps || !Array.isArray(proposedWeps) || !remedyWeps || !Array.isArray(remedyWeps)) {
          summaryReport.push({ locationLabel, status: 'Skipped', message: 'Missing or invalid wireEndPoints array in Proposed or Remedy design' });
          return; // Continue to next location
        }

        // Extract the id sequence from Proposed wireEndPoints
        const proposedIds = proposedWeps.map((wep: WireEndPointData) => wep.id).filter(id => id !== undefined);

        // Create a map of id to wireEndPoint from Remedy for quick lookup
        const remedyWepMap = new Map<string, WireEndPointData>();
        remedyWeps.forEach((wep: WireEndPointData) => {
          if (wep.id) {
            remedyWepMap.set(wep.id, wep);
          }
        });

        // Create a new array of wireEndPoints for Remedy, following the Proposed order
        const newRemedyWeps: WireEndPointData[] = [];
        const usedRemedyIds = new Set<string>();

        proposedIds.forEach(id => {
          if (remedyWepMap.has(id)) {
            newRemedyWeps.push(remedyWepMap.get(id)!);
            usedRemedyIds.add(id);
          }
        });

        // Add any wireEndPoints in Remedy that aren't in Proposed at the end
        remedyWeps.forEach((wep: WireEndPointData) => {
          if (wep.id && !usedRemedyIds.has(wep.id)) {
            newRemedyWeps.push(wep);
          }
        });

        // Check if the order is different
        const originalRemedyIds = remedyWeps.map((wep: WireEndPointData) => wep.id).filter(id => id !== undefined);
        const newRemedyIds = newRemedyWeps.map((wep: WireEndPointData) => wep.id).filter(id => id !== undefined);

        const orderChanged = originalRemedyIds.length !== newRemedyIds.length || originalRemedyIds.some((id, index) => id !== newRemedyIds[index]);

        if (orderChanged) {
          // Replace the Remedy wireEndPoints array with the reordered one in the copied data
          remedyDesign.structure.wireEndPoints = newRemedyWeps;
          summaryReport.push({ locationLabel, status: 'Reordered', message: 'WireEndPoints order corrected' });
        } else {
          summaryReport.push({ locationLabel, status: 'Matched', message: 'WireEndPoints order already matched' });
        }
      });
    });

    return { correctedData, summary: summaryReport };

  } catch (error: unknown) {
    console.error("Error processing wireEndPoints for all locations:", error);
    summaryReport.push({ locationLabel: 'N/A', status: 'Error', message: `Processing error: ${error instanceof Error ? error.message : String(error)}` });
    return { correctedData, summary: summaryReport };
  }
};
