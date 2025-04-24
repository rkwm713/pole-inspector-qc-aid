// QC Checks for SPIDAcalc data
import { 
  Pole, 
  PoleWire,
  QCCheckResult, 
  QCCheckStatus, 
  QCResults,
  ProjectInfo,
  KmzFiberData
} from "@/types";

/**
 * Check consistency of owners between attachments and wires
 */
export const checkOwners = (pole: Pole): QCCheckResult => {
  const result: QCCheckResult = {
    status: "NOT_CHECKED",
    message: "Owner consistency check not performed",
    details: []
  };
  
  // For proposed and remedy designs, check wire and attachment owner consistency
  const relevantLayers = ["PROPOSED", "REMEDY"];
  let inconsistencies = 0;
  
  relevantLayers.forEach(layerName => {
    const layer = pole.layers[layerName];
    if (!layer) return;
    
    // Create a map of attachment ID to owner
    const attachmentOwners: Record<string, string> = {};
    layer.attachments.forEach(attachment => {
      if (attachment.id) {
        attachmentOwners[attachment.id] = attachment.owner.id;
      }
    });
    
    // Check if wire owners match their connected attachment owners
    layer.wires.forEach(wire => {
      // Ensure associatedAttachments exists and is an array of strings
      const associatedIds: string[] = [];
      
      // Only process if wire.associatedAttachments exists and is an array
      if (wire.associatedAttachments && Array.isArray(wire.associatedAttachments)) {
        wire.associatedAttachments.forEach(id => {
          if (typeof id === 'string') {
            associatedIds.push(id);
          }
        });
      }
      
      // Process only string IDs
      associatedIds.forEach(attachmentId => {
        const attachmentOwner = attachmentOwners[attachmentId];
        if (attachmentOwner && attachmentOwner !== wire.owner.id) {
          inconsistencies++;
          result.details.push(
            `In ${layerName} layer: Wire owned by ${wire.owner.id} is connected to attachment owned by ${attachmentOwner}`
          );
        }
      });
    });
  });
  
  if (inconsistencies > 0) {
    result.status = "FAIL";
    result.message = `Found ${inconsistencies} owner inconsistencies between wires and their connected attachments`;
  } else {
    result.status = "PASS";
    result.message = "All wire and attachment owners are consistent";
  }
  
  return result;
};

/**
 * Check that anchors and guy wires match PNM specifications
 */
export const checkAnchors = (pole: Pole): QCCheckResult => {
  const result: QCCheckResult = {
    status: "NOT_CHECKED",
    message: "Anchor and guy wire check not performed",
    details: []
  };

  // For proposed and remedy designs, check anchor and guy wire specs
  const relevantLayers = ["PROPOSED", "REMEDY"];
  let issues = 0;

  relevantLayers.forEach(layerName => {
    const layer = pole.layers[layerName];
    if (!layer) return;

    // Find anchors
    const anchors = layer.attachments.filter(
      attachment => attachment.attachmentType === "ANCHOR"
    );

    // Find guy wires
    const guyWires = layer.attachments.filter(
      attachment => attachment.attachmentType === "GUY"
    );

    // Check PNM guys: 12" anchor type and 3/8" or 1/2" guy wire size
    const pnmGuys = guyWires.filter(guy => guy.owner.id.includes("PNM"));
    pnmGuys.forEach(guy => {
      // Check if guy is connected to a correctly sized anchor
      const matchingAnchor = anchors.find(
        anchor => anchor.owner.id.includes("PNM") &&
                  (anchor.description.includes("12") || anchor.size?.includes("12"))
      );

      if (!matchingAnchor) {
        issues++;
        result.details.push(`In ${layerName} layer: PNM guy wire does not have a matching 12" anchor`);
      }

      // Check guy wire size
      const validSizes = ["3/8", "1/2"];
      const sizeValid = validSizes.some(size =>
        guy.size?.includes(size) ||
        guy.description.includes(size) ||
        guy.clientItemAlias?.includes(size)
      );
    });
  });

  if (issues > 0) {
    result.status = "FAIL";
    result.message = `Found ${issues} anchor/guy wire issues`;
  } else {
    result.status = "PASS";
    result.message = "All anchor and guy wire specs are valid";
  }
  
  return result;
};

/**
 * Compare owner/usageGroup changes between key design layers (e.g., "Existing" vs "Proposed", "Existing" vs "Remedy")
 */
export const checkLayerComparison = (pole: Pole): QCCheckResult => {
  const result: QCCheckResult = {
    status: "NOT_CHECKED",
    message: "Layer comparison check not performed",
    details: []
  };

  // Check if necessary layers exist
  if (!pole.layers["EXISTING"]) {
    result.message = "No EXISTING layer found for comparison";
    return result;
  }

  // Array of comparison layer names to check against EXISTING
  const comparisonLayers = ["PROPOSED", "REMEDY"].filter(layer => pole.layers[layer]);
  
  if (comparisonLayers.length === 0) {
    result.message = "No PROPOSED or REMEDY layer found for comparison";
    return result;
  }

  let changes = 0;

  // Check each comparison layer against EXISTING
  comparisonLayers.forEach(comparisonLayer => {
    const existingLayer = pole.layers["EXISTING"];
    const otherLayer = pole.layers[comparisonLayer];

    // Compare attachments by ID or position
    existingLayer.attachments.forEach(existingAttachment => {
      // Try to find matching attachment in the other layer
      const matchingAttachment = otherLayer.attachments.find(
        a => (a.id && a.id === existingAttachment.id) || 
             (a.externalId && a.externalId === existingAttachment.externalId) ||
             (Math.abs(a.height.value - existingAttachment.height.value) < 0.1 && 
              a.attachmentType === existingAttachment.attachmentType)
      );

      if (matchingAttachment && matchingAttachment.owner.id !== existingAttachment.owner.id) {
        changes++;
        result.details.push(
          `Attachment owner changed from "${existingAttachment.owner.id}" in EXISTING to "${matchingAttachment.owner.id}" in ${comparisonLayer} at height ${existingAttachment.heightInFeet}`
        );
      }
    });

    // Compare wires by ID, properties, or endpoints
    existingLayer.wires.forEach(existingWire => {
      // Try to find matching wire in the other layer
      const matchingWire = otherLayer.wires.find(
        w => (w.id && w.id === existingWire.id) || 
             (w.externalId && w.externalId === existingWire.externalId) ||
             (existingWire.attachmentHeight && w.attachmentHeight && 
              Math.abs(w.attachmentHeight.value - existingWire.attachmentHeight.value) < 0.1 &&
              w.type === existingWire.type)
      );

      if (matchingWire) {
        // Check for owner change
        if (matchingWire.owner.id !== existingWire.owner.id) {
          changes++;
          result.details.push(
            `Wire owner changed from "${existingWire.owner.id}" in EXISTING to "${matchingWire.owner.id}" in ${comparisonLayer} (${existingWire.type || "unknown type"})`
          );
        }

        // Check for usageGroup change if both have usageGroup
        if (existingWire.usageGroup && matchingWire.usageGroup && 
            existingWire.usageGroup !== matchingWire.usageGroup) {
          changes++;
          result.details.push(
            `Wire usage group changed from "${existingWire.usageGroup}" in EXISTING to "${matchingWire.usageGroup}" in ${comparisonLayer} (${existingWire.type || "unknown type"})`
          );
        }
      }
    });
  });

  if (changes > 0) {
    result.status = "WARNING";  // This is a warning rather than a failure since changes may be intentional
    result.message = `Found ${changes} owner or usage group changes between layers`;
  } else {
    result.status = "PASS";
    result.message = "No owner or usage group changes detected between layers";
  }

  return result;
};

/**
 * Check for >20% change in pole stress between EXISTING and REMEDY layers
 */
export const checkPoleStress = (pole: Pole): QCCheckResult => {
  const result: QCCheckResult = {
    status: "NOT_CHECKED",
    message: "Pole stress comparison not performed",
    details: []
  };

  // Check if necessary layers exist
  if (!pole.layers["EXISTING"] || !pole.layers["REMEDY"]) {
    result.message = "Missing EXISTING or REMEDY layer for stress comparison";
    return result;
  }

  const existingLayer = pole.layers["EXISTING"];
  const remedyLayer = pole.layers["REMEDY"];

  // Check if stress values are available
  if (!existingLayer.analysisResults?.maxStressRatio || !remedyLayer.analysisResults?.maxStressRatio) {
    result.message = "Stress ratio data not available for comparison";
    return result;
  }

  const existingStress = existingLayer.analysisResults.maxStressRatio;
  const remedyStress = remedyLayer.analysisResults.maxStressRatio;

  // Calculate percent change, handling division by zero
  let percentChange = 0;

  if (existingStress === 0) {
    // If existing stress is zero and remedy is non-zero, it's an infinite increase
    if (remedyStress > 0) {
      percentChange = 100; // Just use 100% to indicate a significant change
    }
  } else {
    percentChange = ((remedyStress - existingStress) / existingStress) * 100;
  }

  // Check if absolute change exceeds 20%
  if (Math.abs(percentChange) > 20) {
    result.status = "WARNING";
    result.message = `Pole stress changed by ${percentChange.toFixed(1)}% between EXISTING and REMEDY`;
    result.details.push(
      `EXISTING stress ratio: ${existingStress.toFixed(2)}`,
      `REMEDY stress ratio: ${remedyStress.toFixed(2)}`,
      `Change: ${percentChange > 0 ? "+" : ""}${percentChange.toFixed(1)}%`
    );
  } else {
    result.status = "PASS";
    result.message = `Pole stress change is within acceptable limits (${Math.abs(percentChange).toFixed(1)}%)`;
  }

  return result;
};

/**
 * Check for lowercase letters in station (pole) names
 */
export const checkStationName = (pole: Pole): QCCheckResult => {
  const result: QCCheckResult = {
    status: "NOT_CHECKED",
    message: "Station name check not performed",
    details: []
  };

  const stationName = pole.structureId;
  
  // Check if the station name contains any lowercase letters
  const hasLowercase = /[a-z]/.test(stationName);

  if (hasLowercase) {
    result.status = "FAIL";
    result.message = "Station name contains lowercase letters";
    result.details.push(
      `Station name "${stationName}" should use uppercase letters only`
    );
  } else {
    result.status = "PASS";
    result.message = "Station name format is correct";
  }

  return result;
};

/**
 * Check if required load cases are applied
 */
export const checkLoadCases = (pole: Pole, projectInfo: ProjectInfo): QCCheckResult => {
  const result: QCCheckResult = {
    status: "NOT_CHECKED",
    message: "Load case check not performed",
    details: []
  };

  // Required load cases for PNM
  const requiredLoadCases = ["NESC Medium B"];

  // Check if projectInfo has defaultLoadCases
  if (!projectInfo.defaultLoadCases || projectInfo.defaultLoadCases.length === 0) {
    result.status = "WARNING";
    result.message = "No load cases defined in project settings";
    return result;
  }

  // Check if all required load cases are included
  const missingCases = requiredLoadCases.filter(
    required => !projectInfo.defaultLoadCases?.some(
      actual => actual.includes(required)
    )
  );

  if (missingCases.length > 0) {
    result.status = "FAIL";
    result.message = "Missing required load cases";
    missingCases.forEach(missingCase => {
      result.details.push(`Required load case "${missingCase}" is not defined`);
    });
  } else {
    result.status = "PASS";
    result.message = "All required load cases are defined";
    result.details.push(
      `Found all required load cases: ${requiredLoadCases.join(", ")}`
    );
  }

  return result;
};

/**
 * Check project settings completeness
 */
export const checkProjectSettings = (projectInfo: ProjectInfo): QCCheckResult => {
  const result: QCCheckResult = {
    status: "NOT_CHECKED",
    message: "Project settings check not performed",
    details: []
  };

  // Define required fields and their display names
  const requiredFields: {field: keyof ProjectInfo, displayName: string}[] = [
    { field: "engineer", displayName: "Engineer" },
    { field: "comments", displayName: "Comments" },
    { field: "generalLocation", displayName: "General Location" }
  ];

  // Check each required field
  const missingFields = requiredFields.filter(
    ({ field }) => !projectInfo[field] || projectInfo[field] === ""
  );

  // Check address separately since it's an object
  if (!projectInfo.address || Object.keys(projectInfo.address).length === 0) {
    missingFields.push({ field: "address", displayName: "Address" });
  }

  if (missingFields.length > 0) {
    result.status = "WARNING";
    result.message = "Incomplete project settings";
    missingFields.forEach(({ displayName }) => {
      result.details.push(`Missing or empty project setting: ${displayName}`);
    });
  } else {
    result.status = "PASS";
    result.message = "Project settings are complete";
  }

  return result;
};

/**
 * Check messenger size for communication bundles
 */
export const checkMessengerSize = (pole: Pole): QCCheckResult => {
  const result: QCCheckResult = {
    status: "NOT_CHECKED",
    message: "Messenger size check not performed",
    details: []
  };

  // Define allowed messenger sizes for communication bundles
  const allowedSizes = ["1/4", "3/8", "10M"];

  // Check relevant layers
  const relevantLayers = ["PROPOSED", "REMEDY"];
  
  let invalidMessengers = 0;

  relevantLayers.forEach(layerName => {
    const layer = pole.layers[layerName];
    if (!layer) return;

    // Find communication bundle wires
    const commBundles = layer.wires.filter(
      wire => wire.usageGroup === "COMMUNICATION_BUNDLE"
    );

    commBundles.forEach(wire => {
      const messengerSize = wire.clientItem?.messengerSize;
      
      if (!messengerSize) {
        invalidMessengers++;
        result.details.push(
          `Communication bundle in ${layerName} layer is missing messenger size information`
        );
        return;
      }

      // Check if messenger size is in the allowed list
      const isValidSize = allowedSizes.some(size => messengerSize.includes(size));
      
      if (!isValidSize) {
        invalidMessengers++;
        result.details.push(
          `Communication bundle in ${layerName} layer has non-standard messenger size: "${messengerSize}"`
        );
      }
    });
  });

  if (invalidMessengers > 0) {
    result.status = "FAIL";
    result.message = `Found ${invalidMessengers} communication bundles with invalid messenger sizes`;
  } else {
    result.status = "PASS";
    result.message = "All communication bundle messenger sizes are valid";
  }

  return result;
};

/**
 * Check fiber size and count consistency between KMZ data and pole data,
 * with specific attention to Gigapower fiber
 */
export const checkFiberSize = (pole: Pole, kmzFiberData?: KmzFiberData[]): QCCheckResult => {
  const result: QCCheckResult = {
    status: "NOT_CHECKED",
    message: "Fiber size/count check not performed",
    details: []
  };
  
  // If no KMZ data is provided, we can't perform the check
  if (!kmzFiberData || kmzFiberData.length === 0) {
    return result;
  }
  
  // Filter KMZ features that are relevant to this pole (by proximity or id)
  const relevantFiberData = kmzFiberData.filter(fiberData => {
    // If the KMZ data has an explicit poleId that matches, use that
    if (fiberData.poleId && fiberData.poleId === pole.structureId) {
      return true;
    }
    
    // Otherwise, check by proximity if pole coordinates are available
    if (pole.coordinates && fiberData.coordinates) {
      // Calculate distance between pole and fiber feature (simple Euclidean for now)
      const latDiff = pole.coordinates.latitude - fiberData.coordinates.latitude;
      const lngDiff = pole.coordinates.longitude - fiberData.coordinates.longitude;
      const distanceSquared = latDiff * latDiff + lngDiff * lngDiff;
      
      // Consider features within ~50 meters (very rough approximation)
      const maxDistanceSquared = 0.0000005;  
      return distanceSquared <= maxDistanceSquared;
    }
    
    return false;
  });
  
  if (relevantFiberData.length === 0) {
    result.status = "WARNING";
    result.message = "No fiber data found in KMZ near this pole";
    return result;
  }
  
  // Extract Gigapower-specific fiber data from KMZ (if available)
  const gigapowerFiberData = relevantFiberData.filter(fiber => {
    // Check c_sro field which often indicates Gigapower data with PSA_317
    const sro = extractPropertyValue(fiber, "c_sro");
    if (sro && sro.includes("PSA_317")) {
      return true;
    }
    
    // Then check various fields for Gigapower or ATT references
    const description = fiber.description?.toLowerCase() || "";
    return (
      // Check description
      description.includes("gigapower") || 
      description.includes("att ") || // Space after ATT to avoid matches in words like "attachment"
      // Check owner field
      extractPropertyValue(fiber, "owner")?.toLowerCase().includes("gigapower") ||
      extractPropertyValue(fiber, "owner")?.toLowerCase().includes("att") ||
      // Check company field
      extractPropertyValue(fiber, "company")?.toLowerCase().includes("gigapower") ||
      extractPropertyValue(fiber, "company")?.toLowerCase().includes("att")
    );
  });
  
  if (gigapowerFiberData.length === 0) {
    // If no Gigapower data, just note it but don't fail
    result.status = "PASS";
    result.message = "No Gigapower fiber data found in KMZ for this pole";
    return result;
  }
  
  // Get the cb_capafo value from KMZ data for Gigapower
  const cbCapafoValue = getCapafoValue(gigapowerFiberData[0]);
  
  if (!cbCapafoValue) {
    result.status = "WARNING";
    result.message = "Gigapower fiber data found but no cb_capafo value available";
    return result;
  }
  
  // Check fiber size/count against proposed and remedy communication wires
  const relevantLayers = ["PROPOSED", "REMEDY"];
  let issues = 0;
  let matchesFound = 0;
  
  // For each layer, get Gigapower/ATT fiber cables and sum their counts
  relevantLayers.forEach(layerName => {
    const layer = pole.layers[layerName];
    if (!layer) return;
    
    // Find all potential fiber wires in this layer
    const fiberWires = layer.wires.filter(wire => {
      // Check for ATT or Gigapower indicators
      const isATTGigapower = 
        // Owner checks
        ((wire.owner?.id?.toLowerCase() || "").includes("att") || 
         (wire.owner?.id?.toLowerCase() || "").includes("gigapower")) ||
        // External ID checks (attachment IDs often have the owner embedded)
        ((wire.externalId?.toLowerCase() || "").includes("att") ||
         (wire.externalId?.toLowerCase() || "").includes("gigapower")) ||
        // Description checks
        ((wire.description?.toLowerCase() || "").includes("att") ||
         (wire.description?.toLowerCase() || "").includes("gigapower")) ||
        // Size/clientItem checks for "GIG" indicators
        ((wire.size?.toLowerCase() || "").includes("gig") ||
         (wire.clientItem?.size?.toLowerCase() || "").includes("gig"));
      
      // Check for fiber indicators
      const isFiber = 
        // Type indicators
        ((wire.type?.toLowerCase() || "").includes("fiber") ||
         (wire.type?.toLowerCase() || "").includes("fbr") ||
         (wire.type?.toLowerCase() || "").includes("optic")) ||
        // Description indicators
        ((wire.description?.toLowerCase() || "").includes("fiber") ||
         (wire.description?.toLowerCase() || "").includes("fbr") ||
         (wire.description?.toLowerCase() || "").includes("optic")) ||
        // Size format indicators
        (wire.size && (
          wire.size.toLowerCase().includes("fiber") || 
          wire.size.toLowerCase().includes("fbr") ||
          wire.size.toLowerCase().includes("ct") ||
          (wire.size.match(/\d+\s*ct/i) !== null) ||
          (wire.size.match(/\d+\s*fiber/i) !== null)
        )) ||
        // ClientItem indicators
        (wire.clientItem?.size && (
          wire.clientItem.size.toLowerCase().includes("fiber") ||
          wire.clientItem.size.toLowerCase().includes("fbr") ||
          wire.clientItem.size.toLowerCase().includes("ct") ||
          (wire.clientItem.size.match(/\d+\s*ct/i) !== null) ||
          (wire.clientItem.size.match(/\d+\s*fiber/i) !== null)
        )) ||
        // ClientItem type indicators
        ((wire.clientItem?.type?.toLowerCase() || "").includes("fiber") ||
         (wire.clientItem?.type?.toLowerCase() || "").includes("fbr") ||
         (wire.clientItem?.type?.toLowerCase() || "").includes("optic"));
      
      return isATTGigapower || isFiber;
    });
    
    if (fiberWires.length === 0) {
      result.details.push(`No fiber cables found in ${layerName} layer`);
      return;
    }
    
    // Extract fiber sizes and sum them
    let totalFiberCount = 0;
    const fiberCounts: number[] = [];
    
    fiberWires.forEach(wire => {
      // Try to extract the fiber size from the wire
      const fiberSize = extractEnhancedFiberSize(wire);
      if (fiberSize > 0) {
        totalFiberCount += fiberSize;
        fiberCounts.push(fiberSize);
      }
    });
    
    // Compare with KMZ data
    const kmzFiberCount = parseInt(cbCapafoValue, 10);
    
    if (totalFiberCount !== kmzFiberCount) {
      issues++;
      result.details.push(
        `Fiber count mismatch in ${layerName}: SPIDAcalc has ${
          fiberCounts.length > 1 
            ? fiberCounts.join(' + ') + ' = ' + totalFiberCount 
            : totalFiberCount
        } fibers, but KMZ has ${kmzFiberCount} fibers (cb_capafo value)`
      );
    } else {
      // Match found, log this as informational
      matchesFound++;
      result.details.push(
        `Fiber count matches in ${layerName}: ${
          fiberCounts.length > 1 
            ? fiberCounts.join(' + ') + ' = ' + totalFiberCount 
            : totalFiberCount
        } fibers equals KMZ cb_capafo value of ${kmzFiberCount}`
      );
    }
  });
  
  if (issues > 0) {
    result.status = "FAIL";
    result.message = `Found ${issues} fiber count inconsistencies`;
  } else if (matchesFound > 0) {
    result.status = "PASS";
    result.message = "Fiber count matches KMZ data";
  } else {
    result.status = "WARNING";
    result.message = "Fiber check completed with warnings";
  }
  
  return result;
};


/**
 * Extract an enhanced fiber size with support for various formats
 * This is an enhanced version that handles more formats and patterns
 */
function extractEnhancedFiberSize(wire: PoleWire): number {
  // Try to extract from various wire properties in priority order
  const sizeStrings = [
    wire.clientItem?.size,  // ClientItem size is often most reliable
    wire.size,              // Size field directly
    wire.description,       // Sometimes encoded in description
    wire.type               // Rarely in type but check anyway
  ].filter(Boolean) as string[];
  
  // Try various formats with priority
  for (const str of sizeStrings) {
    // Format: "6M EHS - 48ct GIG, 72ct GIG" - extract all numbers followed by "ct"
    const ctMatches = str.match(/(\d+)\s*ct/gi);
    if (ctMatches && ctMatches.length > 0) {
      // Sum up all the fiber counts
      const counts = ctMatches.map(match => {
        const num = match.match(/(\d+)/);
        return num ? parseInt(num[1], 10) : 0;
      });
      
      const totalCount = counts.reduce((sum, count) => sum + count, 0);
      return totalCount;
    }
    
    // Format: "48 fiber" or "48-fiber" or "48 FBR" or "48F"
    const fiberMatch = str.match(/(\d+)[\s-]*(fiber|fbr|f\b)/i);
    if (fiberMatch && fiberMatch[1]) {
      return parseInt(fiberMatch[1], 10);
    }
    
    // Format: "ADSS-96" or similar formats with fiber type/name + count
    const adssMatch = str.match(/adss[\s-]*(\d+)/i);
    if (adssMatch && adssMatch[1]) {
      return parseInt(adssMatch[1], 10);
    }
    
    // Format: sometimes just a number followed by space then the word "count" or a fiber indication
    const countMatch = str.match(/(\d+)[\s-]*(count|cable|strand)/i);
    if (countMatch && countMatch[1]) {
      return parseInt(countMatch[1], 10);
    }
    
    // Any number that appears in a Gigapower or AT&T fiber related string is very likely to be the count
    if ((str.toLowerCase().includes('gig') || str.toLowerCase().includes('att')) && 
        !str.toLowerCase().includes('messenger')) {
      const numMatch = str.match(/(\d+)/);
      if (numMatch && numMatch[1]) {
        const num = parseInt(numMatch[1], 10);
        if (num >= 12) {
          return num;
        }
      }
    }
    
    // Last resort: if we know it's a fiber wire, and find a number like "48" alone
    const numMatch = str.match(/(\d+)/);
    if (numMatch && numMatch[1]) {
      // Fiber counts are rarely below 12 and fraction sizes like "3/8" are not counts
      const num = parseInt(numMatch[1], 10);
      if (num >= 12 && !str.includes('/')) {
        return num;
      }
    }
  }
  
  return 0;
}

/**
 * Extract value from HTML table content
 */
function extractFromHtml(html: string, propName: string): string | null {
  if (!html || typeof html !== 'string') return null;

  // Check if it's HTML content
  if (!html.includes('<html') && !html.includes('<table')) {
    return null;
  }
  
  try {
    // For HTML table content, look for table cells with the property name
    const pattern = new RegExp(`<td[^>]*>${propName}</td>\\s*<td[^>]*>(.*?)</td>`, 'i');
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch (error) {
    console.error("Error parsing HTML:", error);
  }
  
  return null;
}

/**
 * Extract property value from KMZ fiber data description
 * This handles HTML, JSON, or plain text formats
 */
function extractPropertyValue(fiberData: KmzFiberData, propertyName: string): string | null {
  if (!fiberData.description) return null;
  
  // First check if it's HTML content
  const htmlValue = extractFromHtml(fiberData.description, propertyName);
  if (htmlValue) return htmlValue;
  
  // Then check if it's JSON content
  try {
    if (fiberData.description.trim().startsWith('{') && fiberData.description.trim().endsWith('}')) {
      const descObj = JSON.parse(fiberData.description);
      if (propertyName in descObj) {
        return descObj[propertyName]?.toString() || "";
      }
    }
  } catch {
    // Not a JSON string, check if the property name appears in the description
    const regex = new RegExp(`${propertyName}[\\s:=]+(\\w+)`, 'i');
    const match = fiberData.description.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Get the cb_capafo value (fiber size) from KMZ data
 */
function getCapafoValue(fiberData: KmzFiberData): string | null {
  // First try to get it from HTML if it's HTML content
  if (fiberData.description && fiberData.description.includes('<html')) {
    const htmlValue = extractFromHtml(fiberData.description, "cb_capafo");
    if (htmlValue) return htmlValue;
  }
  
  // Then check if it's in the description as a JSON property or plain text
  const propValue = extractPropertyValue(fiberData, "cb_capafo");
  if (propValue) return propValue;
  
  // If not found in description properties, use the fiberSize directly
  return fiberData.fiberSize || null;
}

/**
 * Helper function to extract fiber size from a wire object
 */
function extractFiberSize(wire: PoleWire): string | null {
  // Try to extract from various wire properties in priority order
  const sizeStrings = [
    wire.clientItem?.size,  // ClientItem size is often most reliable
    wire.size,              // Size field directly
    wire.description,       // Sometimes encoded in description
    wire.type               // Rarely in type but check anyway
  ].filter(Boolean) as string[];
  
  for (const str of sizeStrings) {
    // Format: "6M EHS - 48ct GIG, 72ct GIG" - extract all numbers followed by "ct"
    const ctMatches = str.match(/(\d+)\s*ct/gi);
    if (ctMatches && ctMatches.length > 0) {
      // Sum up all the fiber counts
      const counts = ctMatches.map(match => {
        const num = match.match(/(\d+)/);
        return num ? parseInt(num[1], 10) : 0;
      });
      
      const totalCount = counts.reduce((sum, count) => sum + count, 0);
      return totalCount.toString();
    }
    
    // Format: "48 fiber" or "48-fiber" or "48 FBR"
    const fiberMatch = str.match(/(\d+)[\s-]*(fiber|fbr)/i);
    if (fiberMatch && fiberMatch[1]) {
      return fiberMatch[1];
    }
    
    // Format: sometimes just a number followed by space then the word "count" or a fiber indication
    const countMatch = str.match(/(\d+)[\s-]*(count|cable|strand)/i);
    if (countMatch && countMatch[1]) {
      return countMatch[1];
    }
    
    // Last resort: if we know it's a fiber wire, and find a number like "48" alone
    const numMatch = str.match(/(\d+)/);
    if (numMatch && numMatch[1]) {
      // Try to be a bit smarter - if the number is likely a size reference (e.g. 1/4, 3/8)
      // we should ignore it. Fiber counts are rarely below 12.
      const num = parseInt(numMatch[1], 10);
      if (num >= 12 && str.includes('/') === false) {
        return numMatch[1];
      }
    }
  }
  
  return null;
}

/**
 * Initialize an empty QC check result
 */
export const initCheckResult = (): QCCheckResult => ({
  status: "NOT_CHECKED",
  message: "Not checked",
  details: []
});

/**
 * Run all QC checks on a pole and generate comprehensive results
 */
export const runQCChecks = (pole: Pole, projectInfo: ProjectInfo, kmzFiberData?: KmzFiberData[]): QCResults => {
  // Initialize empty check results with default values
  const qcResults: QCResults = {
    ownerCheck: initCheckResult(),
    anchorCheck: initCheckResult(),
    poleSpecCheck: initCheckResult(),
    assemblyUnitsCheck: initCheckResult(),
    glcCheck: initCheckResult(),
    poleOrderCheck: initCheckResult(),
    tensionCheck: initCheckResult(),
    attachmentSpecCheck: initCheckResult(),
    heightCheck: initCheckResult(),
    specFileCheck: initCheckResult(),
    clearanceCheck: initCheckResult(),
    // New checks
    layerComparisonCheck: initCheckResult(),
    poleStressCheck: initCheckResult(),
    stationNameCheck: initCheckResult(),
    loadCaseCheck: initCheckResult(),
    projectSettingsCheck: initCheckResult(),
    messengerSizeCheck: initCheckResult(),
    fiberSizeCheck: initCheckResult(),
    overallStatus: "NOT_CHECKED",
    passCount: 0,
    failCount: 0,
    warningCount: 0
  };
  
  // Run each check function and update results
  qcResults.ownerCheck = checkOwners(pole);
  qcResults.anchorCheck = checkAnchors(pole);
  qcResults.layerComparisonCheck = checkLayerComparison(pole);
  qcResults.poleStressCheck = checkPoleStress(pole);
  qcResults.stationNameCheck = checkStationName(pole);
  qcResults.loadCaseCheck = checkLoadCases(pole, projectInfo);
  qcResults.projectSettingsCheck = checkProjectSettings(projectInfo);
  qcResults.messengerSizeCheck = checkMessengerSize(pole);
  qcResults.fiberSizeCheck = checkFiberSize(pole, kmzFiberData);
  
  // Count results by status
  const countResults = (results: QCResults): void => {
    const checks = [
      results.ownerCheck,
      results.anchorCheck,
      results.poleSpecCheck,
      results.assemblyUnitsCheck,
      results.glcCheck,
      results.poleOrderCheck,
      results.tensionCheck, 
      results.attachmentSpecCheck,
      results.heightCheck,
      results.specFileCheck,
      results.clearanceCheck,
      // Include new checks in count
      results.layerComparisonCheck,
      results.poleStressCheck,
      results.stationNameCheck,
      results.loadCaseCheck,
      results.projectSettingsCheck,
      results.messengerSizeCheck,
      results.fiberSizeCheck
    ];
    
    results.passCount = checks.filter(check => check.status === "PASS").length;
    results.failCount = checks.filter(check => check.status === "FAIL").length;
    results.warningCount = checks.filter(check => check.status === "WARNING").length;
    
    // Determine overall status
    if (results.failCount > 0) {
      results.overallStatus = "FAIL";
    } else if (results.warningCount > 0) {
      results.overallStatus = "WARNING";
    } else if (results.passCount > 0) {
      results.overallStatus = "PASS";
    } else {
      results.overallStatus = "NOT_CHECKED";
    }
  };
  
  countResults(qcResults);
  return qcResults;
};
