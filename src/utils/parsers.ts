// SPIDAcalc JSON Parser Utilities
import { Pole, PoleAttachment, PoleLayer, PoleDetails, WireEndPoint } from "@/types";

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
    console.log("Invalid JSON structure. Expected poles array", jsonData);
    return [];
  }

  const poles: Pole[] = [];
  
  // Process each pole directly from the poles array
  jsonData.poles.forEach((pole: any) => {
    if (!pole || !pole.structureId) {
      console.log("Invalid pole data, missing structureId", pole);
      return;
    }
    
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
    
    // Process layers and their attachments
    const layers: Record<string, PoleLayer> = {};
    
    if (pole.layers && typeof pole.layers === 'object') {
      Object.entries(pole.layers).forEach(([layerName, layerData]: [string, any]) => {
        const attachments: PoleAttachment[] = [];
        
        if (layerData.attachments && Array.isArray(layerData.attachments)) {
          layerData.attachments.forEach((item: any) => {
            if (!item) return;
            
            attachments.push({
              id: item.id || `attachment-${Math.random().toString(36).substr(2, 9)}`,
              description: String(item.description || 'Unknown Attachment'),
              owner: String(item.owner || 'Unknown'),
              height: {
                value: Number(item.height?.value) || 0,
                unit: String(item.height?.unit || 'METRE')
              },
              assemblyUnit: String(item.assemblyUnit || 'N/A')
            });
          });
        }
        
        layers[layerName] = {
          layerName,
          layerType: 'Theoretical', // Default value as per type definition
          attachments
        };
      });
    }
    
    // Create pole object with all extracted data
    poles.push({
      structureId: String(pole.structureId),
      alias: pole.aliases?.[0] || undefined,
      coordinates,
      layers
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
