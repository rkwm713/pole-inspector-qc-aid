
// SPIDAcalc JSON Parser Utilities

import { Pole, PoleAttachment, PoleLayer } from "@/types";

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
export const extractPoleData = (jsonData: any): Pole[] => {
  if (!jsonData || !jsonData.poles || !Array.isArray(jsonData.poles)) {
    return [];
  }

  return jsonData.poles.map((pole: any, index: number) => {
    // Extract coordinates if available
    let coordinates;
    if (pole.location && 
        typeof pole.location.latitude === 'number' && 
        typeof pole.location.longitude === 'number') {
      coordinates = {
        latitude: pole.location.latitude,
        longitude: pole.location.longitude
      };
    }

    // Get alias if available
    const alias = pole.aliases && pole.aliases.length > 0 
      ? pole.aliases[0] 
      : undefined;

    // Process layers (EXISTING, PROPOSED, REMEDY)
    const layers: Record<string, PoleLayer> = {};
    
    if (pole.layers) {
      Object.keys(pole.layers).forEach(layerName => {
        const layerData = pole.layers[layerName];
        
        // Process attachments for this layer
        const attachments: PoleAttachment[] = layerData.attachments?.map((attachment: any) => ({
          id: attachment.id || `attachment-${Math.random().toString(36).substr(2, 9)}`,
          description: attachment.description || 'Unknown Attachment',
          owner: attachment.owner || 'Unknown',
          height: {
            value: attachment.height?.value || 0,
            unit: attachment.height?.unit || 'METRE'
          },
          assemblyUnit: attachment.assemblyUnit || 'N/A'
        })) || [];

        layers[layerName] = {
          layerName,
          attachments
        };
      });
    }

    return {
      structureId: pole.structureId || `pole-${index}`,
      alias,
      id: pole.id,
      coordinates,
      layers
    };
  });
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
