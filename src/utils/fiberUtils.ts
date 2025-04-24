import { KmzFiberData, Pole, PoleWire } from "@/types";

// Constants for distance calculations
const EARTH_RADIUS_KM = 6371; // Earth's radius in kilometers
const REASONABLE_DISTANCE_THRESHOLD = 0.01; // ~1km in coordinate units (squared)
const DIRECTION_MATCH_THRESHOLD = 0.8; // 80% match for direction alignment

/**
 * Enhanced function to calculate distance between two coordinate points
 * Used for matching KMZ fiber data to poles
 */
export function calculateDistance(
  lat1: number, lon1: number, 
  lat2: number, lon2: number
): number {
  // Reduce sensitivity to minor coordinate differences
  // Use fewer decimal places for comparison to account for precision variations
  const precision = 5; // 5 decimal places (~1.1 meter precision)
  
  // Round coordinates to specified precision
  const roundedLat1 = Math.round(lat1 * Math.pow(10, precision)) / Math.pow(10, precision);
  const roundedLon1 = Math.round(lon1 * Math.pow(10, precision)) / Math.pow(10, precision);
  const roundedLat2 = Math.round(lat2 * Math.pow(10, precision)) / Math.pow(10, precision);
  const roundedLon2 = Math.round(lon2 * Math.pow(10, precision)) / Math.pow(10, precision);
  
  // Calculate normalized distance with rounded coordinates
  const latDiff = Math.abs(roundedLat1 - roundedLat2);
  const lonDiff = Math.abs(roundedLon1 - roundedLon2);
  
  // Use squared distance to avoid square root operation
  return (latDiff * latDiff) + (lonDiff * lonDiff);
}

/**
 * Calculate actual distance in meters between two points using Haversine formula
 * This accounts for the Earth's curvature
 */
export function calculateHaversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  // Convert latitude and longitude from degrees to radians
  const toRad = (x: number) => x * Math.PI / 180;
  const rlat1 = toRad(lat1);
  const rlon1 = toRad(lon1);
  const rlat2 = toRad(lat2);
  const rlon2 = toRad(lon2);
  
  // Haversine formula
  const dLat = rlat2 - rlat1;
  const dLon = rlon2 - rlon1;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(rlat1) * Math.cos(rlat2) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  // Distance in kilometers
  return EARTH_RADIUS_KM * c * 1000; // Convert to meters
}

/**
 * Calculate direction (bearing) between two coordinates
 * Returns angle in degrees (0-360) where 0 is north
 */
export function calculateDirection(
  startLat: number, startLon: number,
  endLat: number, endLon: number
): number {
  // Convert to radians
  const toRad = (x: number) => x * Math.PI / 180;
  const startLatRad = toRad(startLat);
  const startLonRad = toRad(startLon);
  const endLatRad = toRad(endLat);
  const endLonRad = toRad(endLon);
  
  // Calculate y and x components
  const y = Math.sin(endLonRad - startLonRad) * Math.cos(endLatRad);
  const x = Math.cos(startLatRad) * Math.sin(endLatRad) -
            Math.sin(startLatRad) * Math.cos(endLatRad) * Math.cos(endLonRad - startLonRad);
  
  // Calculate bearing and convert to degrees
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  
  // Normalize to 0-360
  return (bearing + 360) % 360;
}

/**
 * Calculate direction similarity between two bearings (0-1)
 * 1 = same direction, 0 = opposite direction
 */
export function calculateDirectionSimilarity(bearing1: number, bearing2: number): number {
  // Calculate difference and normalize to 0-180
  const diff = Math.abs(bearing1 - bearing2) % 360;
  const normalizedDiff = diff > 180 ? 360 - diff : diff;
  
  // Convert to a similarity score (0-1)
  return 1 - (normalizedDiff / 180);
}

/**
 * Check if a KMZ point is along the direction vector between two poles
 * Returns a confidence score (0-1)
 */
export function isPointAlongDirection(
  poleA: Pole, 
  poleB: Pole | null, 
  kmzPoint: KmzFiberData
): { isAlong: boolean; confidence: number } {
  if (!poleA.coordinates || !poleB?.coordinates || !kmzPoint.coordinates) {
    return { isAlong: false, confidence: 0 };
  }
  
  // Calculate direction from poleA to poleB
  const poleDirection = calculateDirection(
    poleA.coordinates.latitude, poleA.coordinates.longitude,
    poleB.coordinates.latitude, poleB.coordinates.longitude
  );
  
  // Calculate direction from poleA to KMZ point
  const kmzDirection = calculateDirection(
    poleA.coordinates.latitude, poleA.coordinates.longitude,
    kmzPoint.coordinates.latitude, kmzPoint.coordinates.longitude
  );
  
  // Compare directions
  const directionSimilarity = calculateDirectionSimilarity(poleDirection, kmzDirection);
  
  return { 
    isAlong: directionSimilarity >= DIRECTION_MATCH_THRESHOLD,
    confidence: directionSimilarity
  };
}

/**
 * Consolidated function to extract fiber size from either a wire object or a string
 * Combines all pattern matching from both KmzDataViewer and qcChecks implementations
 */
export function extractFiberSize(source: PoleWire | string): number {
  console.log("Extracting fiber size from:", typeof source === 'string' ? source : 
    `Wire (owner: ${source.owner?.id || 'Unknown'}, type: ${source.type || 'Unknown'})`);
  
  // Gather all potential text sources based on input type
  const sizeStrings: string[] = [];
  
  if (typeof source === 'string') {
    sizeStrings.push(source);
  } else if (source) {
    // Prioritize clientItem.size as it's often most reliable
    if (source.clientItem?.size) sizeStrings.push(source.clientItem.size);
    if (source.size) sizeStrings.push(source.size);
    if (source.description) sizeStrings.push(source.description);
    if (source.type) sizeStrings.push(source.type);
    if (source.clientItem?.type) sizeStrings.push(source.clientItem.type);
  }
  
  if (sizeStrings.length === 0) {
    console.log("  No size strings found to process");
    return 0;
  }
  
  console.log("  Processing size strings:", sizeStrings);
  
  // Process each string source with comprehensive pattern matching
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
      console.log(`  Found ${counts.join('+')}=${totalCount} in "${str}"`);
      return totalCount;
    }
    
    // Format: "ATT 144 FIBER" or "ATT 144-fiber" or "144 FBR" or "144F"
    const fiberMatch = str.match(/(\d+)[\s-]*(fiber|fbr|f\b)/i);
    if (fiberMatch && fiberMatch[1]) {
      console.log(`  Found ${fiberMatch[1]} fibers in "${str}"`);
      return parseInt(fiberMatch[1], 10);
    }
    
    // Format: "ADSS-96" or similar formats with fiber type/name + count
    const adssMatch = str.match(/adss[\s-]*(\d+)/i);
    if (adssMatch && adssMatch[1]) {
      console.log(`  Found ADSS fiber count ${adssMatch[1]} in "${str}"`);
      return parseInt(adssMatch[1], 10);
    }
    
    // Format: sometimes just a number followed by space then the word "count" or a fiber indication
    const countMatch = str.match(/(\d+)[\s-]*(count|cable|strand|ct)/i);
    if (countMatch && countMatch[1]) {
      console.log(`  Found count ${countMatch[1]} in "${str}"`);
      return parseInt(countMatch[1], 10);
    }
    
    // Format: Look for specific patterns like "144ct" or "96f" without spaces
    const compactFiberMatch = str.match(/(\d+)(ct|f|fiber|fbr)/i);
    if (compactFiberMatch && compactFiberMatch[1]) {
      console.log(`  Found compact fiber count ${compactFiberMatch[1]} in "${str}"`);
      return parseInt(compactFiberMatch[1], 10);
    }
    
    // Any number that appears in a Gigapower or AT&T fiber related string is very likely to be the count
    if ((str.toLowerCase().includes('gig') || 
         str.toLowerCase().includes('att') || 
         str.toLowerCase().includes('at&t') || 
         str.toLowerCase().includes('fiber') || 
         str.toLowerCase().includes('fbr')) && 
        !str.toLowerCase().includes('messenger')) {
      const numMatch = str.match(/(\d+)/);
      if (numMatch && numMatch[1]) {
        const num = parseInt(numMatch[1], 10);
        if (num >= 12) {
          console.log(`  Found likely fiber count ${num} in "${str}"`);
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
        console.log(`  Found number ${num} in "${str}" - might be a fiber count`);
        return num;
      }
    }
  }
  
  console.log("  No fiber size pattern matched");
  return 0;
}

/**
 * Extract value from HTML table content
 */
export function extractFromHtml(html: string, propName: string): string | null {
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
export function extractPropertyValue(fiberData: KmzFiberData, propertyName: string): string | null {
  if (!fiberData.description) return null;
  
  // First check if it's HTML content
  const htmlValue = extractFromHtml(fiberData.description, propertyName);
  if (htmlValue) return htmlValue;
  
  // Then check if it's JSON content
  try {
    if (fiberData.description.trim().startsWith('{') && fiberData.description.trim().endsWith('}')) {
      const descObj = JSON.parse(fiberData.description);
      if (propertyName in descObj) {
        return descObj[propertyName]?.toString() || null;
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
 * Enhanced with better logging and fallback mechanisms
 */
export function getCapafoValue(fiberData: KmzFiberData): string | null {
  console.log("Extracting cb_capafo from:", fiberData.poleId || "unknown pole");
  
  // First try to get it from HTML if it's HTML content
  if (fiberData.description && fiberData.description.includes('<html')) {
    const htmlValue = extractFromHtml(fiberData.description, "cb_capafo");
    console.log("  HTML extraction result:", htmlValue);
    if (htmlValue) return htmlValue;
  }
  
  // Then check if it's in the description as a JSON property or plain text
  const propValue = extractPropertyValue(fiberData, "cb_capafo");
  console.log("  Property extraction result:", propValue);
  if (propValue) return propValue;
  
  // If not found in description properties, use the fiberSize directly
  console.log("  Using fiberSize directly:", fiberData.fiberSize);
  return fiberData.fiberSize || null;
}

/**
 * Determine if a KMZ fiber data item is related to Gigapower/AT&T
 */
export function isGigapowerData(fiberData: KmzFiberData): boolean {
  // Check c_sro field which often indicates Gigapower data with PSA_317
  const sro = extractPropertyValue(fiberData, "c_sro");
  if (sro && sro.includes("PSA_317")) {
    return true;
  }
  
  // Then check various fields for Gigapower or ATT references
  const description = fiberData.description?.toLowerCase() || "";
  return (
    // Check description
    description.includes("gigapower") || 
    description.includes("att ") || // Space after ATT to avoid matches in words like "attachment"
    // Check owner field
    extractPropertyValue(fiberData, "owner")?.toLowerCase().includes("gigapower") ||
    extractPropertyValue(fiberData, "owner")?.toLowerCase().includes("att") ||
    // Check company field
    extractPropertyValue(fiberData, "company")?.toLowerCase().includes("gigapower") ||
    extractPropertyValue(fiberData, "company")?.toLowerCase().includes("att")
  );
}
