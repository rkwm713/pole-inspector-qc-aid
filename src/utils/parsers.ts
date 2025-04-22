
// SPIDAcalc JSON Parser Utilities
import { Pole, PoleAttachment, PoleLayer, PoleDetails, WireEndPoint } from "@/types";
import { safeDisplayValue } from "./formatting";

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
 * Ensures a value is a string
 * @param value Any value that might need to be converted to string
 * @returns String representation of the value
 */
const ensureString = (value: any): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return safeDisplayValue(value);
  }
  return String(value);
};

export const extractPoleData = (jsonData: any): Pole[] => {
  console.log('Starting extractPoleData with input:', jsonData);
  
  if (!jsonData || !jsonData.poles || !Array.isArray(jsonData.poles)) {
    console.log("Invalid JSON structure. Expected poles array", jsonData);
    return [];
  }

  const poles: Pole[] = [];
  
  // Process each pole directly from the poles array
  jsonData.poles.forEach((pole: any) => {
    if (!pole) {
      console.log("Invalid pole data", pole);
      return;
    }
    
    console.log('Processing pole:', pole.structureId);
    
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
    
    // Set structure ID and ensure it's a string
    const structureId = pole.structureId ? ensureString(pole.structureId) : 
      `unknown-${Math.random().toString(36).substring(2, 9)}`;
    
    // Use aliases as alias if available and ensure it's a string
    const alias = Array.isArray(pole.aliases) ? ensureString(pole.aliases[0]) : undefined;
    
    // Process layers
    const layers: Record<string, PoleLayer> = {};
    
    if (pole.layers && typeof pole.layers === 'object') {
      console.log('Processing layers for pole:', structureId, pole.layers);
      
      Object.entries(pole.layers).forEach(([layerName, layerData]: [string, any]) => {
        console.log('Processing layer:', layerName, layerData);
        
        const attachments: PoleAttachment[] = [];
        
        if (Array.isArray(layerData.attachments)) {
          layerData.attachments.forEach((attachment: any) => {
            if (!attachment) return;
            
            attachments.push({
              id: attachment.id ? ensureString(attachment.id) : 
                `att-${Math.random().toString(36).substr(2, 9)}`,
              description: ensureString(attachment.description || 'Unknown Attachment'),
              owner: ensureString(attachment.owner || 'Unknown'),
              height: {
                value: attachment.height?.value || 0,
                unit: ensureString(attachment.height?.unit || 'METRE')
              },
              assemblyUnit: ensureString(attachment.assemblyUnit || 'N/A')
            });
          });
        }
        
        layers[layerName] = {
          layerName,
          layerType: 'Theoretical', // Default to Theoretical if not specified
          attachments
        };
      });
    }
    
    console.log('Created layers for pole:', structureId, layers);
    
    // Create pole object with all extracted data
    poles.push({
      structureId,
      alias,
      coordinates,
      layers
    });
  });
  
  console.log('Final processed poles:', poles);
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
        const isValid = attachment.assemblyUnit && 
                        typeof attachment.assemblyUnit === 'string' && 
                        attachment.assemblyUnit !== 'N/A' && 
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
