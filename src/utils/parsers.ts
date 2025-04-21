
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
 * Convert Wire objects to PoleAttachment objects
 */
const wireToAttachment = (wire: Wire): PoleAttachment => {
  return {
    id: wire.id,
    description: wire.description || `Wire ${wire.id}`,
    owner: wire.owner || 'Unknown',
    height: wire.attachmentHeight,
    assemblyUnit: wire.clientItem || wire.id
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
    assemblyUnit: insulator.clientItem || insulator.id
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
    assemblyUnit: equipment.clientItem || equipment.id
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
    assemblyUnit: guy.clientItem || guy.id
  };
};

/**
 * Extract pole data from SPIDAcalc JSON
 * @param jsonData The parsed JSON data
 * @returns Array of extracted pole objects
 */
export const extractPoleData = (jsonData: SPIDAcalcData): Pole[] => {
  console.log("Processing JSON data:", jsonData);

  // Check for leads array format first (newer format)
  if (jsonData.leads && Array.isArray(jsonData.leads) && jsonData.leads.length > 0) {
    console.log("Found leads array format", jsonData.leads.length);
    const poles: Pole[] = [];
    
    jsonData.leads.forEach((lead, leadIndex) => {
      console.log(`Processing lead ${leadIndex}`, lead);
      
      if (!lead.locations || !Array.isArray(lead.locations)) {
        console.log(`Lead ${leadIndex} has no valid locations array`);
        return;
      }
      
      lead.locations.forEach((location, locationIndex) => {
        console.log(`Processing location ${locationIndex} in lead ${leadIndex}`, location);
        
        if (!location.designs || !Array.isArray(location.designs) || location.designs.length === 0) {
          console.log(`Location ${location.label || locationIndex} has no valid designs`);
          return;
        }
        
        // Process each design (usually just one per location)
        location.designs.forEach((design, designIndex) => {
          if (!design.structure?.pole) {
            console.log(`Invalid design structure at index ${designIndex}`);
            return;
          }
          
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
          
          // Create the default layer structure
          const layers: Record<string, PoleLayer> = {
            EXISTING: {
              layerName: 'EXISTING',
              layerType: 'Measured',
              attachments: []
            }
          };
          
          // Process all attachment types
          try {
            // Process wires
            if (design.structure.wires && Array.isArray(design.structure.wires)) {
              design.structure.wires.forEach(wire => {
                layers.EXISTING.attachments.push(wireToAttachment(wire));
              });
              console.log(`Processed ${design.structure.wires.length} wires`);
            }
            
            // Process insulators
            if (design.structure.insulators && Array.isArray(design.structure.insulators)) {
              design.structure.insulators.forEach(insulator => {
                const attachment = insulatorToAttachment(insulator);
                if (attachment) {
                  layers.EXISTING.attachments.push(attachment);
                }
              });
              console.log(`Processed ${design.structure.insulators.length} insulators`);
            }
            
            // Process equipment
            if (design.structure.equipments && Array.isArray(design.structure.equipments)) {
              design.structure.equipments.forEach(equipment => {
                const attachment = equipmentToAttachment(equipment);
                if (attachment) {
                  layers.EXISTING.attachments.push(attachment);
                }
              });
              console.log(`Processed ${design.structure.equipments.length} equipment items`);
            }
            
            // Process guys
            if (design.structure.guys && Array.isArray(design.structure.guys)) {
              design.structure.guys.forEach(guy => {
                const attachment = guyToAttachment(guy);
                if (attachment) {
                  layers.EXISTING.attachments.push(attachment);
                }
              });
              console.log(`Processed ${design.structure.guys.length} guys`);
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
                assemblyUnit: remedy.type || 'Unknown'
              });
            });
            console.log(`Processed ${location.remedies.length} remedies`);
          }
          
          // Create pole object using location label as structureId
          const pole: Pole = {
            structureId: location.label || `Pole-${leadIndex}-${locationIndex}`,
            alias: design.structure.pole.externalId,
            coordinates,
            layers
          };
          
          poles.push(pole);
          console.log(`Added pole with ID ${pole.structureId}`);
        });
      });
    });
    
    console.log(`Extracted ${poles.length} poles from leads data`);
    return poles;
  }
  
  // Check if the data contains pre-processed poles
  if (jsonData.poles && Array.isArray(jsonData.poles)) {
    console.log("Found pre-processed poles array", jsonData.poles.length);
    return jsonData.poles;
  }

  // Check for clientData.poles
  if (jsonData.clientData?.poles && Array.isArray(jsonData.clientData.poles)) {
    console.log("Found poles in clientData", jsonData.clientData.poles.length);
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

  // Check for locations array
  if (!jsonData.locations || !Array.isArray(jsonData.locations)) {
    console.log("No valid pole data found in the JSON structure", jsonData);
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
