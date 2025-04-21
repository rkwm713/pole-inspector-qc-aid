
// SPIDAcalc JSON Parser Utilities
import { Pole, PoleAttachment, PoleLayer, PoleDetails, WireEndPoint, SPIDAcalcData, Wire, Remedy, Location, Design } from "@/types";

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
 * Extract pole data from SPIDAcalc JSON
 * @param jsonData The parsed JSON data
 * @returns Array of extracted pole objects
 */
export const extractPoleData = (jsonData: SPIDAcalcData): Pole[] => {
  // First check if the data contains pre-processed poles
  if (jsonData.poles && Array.isArray(jsonData.poles)) {
    console.log("Found pre-processed poles array", jsonData.poles.length);
    return jsonData.poles;
  }

  // Otherwise, extract from locations
  if (!jsonData.locations || !Array.isArray(jsonData.locations)) {
    console.log("Invalid JSON structure. Expected locations array", jsonData);
    return [];
  }

  const poles: Pole[] = [];
  
  jsonData.locations.forEach((location: Location) => {
    if (!location.label || !location.designs || !Array.isArray(location.designs)) {
      console.log("Invalid location data", location);
      return;
    }

    // Process each design (usually just one per location)
    location.designs.forEach((design: Design) => {
      if (!design.structure?.pole) {
        console.log("Invalid design structure", design);
        return;
      }

      // Extract coordinates
      let coordinates;
      if (location.geographicCoordinate?.coordinates) {
        const [longitude, latitude] = location.geographicCoordinate.coordinates;
        coordinates = { latitude, longitude };
      }

      // Process attachments from different sources
      const layers: Record<string, PoleLayer> = {
        EXISTING: {
          layerName: 'EXISTING',
          layerType: 'Measured',
          attachments: []
        }
      };

      // Process wires as attachments
      if (design.structure.wires) {
        design.structure.wires.forEach((wire: Wire) => {
          layers.EXISTING.attachments.push({
            id: wire.id,
            description: wire.description || `Wire ${wire.id}`,
            owner: wire.owner || 'Unknown',
            height: wire.attachmentHeight,
            assemblyUnit: wire.id // Using wire ID as assembly unit for now
          });
        });
      }

      // Process remedies if available
      if (location.remedies) {
        if (!layers.REMEDY) {
          layers.REMEDY = {
            layerName: 'REMEDY',
            layerType: 'Recommended',
            attachments: []
          };
        }

        location.remedies.forEach((remedy: Remedy, index: number) => {
          layers.REMEDY.attachments.push({
            id: `remedy-${index}`,
            description: remedy.description,
            owner: 'Unknown',
            height: { value: 0, unit: 'METRE' }, // Default height for remedies
            assemblyUnit: remedy.type || 'Unknown'
          });
        });
      }

      // Create pole object
      poles.push({
        structureId: location.label,
        alias: design.structure.pole.externalId,
        coordinates,
        layers
      });
    });
  });

  console.log("Extracted poles:", poles);
  return poles;
};

/**
 * Validate pole data against specifications
 * Currently a placeholder for future validation logic
 * @param poles Array of pole objects
 */
export const validatePoleData = (poles: Pole[]): Pole[] => {
  // This is where specific validation rules would be implemented
  return poles.map(pole => {
    // Deep clone the pole object to avoid mutating the original
    const validatedPole = JSON.parse(JSON.stringify(pole));
    
    // Validate each layer's attachments
    Object.keys(validatedPole.layers).forEach(layerKey => {
      const layer = validatedPole.layers[layerKey];
      
      layer.attachments = layer.attachments.map(attachment => {
        // Example validation: check if assemblyUnit exists
        const isValid = attachment.assemblyUnit !== 'N/A' && 
                        attachment.assemblyUnit.trim().length > 0;
        
        return {
          ...attachment,
          isValid
        };
      });
    });
    
    return validatedPole;
  });
};
