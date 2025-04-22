// SPIDAcalc JSON Parser Utilities
import { Pole, PoleAttachment, PoleLayer, PoleDetails, WireEndPoint, SPIDAcalcData, Wire, Remedy, Location, Design, Insulator, Equipment, Guy, Lead } from "@/types";

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
 * Convert complex object or value to string representation for display
 */
const normalizeToString = (value: any): string => {
  if (value === null || value === undefined) {
    return 'Unknown';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value.toString();
  }
  // For objects and arrays, convert to a string representation
  return JSON.stringify(value);
};

/**
 * Convert Wire objects to PoleAttachment objects
 */
const wireToAttachment = (wire: Wire): PoleAttachment => {
  return {
    id: wire.id,
    description: wire.description || `Wire ${wire.id}`,
    owner: wire.owner || 'Unknown',
    height: wire.attachmentHeight,
    assemblyUnit: normalizeToString(wire.clientItem || wire.id)
  };
};

/**
 * Convert Insulator objects to PoleAttachment objects
 */
const insulatorToAttachment = (insulator: Insulator): PoleAttachment | null => {
  if (!insulator.offset) {
    console.log(`Insulator ${insulator.id} missing offset/height information`);
    return null;
  }
  
  return {
    id: insulator.id,
    description: `Insulator ${insulator.id}`,
    owner: insulator.owner || 'Unknown',
    height: insulator.offset,
    assemblyUnit: normalizeToString(insulator.clientItem || insulator.id)
  };
};

/**
 * Convert Equipment objects to PoleAttachment objects
 */
const equipmentToAttachment = (equipment: Equipment): PoleAttachment | null => {
  if (!equipment.attachmentHeight) {
    console.log(`Equipment ${equipment.id} missing attachmentHeight information`);
    return null;
  }
  
  return {
    id: equipment.id,
    description: `Equipment ${equipment.id}`,
    owner: equipment.owner || 'Unknown',
    height: equipment.attachmentHeight,
    assemblyUnit: normalizeToString(equipment.clientItem || equipment.id)
  };
};

/**
 * Convert Guy objects to PoleAttachment objects
 */
const guyToAttachment = (guy: Guy): PoleAttachment | null => {
  if (!guy.attachmentHeight) {
    console.log(`Guy ${guy.id} missing attachmentHeight information`);
    return null;
  }
  
  return {
    id: guy.id,
    description: `Guy ${guy.id}`,
    owner: guy.owner || 'Unknown',
    height: guy.attachmentHeight,
    assemblyUnit: normalizeToString(guy.clientItem || guy.id)
  };
};

/**
 * Extract design layers from location data
 * This handles the case where designLayers might be present in the location object
 */
const extractDesignLayers = (location: any): Record<string, PoleLayer> => {
  const layers: Record<string, PoleLayer> = {
    EXISTING: {
      layerName: 'EXISTING',
      layerType: 'Measured',
      attachments: []
    }
  };
  
  // Check if designLayers exists and process each layer
  if (location.designLayers && typeof location.designLayers === 'object') {
    Object.keys(location.designLayers).forEach(layerName => {
      const layerData = location.designLayers[layerName];
      
      // Skip if layer already defined
      if (layers[layerName.toUpperCase()]) return;
      
      layers[layerName.toUpperCase()] = {
        layerName: layerName.toUpperCase(),
        layerType: layerName === 'REMEDY' ? 'Recommended' : 'Measured',
        attachments: []
      };
      
      // Process attachments in this layer if they exist
      if (layerData.attachments && Array.isArray(layerData.attachments)) {
        layerData.attachments.forEach((attachment: any) => {
          if (attachment.height) {
            layers[layerName.toUpperCase()].attachments.push({
              id: attachment.id || `attachment-${Math.random().toString(36).substr(2, 9)}`,
              description: attachment.description || `Attachment`,
              owner: attachment.owner || 'Unknown',
              height: attachment.height,
              assemblyUnit: attachment.assemblyUnit || 'Unknown'
            });
          }
        });
      }
    });
  }
  
  return layers;
};

/**
 * Extract pole data from SPIDAcalc JSON
 * @param jsonData The parsed JSON data
 * @returns Array of extracted pole objects
 */
export const extractPoleData = (jsonData: SPIDAcalcData): Pole[] => {
  console.log("Processing JSON data:", jsonData);
  
  // Try multiple data formats to be more flexible
  const poles: Pole[] = [];
  
  // Format 1: Process leads array (primary format according to clarification)
  if (jsonData.leads && Array.isArray(jsonData.leads)) {
    console.log("Found leads array format", jsonData.leads.length);
    
    jsonData.leads.forEach((lead, leadIndex) => {
      console.log(`Processing lead ${leadIndex}`, lead);
      
      if (!lead.locations || !Array.isArray(lead.locations)) {
        console.log(`Lead ${leadIndex} has no valid locations array`);
        return;
      }
      
      lead.locations.forEach((location, locationIndex) => {
        console.log(`Processing location ${locationIndex} in lead ${leadIndex}`, location);
        
        // Handle direct pole information in location (per clarification)
        const poleId = location.label || `Pole-${leadIndex}-${locationIndex}`;
        console.log(`Found pole ID: ${poleId}`);
        
        // Extract coordinates
        let coordinates;
        if (location.geographicCoordinate?.coordinates) {
          try {
            const [longitude, latitude] = location.geographicCoordinate.coordinates;
            coordinates = { latitude, longitude };
            console.log(`Extracted coordinates: ${latitude}, ${longitude}`);
          } catch (e) {
            console.error("Failed to parse coordinates:", e);
          }
        }
        
        // Try to get layers from designLayers directly if available
        let layers = extractDesignLayers(location);
        
        // If there are no designs, create a pole with just the basic information
        if (!location.designs || !Array.isArray(location.designs) || location.designs.length === 0) {
          console.log(`Location ${poleId} has no valid designs, creating basic pole`);
          
          // Create pole with basic information
          const pole: Pole = {
            structureId: poleId,
            alias: location.designs?.[0]?.structure?.pole?.externalId,
            coordinates,
            layers
          };
          
          poles.push(pole);
          return;
        }
        
        // Process each design (usually just one per location)
        location.designs.forEach((design, designIndex) => {
          if (!design.structure) {
            console.log(`Invalid design structure at index ${designIndex}`);
            return;
          }
          
          // Create the default layer structure if not already created
          if (Object.keys(layers).length === 0) {
            layers = {
              EXISTING: {
                layerName: 'EXISTING',
                layerType: 'Measured',
                attachments: []
              }
            };
          }
          
          // Process all attachment types
          try {
            const structure = design.structure;
            
            // Process wires
            if (structure.wires && Array.isArray(structure.wires)) {
              structure.wires.forEach(wire => {
                layers.EXISTING.attachments.push(wireToAttachment(wire));
              });
              console.log(`Processed ${structure.wires.length} wires`);
            }
            
            // Process insulators
            if (structure.insulators && Array.isArray(structure.insulators)) {
              structure.insulators.forEach(insulator => {
                const attachment = insulatorToAttachment(insulator);
                if (attachment) {
                  layers.EXISTING.attachments.push(attachment);
                }
              });
              console.log(`Processed ${structure.insulators.length} insulators`);
            }
            
            // Process equipment
            if (structure.equipments && Array.isArray(structure.equipments)) {
              structure.equipments.forEach(equipment => {
                const attachment = equipmentToAttachment(equipment);
                if (attachment) {
                  layers.EXISTING.attachments.push(attachment);
                }
              });
              console.log(`Processed ${structure.equipments.length} equipment items`);
            }
            
            // Process guys
            if (structure.guys && Array.isArray(structure.guys)) {
              structure.guys.forEach(guy => {
                const attachment = guyToAttachment(guy);
                if (attachment) {
                  layers.EXISTING.attachments.push(attachment);
                }
              });
              console.log(`Processed ${structure.guys.length} guys`);
            }
          } catch (e) {
            console.error("Error processing attachments:", e);
          }
          
          // Process remedies if available
          if (location.remedies && Array.isArray(location.remedies) && location.remedies.length > 0) {
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
                height: { value: 0, unit: 'METRE' },
                assemblyUnit: normalizeToString(remedy.type || 'Unknown')
              });
            });
            console.log(`Processed ${location.remedies.length} remedies`);
          }
          
          // Extract structureId from either design.structure.pole or location
          const structureId = design.structure.pole?.id || 
                             design.structure.pole?.externalId || 
                             poleId;
          
          // Create pole object using structure ID
          const pole: Pole = {
            structureId,
            alias: design.structure.pole?.externalId,
            coordinates,
            layers
          };
          
          poles.push(pole);
          console.log(`Added pole with ID ${pole.structureId}`);
        });
      });
    });
    
    console.log(`Extracted ${poles.length} poles from leads data`);
    if (poles.length > 0) {
      return poles;
    }
  }
  
  // Format 2: Check for pre-processed poles
  if (jsonData.poles && Array.isArray(jsonData.poles)) {
    console.log("Found pre-processed poles array", jsonData.poles.length);
    return jsonData.poles;
  }
  
  // Format 3: Check for legacy locations array
  if (jsonData.locations && Array.isArray(jsonData.locations)) {
    console.log("Found legacy locations array format", jsonData.locations.length);
    
    jsonData.locations.forEach((location: Location) => {
      if (!location.label) {
        console.log("Location missing label, skipping");
        return;
      }
      
      // Extract coordinates
      let coordinates;
      if (location.geographicCoordinate?.coordinates) {
        const [longitude, latitude] = location.geographicCoordinate.coordinates;
        coordinates = { latitude, longitude };
      }
      
      const layers: Record<string, PoleLayer> = {
        EXISTING: {
          layerName: 'EXISTING',
          layerType: 'Measured',
          attachments: []
        }
      };
      
      // Process each design if available
      if (location.designs && Array.isArray(location.designs) && location.designs.length > 0) {
        location.designs.forEach((design: Design) => {
          if (design.structure?.pole) {
            // Process wires
            if (design.structure.wires && Array.isArray(design.structure.wires)) {
              design.structure.wires.forEach(wire => {
                layers.EXISTING.attachments.push(wireToAttachment(wire));
              });
            }
            
            // Process other attachment types here...
          }
        });
      }
      
      // Process remedies if available
      if (location.remedies && Array.isArray(location.remedies) && location.remedies.length > 0) {
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
            height: { value: 0, unit: 'METRE' },
            assemblyUnit: normalizeToString(remedy.type || 'Unknown')
          });
        });
      }
      
      // Create pole object
      const pole: Pole = {
        structureId: location.label,
        alias: location.designs?.[0]?.structure?.pole?.externalId,
        coordinates,
        layers
      };
      
      poles.push(pole);
    });
    
    console.log(`Extracted ${poles.length} poles from locations data`);
    if (poles.length > 0) {
      return poles;
    }
  }
  
  // Format 4: Fall back to clientData.poles as a last resort
  if (jsonData.clientData?.poles && Array.isArray(jsonData.clientData.poles)) {
    console.log("Falling back to clientData.poles", jsonData.clientData.poles.length);
    return jsonData.clientData.poles.map((clientPole, index) => {
      const pole: Pole = {
        structureId: `P${String(index + 1).padStart(3, '0')}`,
        alias: clientPole.aliases?.[0]?.id || undefined,
        layers: {
          EXISTING: {
            layerName: 'EXISTING',
            layerType: 'Measured',
            attachments: [],
            poleDetails: {
              owner: 'Unknown',
              poleType: clientPole.species,
              glc: 0, // Default value
              agl: clientPole.height.value
            }
          }
        }
      };
      return pole;
    });
  }
  
  // No valid data found
  console.log("No valid pole data found in the JSON structure");
  return [];
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
      
      if (!layer.attachments) {
        layer.attachments = [];
        return;
      }
      
      layer.attachments = layer.attachments.map(attachment => {
        // Ensure assemblyUnit is always a string
        if (attachment.assemblyUnit && typeof attachment.assemblyUnit !== 'string') {
          attachment.assemblyUnit = normalizeToString(attachment.assemblyUnit);
        }
        
        // Validate assemblyUnit
        const assemblyUnit = attachment.assemblyUnit;
        const isValid = typeof assemblyUnit === 'string' ? 
                        assemblyUnit.trim().length > 0 : 
                        !!assemblyUnit;
        
        return {
          ...attachment,
          isValid
        };
      });
    });
    
    return validatedPole;
  });
};
