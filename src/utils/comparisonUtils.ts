import {
  Pole,
  WireEndPoint,
  IdentifiedSpan,
  SpanComparisonResult,
  DesignComparisonResults,
  PoleWire,
  WireChange,
  ParsedData
} from '../types';

// --- Helper Functions ---

/** Tolerance for comparing floating point numbers (e.g., distances) */
const FLOAT_TOLERANCE = 0.01; // Allows for small floating point inaccuracies
/** Tolerance for comparing distances (e.g., 1% difference) */
const DISTANCE_TOLERANCE_PERCENT = 0.05; // 5% tolerance
/** Tolerance for comparing angles in degrees */
const ANGLE_TOLERANCE_DEGREES = 5;

/**
 * Checks if two angles (in degrees) are approximately opposite (180 degrees apart).
 * Handles angle wrapping (e.g., 358 vs 2 degrees).
 */
function areAnglesOpposite(angle1: number, angle2: number, tolerance: number = ANGLE_TOLERANCE_DEGREES): boolean {
  const diff = Math.abs(angle1 - angle2);
  const wrappedDiff = Math.min(diff, 360 - diff); // Check difference in both directions around the circle
  return Math.abs(wrappedDiff - 180) <= tolerance;
}

/**
 * Checks if two distances are approximately equal, considering units and tolerance.
 * Assumes units are consistent for now, but could be extended.
 */
function areDistancesClose(
  dist1: { value: number; unit: string },
  dist2: { value: number; unit: string },
  tolerancePercent: number = DISTANCE_TOLERANCE_PERCENT
): boolean {
  if (!dist1 || !dist2 || dist1.unit !== dist2.unit) {
    // Cannot compare if units differ or data is missing
    // TODO: Add unit conversion if necessary
    return false;
  }
  const diff = Math.abs(dist1.value - dist2.value);
  const average = (dist1.value + dist2.value) / 2;
  if (average < FLOAT_TOLERANCE) {
    // Handle case where distances are very close to zero
    return diff < FLOAT_TOLERANCE;
  }
  return (diff / average) <= tolerancePercent;
}


// --- Core Comparison Logic ---

/**
 * Identifies physical spans within a single design layer based on reciprocal WireEndPoints.
 * @param poles - Array of poles for the specific design layer.
 * @param layerName - The name of the layer (e.g., 'Proposed', 'Remedy').
 * @returns An array of IdentifiedSpan objects found in this layer.
 */
function identifySpansInLayer(poles: Pole[], layerName: string): IdentifiedSpan[] {
  const identifiedSpans: IdentifiedSpan[] = [];
  const polesById: Map<string, Pole> = new Map(poles.map(p => [p.structureId, p]));
  const processedSpanKeys = new Set<string>(); // To avoid duplicate spans (A-B and B-A)

  poles.forEach(poleA => {
    if (!poleA?.structureId || !poleA.layers[layerName]?.wireEndPoints) {
      return; // Skip if pole or WEPs are missing
    }
    const wepsA = poleA.layers[layerName].wireEndPoints ?? [];

    wepsA.forEach(wepA => {
      if (!wepA?.id || wepA.direction === undefined || !wepA.distance?.value) {
        return; // Skip WEP if essential info is missing
      }

      // Iterate through potential target poles
      poles.forEach(poleB => {
        if (!poleB?.structureId || poleA.structureId === poleB.structureId || !poleB.layers[layerName]?.wireEndPoints) {
          return; // Skip self or poles without WEPs
        }

        // Check if this span direction has already been processed
        const spanKeyForward = `${poleA.structureId}-${poleB.structureId}`;
        const spanKeyReverse = `${poleB.structureId}-${poleA.structureId}`;
        if (processedSpanKeys.has(spanKeyForward) || processedSpanKeys.has(spanKeyReverse)) {
          // Optimization: If we already found the span starting from the other pole, skip
          // Note: This assumes one span between two poles. Refine if multiple parallel spans are possible.
          // return; // This might skip valid reciprocal checks if the first WEP wasn't the right one. Let's check all WEPs on B.
        }


        const wepsB = poleB.layers[layerName].wireEndPoints ?? [];
        let foundReciprocal = false;

        for (const wepB of wepsB) {
          if (!wepB?.id || wepB.direction === undefined || !wepB.distance?.value) {
            continue; // Skip WEP B if essential info is missing
          }

          // Check for reciprocal properties
          if (
            areAnglesOpposite(wepA.direction, wepB.direction) &&
            areDistancesClose(wepA.distance, wepB.distance)
            // Add more checks if needed (e.g., wepA.type vs wepB.type)
          ) {
            // Found a potential reciprocal WEP pair
            const sortedIds = [poleA.structureId, poleB.structureId].sort();
            const uniqueSpanKey = sortedIds.join('-');

            if (!processedSpanKeys.has(uniqueSpanKey)) {
              const spanId = `${poleA.structureId}_${wepA.id}-${poleB.structureId}_${wepB.id}`; // Example span ID
              identifiedSpans.push({
                spanId: spanId,
                poleA_Id: poleA.structureId,
                poleA_WEP_Id: wepA.id,
                poleB_Id: poleB.structureId,
                poleB_WEP_Id: wepB.id,
              });
              processedSpanKeys.add(uniqueSpanKey);
              foundReciprocal = true;
              break; // Found the reciprocal for wepA, move to the next wepA
            }
          }
        } // End loop wepB
        if (foundReciprocal) {
           // If we found the match for wepA, we don't need to check other poleBs for this wepA
           // break; // This break is commented out as a single WEP might theoretically point to multiple places? Unlikely for NEXT_POLE. Re-enable if performance is key and assumption holds.
        }
      }); // End loop poleB
    }); // End loop wepA
  }); // End loop poleA

  console.log(`Identified ${identifiedSpans.length} spans in layer '${layerName}'.`);
  return identifiedSpans;
}

/**
 * Matches identified spans between the Proposed and Remedy layers.
 * @param proposedSpans - Spans identified in the Proposed layer.
 * @param remedySpans - Spans identified in the Remedy layer.
 * @returns An array of SpanComparisonResult objects representing matched, added, or removed spans.
 */
function matchSpansBetweenLayers(proposedSpans: IdentifiedSpan[], remedySpans: IdentifiedSpan[]): SpanComparisonResult[] {
  const comparisonResults: SpanComparisonResult[] = [];
  const remedySpanMap: Map<string, IdentifiedSpan> = new Map(); // Key: sorted pole IDs string

  remedySpans.forEach(span => {
    const key = [span.poleA_Id, span.poleB_Id].sort().join('-');
    remedySpanMap.set(key, span);
  });

  proposedSpans.forEach(propSpan => {
    const key = [propSpan.poleA_Id, propSpan.poleB_Id].sort().join('-');
    const remedySpan = remedySpanMap.get(key);

    if (remedySpan) {
      // Matched span
      comparisonResults.push({
        proposedSpan: propSpan,
        remedySpan: remedySpan,
        poleA_Id: propSpan.poleA_Id, // Assuming IDs are consistent for the pair
        poleB_Id: propSpan.poleB_Id,
        changesAtPoleA: [],
        changesAtPoleB: [],
        spanStatus: 'MATCHED',
      });
      remedySpanMap.delete(key); // Remove matched span
    } else {
      // Span removed in Remedy
      comparisonResults.push({
        proposedSpan: propSpan,
        remedySpan: undefined,
        poleA_Id: propSpan.poleA_Id,
        poleB_Id: propSpan.poleB_Id,
        changesAtPoleA: [], // Will be populated with 'REMOVED' wires later
        changesAtPoleB: [], // Will be populated with 'REMOVED' wires later
        spanStatus: 'REMOVED_IN_REMEDY',
      });
    }
  });

  // Any remaining spans in remedySpanMap were added in Remedy
  remedySpanMap.forEach(remSpan => {
    comparisonResults.push({
      proposedSpan: undefined,
      remedySpan: remSpan,
      poleA_Id: remSpan.poleA_Id,
      poleB_Id: remSpan.poleB_Id,
      changesAtPoleA: [], // Will be populated with 'ADDED' wires later
      changesAtPoleB: [], // Will be populated with 'ADDED' wires later
      spanStatus: 'ADDED_IN_REMEDY',
    });
  });

  return comparisonResults;
}

/**
 * Compares the wires attached to a matched span at each pole end. Populates changes in spanResult.
 * @param spanResult - The SpanComparisonResult object for the span (will be mutated).
 * @param proposedPoles - Map of Proposed poles by ID.
 * @param remedyPoles - Map of Remedy poles by ID.
 */
function compareWiresForSpan(
  spanResult: SpanComparisonResult,
  proposedPoles: Map<string, Pole>,
  remedyPoles: Map<string, Pole>
): void {

  // TODO: Implement wire comparison logic.
  const { proposedSpan, remedySpan, poleA_Id, poleB_Id, spanStatus } = spanResult;

  const poleA_Proposed = proposedPoles.get(poleA_Id);
  const poleB_Proposed = proposedPoles.get(poleB_Id);
  const poleA_Remedy = remedyPoles.get(poleA_Id);
  const poleB_Remedy = remedyPoles.get(poleB_Id);

  // Helper to get wires for a specific WEP on a pole
  const getWiresForWEP = (pole: Pole | undefined, layerName: string, wepId: string | undefined): PoleWire[] => {
    if (!pole || !wepId) return [];
    const layer = pole.layers[layerName];
    const wep = layer?.wireEndPoints?.find(w => w.id === wepId);
    if (!wep) return [];

    // Need to find the actual wire objects from the pole's wire list
    const allWires = layer?.wires ?? layer?.structure?.wires ?? [];
    const wiresById = new Map(allWires.map(w => [w.id, w]));

    return wep.wires.map(wireId => wiresById.get(wireId)).filter((w): w is PoleWire => !!w);
  };

  // Get wire lists for each end in both layers
  const wiresA_Proposed = getWiresForWEP(poleA_Proposed, 'Proposed', proposedSpan?.poleA_WEP_Id);
  const wiresB_Proposed = getWiresForWEP(poleB_Proposed, 'Proposed', proposedSpan?.poleB_WEP_Id);
  const wiresA_Remedy = getWiresForWEP(poleA_Remedy, 'Remedy', remedySpan?.poleA_WEP_Id);
  const wiresB_Remedy = getWiresForWEP(poleB_Remedy, 'Remedy', remedySpan?.poleB_WEP_Id);

  // --- Compare Wires Function ---
  const compareWireLists = (
    proposedWires: PoleWire[],
    remedyWires: PoleWire[],
    poleId: string,
    wepId: string | undefined
  ): WireChange[] => {
    const changes: WireChange[] = [];
    if (!wepId) return changes; // Cannot compare without a WEP reference

    const proposedWireMap = new Map(proposedWires.map(w => [w.externalId ?? w.id, w])); // Use externalId if available, fallback to id
    const remedyWireMap = new Map(remedyWires.map(w => [w.externalId ?? w.id, w]));

    // Check for removed and modified wires
    proposedWires.forEach(propWire => {
      const key = propWire.externalId ?? propWire.id;
      if (!key) return; // Skip wires without a usable ID

      const remWire = remedyWireMap.get(key);
      if (!remWire) {
        changes.push({ type: 'REMOVED', poleId, wireEndPointId: wepId, wire: propWire });
      } else {
        // Check for modifications (e.g., height)
        const modifications: string[] = [];
        const propHeight = propWire.attachmentHeight?.value;
        const remHeight = remWire.attachmentHeight?.value;
        // Basic height comparison, assumes units are consistent or converted previously
        if (propHeight !== undefined && remHeight !== undefined && Math.abs(propHeight - remHeight) > FLOAT_TOLERANCE) {
           modifications.push(`Height changed from ${propHeight?.toFixed(2)} to ${remHeight?.toFixed(2)}`); // Add units later if available
        }
        // Add other property comparisons here (owner, type, size, etc.) if needed

        if (modifications.length > 0) {
          changes.push({
            type: 'MODIFIED',
            poleId,
            wireEndPointId: wepId,
            wire: remWire, // Current state
            previousWire: propWire, // Previous state
            changeDetails: modifications,
          });
        }
        remedyWireMap.delete(key); // Remove matched wire to find added ones later
      }
    });

    // Check for added wires
    remedyWireMap.forEach(remWire => {
      changes.push({ type: 'ADDED', poleId, wireEndPointId: wepId, wire: remWire });
    });

    return changes;
  };
  // --- End Compare Wires Function ---


  if (spanStatus === 'MATCHED') {
    spanResult.changesAtPoleA = compareWireLists(wiresA_Proposed, wiresA_Remedy, poleA_Id, remedySpan?.poleA_WEP_Id);
    spanResult.changesAtPoleB = compareWireLists(wiresB_Proposed, wiresB_Remedy, poleB_Id, remedySpan?.poleB_WEP_Id);
  } else if (spanStatus === 'REMOVED_IN_REMEDY') {
    // All proposed wires are considered removed
    spanResult.changesAtPoleA = wiresA_Proposed.map(w => ({ type: 'REMOVED', poleId: poleA_Id, wireEndPointId: proposedSpan!.poleA_WEP_Id, wire: w }));
    spanResult.changesAtPoleB = wiresB_Proposed.map(w => ({ type: 'REMOVED', poleId: poleB_Id, wireEndPointId: proposedSpan!.poleB_WEP_Id, wire: w }));
  } else if (spanStatus === 'ADDED_IN_REMEDY') {
    // All remedy wires are considered added
    spanResult.changesAtPoleA = wiresA_Remedy.map(w => ({ type: 'ADDED', poleId: poleA_Id, wireEndPointId: remedySpan!.poleA_WEP_Id, wire: w }));
    spanResult.changesAtPoleB = wiresB_Remedy.map(w => ({ type: 'ADDED', poleId: poleB_Id, wireEndPointId: remedySpan!.poleB_WEP_Id, wire: w }));
  }
}

/**
 * Performs a robust comparison between Proposed and Remedy design layers.
 * @param proposedData - Parsed data for the Proposed design.
 * @param remedyData - Parsed data for the Remedy design.
 * @returns A DesignComparisonResults object detailing the differences.
 */
export function compareDesigns(proposedData: ParsedData, remedyData: ParsedData): DesignComparisonResults {
  const proposedPoles = proposedData.poles;
  const remedyPoles = remedyData.poles;

  const proposedPolesById: Map<string, Pole> = new Map(proposedPoles.map(p => [p.structureId, p]));
  const remedyPolesById: Map<string, Pole> = new Map(remedyPoles.map(p => [p.structureId, p]));

  // Step 1: Identify spans in each layer
  const proposedSpans = identifySpansInLayer(proposedPoles, 'Proposed');
  const remedySpans = identifySpansInLayer(remedyPoles, 'Remedy');

  // Step 2: Match spans between layers
  const spanComparisonResults = matchSpansBetweenLayers(proposedSpans, remedySpans);

  // Step 3: Compare wires for each matched/added/removed span
  spanComparisonResults.forEach(result => {
    compareWiresForSpan(result, proposedPolesById, remedyPolesById);
  });

  return {
    comparisonDescription: 'Proposed vs. Remedy Span Comparison',
    spanResults: spanComparisonResults,
  };
}

// Helper functions (e.g., for finding poles, comparing wires) might be needed below.
