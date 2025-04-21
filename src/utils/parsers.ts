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
  if (!jsonData || !jsonData.leads || !Array.isArray(jsonData.leads)) {
    console.log("Invalid JSON structure. Expected leads array", jsonData);
    return [];
  }

  const poles: Pole[] = [];
  
  // Iterate through leads
  jsonData.leads.forEach((lead: any) => {
    if (!lead.locations || !Array.isArray(lead.locations)) {
      console.log("Invalid lead structure. Expected locations array", lead);
      return;
    }
    
    // Extract poles from locations within each lead
    lead.locations.forEach((location: any) => {
      if (!location) {
        console.log("Invalid location data", location);
        return;
      }
      
      // Extract coordinates if available
      let coordinates;
      if (location.geographicCoordinate && 
          typeof location.geographicCoordinate.latitude === 'number' && 
          typeof location.geographicCoordinate.longitude === 'number') {
        coordinates = {
          latitude: location.geographicCoordinate.latitude,
          longitude: location.geographicCoordinate.longitude
        };
      }
      
      // Set structure ID from location label
      const structureId = location.label || `unknown-${Math.random().toString(36).substring(2, 9)}`;
      
      // Use comments as alias if available
      let alias = location.comments;
      if (typeof alias !== 'string' && alias) {
        alias = typeof alias === 'object' ? JSON.stringify(alias) : String(alias);
      }
      
      // Process designs as layers
      const layers: Record<string, PoleLayer> = {};
      
      if (location.designs && Array.isArray(location.designs)) {
        location.designs.forEach((design: any) => {
          const layerName = design.label || "UNKNOWN";
          const attachments: PoleAttachment[] = [];
          
          // Extract pole details
          const poleDetails: PoleDetails | undefined = design.pole ? {
            owner: design.pole.owner || 'Unknown',
            glc: design.pole.glc?.value,
            agl: design.pole.agl?.value,
            poleType: design.pole.clientItem?.species
          } : undefined;

          // Extract wire endpoints
          const wireEndPoints: WireEndPoint[] = (design.wireEndPoints || []).map((endpoint: any) => ({
            direction: endpoint.direction || 'Unknown',
            distance: endpoint.distance?.value || 0,
            wireType: endpoint.wireType?.description || 'Unknown',
            connectionId: endpoint.connectionId
          }));
          
          // Process different types of attachments
          const attachmentTypes = [
            { key: 'wires', name: 'Wire' },
            { key: 'equipments', name: 'Equipment' },
            { key: 'insulators', name: 'Insulator' },
            { key: 'crossArms', name: 'Cross Arm' },
            { key: 'sidewalkBraces', name: 'Sidewalk Brace' },
            { key: 'anchors', name: 'Anchor' },
            { key: 'guys', name: 'Guy' }
          ];
          
          attachmentTypes.forEach(({ key, name }) => {
            if (design[key] && Array.isArray(design[key])) {
              design[key].forEach((item: any) => {
                const description = item.type?.description || `${name}`;
                const descString = typeof description === 'string' ? 
                                  description : 
                                  String(description || `Unknown ${name}`);
                
                const owner = item.owner || 'Unknown';
                const ownerString = typeof owner === 'string' ? 
                                   owner : 
                                   String(owner);
                
                const heightValue = item.attachHeight?.value || 
                                   (item.height?.value) || 
                                   0;
                
                const assemblyUnit = item.externalId || 
                                    item.clientItem?.species || 
                                    'N/A';
                
                attachments.push({
                  id: item.id || `${key}-${Math.random().toString(36).substr(2, 9)}`,
                  description: descString,
                  owner: ownerString,
                  height: {
                    value: heightValue,
                    unit: item.attachHeight?.unit || item.height?.unit || 'METRE'
                  },
                  assemblyUnit: typeof assemblyUnit === 'string' ? 
                               assemblyUnit : 
                               String(assemblyUnit)
                });
              });
            }
          });
          
          // Create layer with all attachments and new fields
          layers[layerName] = {
            layerName,
            layerType: design.layerType || 'Theoretical',
            attachments,
            wireEndPoints: wireEndPoints.length > 0 ? wireEndPoints : undefined,
            poleDetails
          };
        });
      }
      
      // Create pole object with all extracted data
      poles.push({
        structureId,
        alias,
        id: location.id,
        coordinates,
        layers
      });
    });
  });
  
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
