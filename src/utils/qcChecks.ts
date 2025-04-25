// QC Checks for SPIDAcalc data
import { 
  Pole, 
  PoleWire,
  QCCheckResult, 
  QCCheckStatus, 
  QCResults,
  ProjectInfo,
  KmzFiberData,
  WireEndPoint
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

// Import shared fiber utility functions
import { 
  calculateDistance,
  extractFiberSize,
  extractFromHtml,
  extractPropertyValue,
  getCapafoValue,
  isGigapowerData
} from "./fiberUtils";

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
  
  // Enhanced debugging
  console.log("KMZ QC Check for pole:", pole.structureId);
  
  // If no KMZ data is provided, we can't perform the check
  if (!kmzFiberData || kmzFiberData.length === 0) {
    console.log("No KMZ data available for fiber check");
    return result;
  }
  
  console.log("Total KMZ data points:", kmzFiberData.length);
  
  // Filter KMZ features that are relevant to this pole (by proximity or id)
  const relevantFiberData = kmzFiberData.filter(fiberData => {
    // If the KMZ data has an explicit poleId that matches, use that with more flexible matching
    if (fiberData.poleId && (
        fiberData.poleId === pole.structureId ||
        pole.structureId.includes(fiberData.poleId) ||
        fiberData.poleId.includes(pole.structureId)
      )) {
      console.log(`ID match found: KMZ ID ${fiberData.poleId} <-> Pole ${pole.structureId}`);
      return true;
    }
    
    // Otherwise, check by proximity if pole coordinates are available
    if (pole.coordinates && fiberData.coordinates) {
      // Use the same distance calculation as in KmzDataViewer for consistency
      const distance = calculateDistance(
        fiberData.coordinates.latitude, fiberData.coordinates.longitude,
        pole.coordinates.latitude, pole.coordinates.longitude
      );
      
      // Consider features within a more generous threshold
      // Using 0.00001 as threshold, which is approximately 1m depending on latitude
      const maxDistanceSquared = 0.00001;
      const isMatch = distance <= maxDistanceSquared;
      
      if (isMatch) {
        console.log(`Coordinate match found: KMZ at (${fiberData.coordinates.latitude.toFixed(6)}, 
          ${fiberData.coordinates.longitude.toFixed(6)}) <-> Pole at (${pole.coordinates.latitude.toFixed(6)}, 
          ${pole.coordinates.longitude.toFixed(6)}), distance: ${distance.toFixed(9)}`);
      }
      
      return isMatch;
    }
    
    return false;
  });
  
  console.log("Relevant KMZ data points found:", relevantFiberData.length);
  
  if (relevantFiberData.length === 0) {
    result.status = "WARNING";
    result.message = "No fiber data found in KMZ near this pole";
    return result;
  }
  
  // Extract Gigapower-specific fiber data from KMZ (if available)
  const gigapowerFiberData = relevantFiberData.filter(fiber => isGigapowerData(fiber));
  
  console.log("Gigapower/ATT KMZ data points found:", gigapowerFiberData.length);
  
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
  
  console.log(`Found cb_capafo value: ${cbCapafoValue}`);
  
  // Check fiber size/count against proposed and remedy communication wires
  const relevantLayers = ["PROPOSED", "REMEDY"];
  let issues = 0;
  let matchesFound = 0;
  
  // For each layer, get Gigapower/ATT fiber cables and sum their counts
  relevantLayers.forEach(layerName => {
    const layer = pole.layers[layerName];
    if (!layer) {
      console.log(`No ${layerName} layer found for pole ${pole.structureId}`);
      return;
    }
    
    console.log(`Checking ${layerName} layer for fiber wires...`);
    
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
    
    console.log(`Found ${fiberWires.length} potential fiber wires in ${layerName}`);
    
    if (fiberWires.length === 0) {
      result.details.push(`No fiber cables found in ${layerName} layer`);
      return;
    }
    
    // Extract fiber sizes and sum them using the consolidated function
    let totalFiberCount = 0;
    const fiberCounts: number[] = [];
    
    fiberWires.forEach(wire => {
      // Try to extract the fiber size from the wire using the shared function
      const fiberSize = extractFiberSize(wire);
      if (fiberSize > 0) {
        totalFiberCount += fiberSize;
        fiberCounts.push(fiberSize);
      }
    });
    
    console.log(`Total fiber count in ${layerName}: ${totalFiberCount} 
      (components: ${fiberCounts.join(', ')})`);
    
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
  wireEndPointOrderCheck: initCheckResult(),
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
  qcResults.wireEndPointOrderCheck = checkWireEndPointOrder(pole);
  
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
      results.fiberSizeCheck,
      results.wireEndPointOrderCheck
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

/**
 * Check if wireEndPoints in REMEDY design are in a different order from PROPOSED design
 * This can cause comparison issues in SPIDAcalc
 */
export const checkWireEndPointOrder = (pole: Pole): QCCheckResult => {
  const result: QCCheckResult = {
    status: "NOT_CHECKED",
    message: "Wire end point order check not performed",
    details: []
  };

  // Check if both required layers exist
  if (!pole.layers["PROPOSED"] || !pole.layers["REMEDY"]) {
    result.message = "Missing PROPOSED or REMEDY layer for wire end point order check";
    return result;
  }

  const proposedLayer = pole.layers["PROPOSED"];
  const remedyLayer = pole.layers["REMEDY"];

  // Make sure both layers have wireEndPoints
  if (!proposedLayer.wireEndPoints || !Array.isArray(proposedLayer.wireEndPoints) || 
      proposedLayer.wireEndPoints.length === 0) {
    result.message = "No wireEndPoints found in PROPOSED layer";
    return result;
  }

  if (!remedyLayer.wireEndPoints || !Array.isArray(remedyLayer.wireEndPoints) || 
      remedyLayer.wireEndPoints.length === 0) {
    result.message = "No wireEndPoints found in REMEDY layer";
    return result;
  }

  // Extract IDs from both wireEndPoints arrays
  const proposedIds = proposedLayer.wireEndPoints
    .filter(wep => wep.id)
    .map(wep => wep.id);
  
  const remedyIds = remedyLayer.wireEndPoints
    .filter(wep => wep.id)
    .map(wep => wep.id);

  // Find common IDs that exist in both arrays
  const commonIds = proposedIds.filter(id => remedyIds.includes(id));

  // If there are no common IDs, we can't compare the order
  if (commonIds.length === 0) {
    result.status = "PASS";
    result.message = "No matching wireEndPoints found between PROPOSED and REMEDY";
    return result;
  }

  // Check if the order of common IDs is different between the two arrays
  let orderMismatch = false;
  const proposedOrder = proposedIds.filter(id => commonIds.includes(id));
  const remedyOrder = remedyIds.filter(id => commonIds.includes(id));

  // Check if the relative order is the same
  for (let i = 0; i < proposedOrder.length - 1; i++) {
    for (let j = i + 1; j < proposedOrder.length; j++) {
      const id1 = proposedOrder[i];
      const id2 = proposedOrder[j];
      
      const remedyIndex1 = remedyOrder.indexOf(id1);
      const remedyIndex2 = remedyOrder.indexOf(id2);
      
      // If the relative order differs, we have a mismatch
      if ((remedyIndex1 > remedyIndex2 && i < j) || 
          (remedyIndex1 < remedyIndex2 && i > j)) {
        orderMismatch = true;
        break;
      }
    }
    if (orderMismatch) break;
  }

  if (orderMismatch) {
    result.status = "FAIL";
    result.message = "WireEndPoints order mismatch detected between PROPOSED and REMEDY designs";
    result.details.push(
      `WireEndPoints in REMEDY design have a different order than in PROPOSED design`,
      `PROPOSED order: ${proposedOrder.join(", ")}`,
      `REMEDY order: ${remedyOrder.join(", ")}`
    );
  } else {
    result.status = "PASS";
    result.message = "WireEndPoints order is consistent between PROPOSED and REMEDY designs";
  }

  return result;
}
