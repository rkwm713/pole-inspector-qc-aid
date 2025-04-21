
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
  if (!jsonData || !jsonData.clientData || !jsonData.clientData.poles || !Array.isArray(jsonData.clientData.poles)) {
    console.log("Invalid JSON structure. Expected clientData.poles array", jsonData);
    return [];
  }

  return jsonData.clientData.poles.map((pole: any, index: number) => {
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

    // Get alias if available - ensure it's a string
    let alias;
    if (pole.aliases && pole.aliases.length > 0) {
      // Convert alias to string if it's not already
      const rawAlias = pole.aliases[0];
      alias = typeof rawAlias === 'string' ? rawAlias : 
             (typeof rawAlias === 'object' ? JSON.stringify(rawAlias) : String(rawAlias));
    }

    // Process layers (EXISTING, PROPOSED, REMEDY)
    const layers: Record<string, PoleLayer> = {};
    
    if (pole.layers) {
      Object.keys(pole.layers).forEach(layerName => {
        const layerData = pole.layers[layerName];
        
        // Process attachments for this layer
        const attachments: PoleAttachment[] = layerData.attachments?.map((attachment: any) => {
          // Ensure description and owner are strings
          const description = typeof attachment.description === 'string' ? 
                             attachment.description : 
                             (typeof attachment.description === 'object' ? 
                              JSON.stringify(attachment.description) : 
                              String(attachment.description || 'Unknown Attachment'));
          
          const owner = typeof attachment.owner === 'string' ? 
                       attachment.owner : 
                       (typeof attachment.owner === 'object' ? 
                        JSON.stringify(attachment.owner) : 
                        String(attachment.owner || 'Unknown'));
          
          const assemblyUnit = typeof attachment.assemblyUnit === 'string' ? 
                              attachment.assemblyUnit : 
                              (typeof attachment.assemblyUnit === 'object' ? 
                               JSON.stringify(attachment.assemblyUnit) : 
                               String(attachment.assemblyUnit || 'N/A'));

          return {
            id: attachment.id || `attachment-${Math.random().toString(36).substr(2, 9)}`,
            description,
            owner,
            height: {
              value: attachment.height?.value || 0,
              unit: attachment.height?.unit || 'METRE'
            },
            assemblyUnit
          };
        }) || [];

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
