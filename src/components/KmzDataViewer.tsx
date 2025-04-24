import React, { useState, useMemo, useEffect } from "react";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KmzFiberData, Pole, PoleWire } from "@/types";
import { X, CheckCircle, AlertCircle } from "lucide-react";
import { 
  calculateDistance, 
  extractFiberSize,
  extractFromHtml,
  extractPropertyValue,
  getCapafoValue,
  isGigapowerData
} from "@/utils/fiberUtils";

interface KmzDataViewerProps {
  isOpen: boolean;
  onClose: () => void;
  kmzData: KmzFiberData[];
  fileName: string | null;
  poles?: Pole[];  // Added to access pole data for comparison
}

export function KmzDataViewer({ isOpen, onClose, kmzData, fileName, poles = [] }: KmzDataViewerProps) {
  // Use shared utility function for getting cb_capafo value
  const getCbCapafo = (item: KmzFiberData): string => {
    const value = getCapafoValue(item);
    return value || item.fiberSize || "";
  };
  
  // Find Gigapower or AT&T fiber wires in a specific layer
  const findFiberWires = (pole: Pole | null, layerName: string): PoleWire[] => {
    if (!pole) return [];
    
    const layer = pole.layers[layerName];
    
    // Deep debugging of layer structure
    console.log(`Layer structure debug for ${pole?.structureId} in ${layerName}:`, {
      hasLayer: !!layer,
      layerKeys: layer ? Object.keys(layer) : 'N/A',
      hasWiresDirectly: layer?.wires?.length > 0,
      hasStructureProp: !!layer?.structure,
      hasNestedWires: layer?.structure?.wires?.length > 0,
      wireCountDirect: layer?.wires?.length || 0,
      wireCountNested: layer?.structure?.wires?.length || 0
    });
    
    if (!layer) {
      console.log(`No ${layerName} layer found for pole ${pole.structureId}`);
      return [];
    }
    
    // Check both direct wires and nested structure.wires
    let wires: PoleWire[] = [];
    
    // Try direct access first
    if (layer.wires && layer.wires.length > 0) {
      wires = layer.wires;
    } 
    // Fall back to nested structure if direct access fails
    else if (layer.structure && layer.structure.wires && layer.structure.wires.length > 0) {
      console.log(`Found wires in nested structure for ${pole.structureId} in ${layerName}`);
      wires = layer.structure.wires;
    }
    
    if (wires.length === 0) {
      console.log(`No wires found in ${layerName} layer for pole ${pole.structureId}`);
      return [];
    }
    
    console.log(`Examining ${wires.length} wires in ${layerName} for pole ${pole.structureId}`);
    
    // Log all wires for more detailed debugging
    const allWires = wires.map(w => ({
      id: w.id,
      owner: w.owner?.id,
      size: w.size || "No size",
      type: w.type || "No type",
      clientItemSize: w.clientItem?.size || "No clientItem size",
      clientItemType: w.clientItem?.type || "No clientItem type",
      description: w.description || "No description",
      usageGroup: w.usageGroup || "No usageGroup"
    }));
    console.log(`All wires for ${pole.structureId} in ${layerName}:`, allWires);
    
    // Get all fiber wires - enhanced detection for AT&T/Gigapower and general fiber indicators
    const fiberWires = wires.filter((wire: PoleWire) => {
      // Use the same fiber detection logic that we use in the QC checks
      // Check for AT&T/Gigapower indicators
      const ownerStr = (wire.owner?.id || "").toLowerCase();
      const externalIdStr = (wire.externalId || "").toLowerCase();
      const descriptionStr = (wire.description || "").toLowerCase();
      const sizeStr = (wire.size || "").toLowerCase();
      const clientItemSizeStr = (wire.clientItem?.size || "").toLowerCase();
      const clientItemTypeStr = (wire.clientItem?.type || "").toLowerCase();
      
      // Check for AT&T/Gigapower indicators in all possible fields
      const isATTGigapower = 
        // Owner checks
        ownerStr.includes("att") || 
        ownerStr.includes("at&t") || 
        ownerStr.includes("gigapower") || 
        ownerStr.includes("gig") ||
        // External ID checks
        externalIdStr.includes("att") ||
        externalIdStr.includes("at&t") ||
        externalIdStr.includes("gigapower") ||
        externalIdStr.includes("gig") ||
        // Description checks
        descriptionStr.includes("att") ||
        descriptionStr.includes("at&t") ||
        descriptionStr.includes("gigapower") ||
        descriptionStr.includes("gig") ||
        // Size checks
        sizeStr.includes("att") ||
        sizeStr.includes("at&t") ||
        sizeStr.includes("gigapower") ||
        sizeStr.includes("gig") ||
        // ClientItem checks
        clientItemSizeStr.includes("att") ||
        clientItemSizeStr.includes("at&t") ||
        clientItemSizeStr.includes("gigapower") ||
        clientItemSizeStr.includes("gig") ||
        clientItemTypeStr.includes("att") ||
        clientItemTypeStr.includes("at&t") ||
        clientItemTypeStr.includes("gigapower") ||
        clientItemTypeStr.includes("gig");
      
      // Check for fiber indicators
      const isFiber = 
        // Type checks
        ((wire.type || "").toLowerCase().includes("fiber") ||
         (wire.type || "").toLowerCase().includes("fbr") ||
         (wire.type || "").toLowerCase().includes("optic")) ||
        // Description checks
        (descriptionStr.includes("fiber") ||
         descriptionStr.includes("fbr") ||
         descriptionStr.includes("optic") ||
         descriptionStr.includes("ft") ||
         descriptionStr.includes("ct")) ||
        // Size format checks
        (sizeStr.includes("fiber") || 
         sizeStr.includes("fbr") ||
         sizeStr.includes("ct") ||
         (sizeStr.match(/\d+\s*ct/i) !== null) ||
         (sizeStr.match(/\d+\s*fiber/i) !== null)) ||
        // ClientItem indicators
        (clientItemSizeStr.includes("fiber") ||
         clientItemSizeStr.includes("fbr") ||
         clientItemSizeStr.includes("ct") ||
         clientItemSizeStr.match(/\d+\s*ct/i) !== null ||
         clientItemSizeStr.match(/\d+\s*fiber/i) !== null) ||
        // ClientItem type checks
        (clientItemTypeStr.includes("fiber") ||
         clientItemTypeStr.includes("fbr") ||
         clientItemTypeStr.includes("optic"));
      
      // Check for fiber count indicators in strings
      const hasCountIndicator = 
        extractFiberSize(wire) > 0; // If our utility can extract a size, it's likely a fiber
      
      const result = isATTGigapower || isFiber || hasCountIndicator;
      
      if (result) {
        console.log(`Found fiber wire in ${layerName} for pole ${pole.structureId}:`, {
          id: wire.id,
          owner: wire.owner?.id,
          size: wire.size,
          clientItemSize: wire.clientItem?.size,
          clientItemType: wire.clientItem?.type,
          description: wire.description,
          matchReason: {
            isATTGigapower,
            isFiber,
            hasCountIndicator
          }
        });
        return true;
      }
      return false;
    });
    
    console.log(`Found ${fiberWires.length} fiber wires in ${layerName} for pole ${pole.structureId}`);
    return fiberWires;
  };
  
  
  // For debugging
  const [debugInfo, setDebugInfo] = useState<string>("");
  
  // Log coordinates for debugging
  useEffect(() => {
    if (!poles?.length || !kmzData?.length) return;
    
    const poleCoordinates = poles
      .filter(p => p.coordinates)
      .map(p => `${p.structureId}: (${p.coordinates?.latitude.toFixed(6)}, ${p.coordinates?.longitude.toFixed(6)})`);
      
    const kmzCoordinates = kmzData
      .filter(k => k.coordinates)
      .map(k => `KMZ: (${k.coordinates.latitude.toFixed(6)}, ${k.coordinates.longitude.toFixed(6)}) cb_capafo: ${getCbCapafo(k)}`);
    
    console.log("Pole coordinates:", poleCoordinates);
    console.log("KMZ coordinates:", kmzCoordinates);
  }, [poles, kmzData]);
  
  // Memoize the KMZ-to-pole matching calculation
  const matchedData = useMemo(() => {
    // Update debug info through a separate effect, not during render calculation
    let debugMessage = "";
    
    if (!poles?.length || !kmzData?.length) {
      return [];
    }
    
    // Get KMZ entries with valid coordinates and cb_capafo values
    const validKmzEntries = kmzData.filter(data => 
      data.coordinates && getCbCapafo(data)
    );
    
    debugMessage = `Found ${validKmzEntries.length} KMZ entries with coordinates and cb_capafo values`;
    
    if (validKmzEntries.length === 0) {
      // Set the debug message in an effect, not directly here
      setTimeout(() => setDebugInfo(debugMessage), 0);
      return [];
    }

    // Log the valid entries to help with debugging
    console.log("Valid KMZ entries with cb_capafo values:", validKmzEntries.map(e => ({
      poleId: e.poleId || "No pole ID",
      coordinates: `${e.coordinates.latitude.toFixed(6)}, ${e.coordinates.longitude.toFixed(6)}`,
      cb_capafo: getCbCapafo(e),
      description: e.description ? e.description.substring(0, 50) + "..." : "No description"
    })));

    // Distance debugging for H14C378
    interface DistanceDebugItem {
      poleId: string;
      kmzCoords: string;
      distance: number;
      cbCapafo: string;
    }
    
    const distanceDebug: DistanceDebugItem[] = [];
    
    // If H14C378 is in the poles list, log distances to all KMZ points
    const debugPole = poles.find(p => p.structureId === 'H14C378');
    if (debugPole && debugPole.coordinates) {
      validKmzEntries.forEach(kmz => {
        const distance = calculateDistance(
          kmz.coordinates.latitude, kmz.coordinates.longitude,
          debugPole.coordinates!.latitude, debugPole.coordinates!.longitude
        );
        
        distanceDebug.push({
          poleId: debugPole.structureId,
          kmzCoords: `${kmz.coordinates.latitude.toFixed(6)}, ${kmz.coordinates.longitude.toFixed(6)}`,
          distance,
          cbCapafo: getCbCapafo(kmz)
        });
      });
      
      console.log("Distance debug for H14C378:", distanceDebug.sort((a, b) => a.distance - b.distance));
    }
    
    // Distance thresholds - determines how close a pole needs to be to a KMZ point to be considered a match
    // Using two thresholds: initial stricter and fallback more generous
    const closeDistanceThreshold = 5000; // Initial threshold
    const farDistanceThreshold = 10000;  // Fallback threshold (doubled)
    
    // Log pole coordinates for debugging
    console.log("Available poles with coordinates:", poles
      .filter(p => p.coordinates)
      .map(p => ({
        structureId: p.structureId,
        coordinates: p.coordinates ? 
          `${p.coordinates.latitude.toFixed(6)}, ${p.coordinates.longitude.toFixed(6)}` : 
          "No coordinates"
      }))
    );
    
    // For demonstration, we'll use all KMZ entries and match them to poles
    const matches = validKmzEntries.map(data => {
      let nearestPole: Pole | null = null;
      let minDistance = Infinity;
      
      // Try direct pole ID match first if available
      if (data.poleId) {
        const directMatch = poles.find(p => 
          p.structureId === data.poleId || 
          p.structureId.includes(data.poleId) ||
          (data.poleId.includes(p.structureId))
        );
        
        if (directMatch) {
          console.log(`Found direct pole ID match: KMZ ID ${data.poleId} -> Pole ${directMatch.structureId}`);
          return {
            kmzData: data,
            pole: directMatch,
            distance: 0, // Perfect match
            matchType: "Direct ID match"
          };
        }
      }
      
      // If no direct match, try coordinate-based matching
      // Find the nearest pole with coordinates
      poles.forEach(pole => {
        if (pole.coordinates && data.coordinates) {
          const distance = calculateDistance(
            data.coordinates.latitude, data.coordinates.longitude,
            pole.coordinates.latitude, pole.coordinates.longitude
          );
          
          // Use a generous threshold - accept any pole within reasonable distance
          if (distance < minDistance) {
            minDistance = distance;
            nearestPole = pole;
          }
        }
      });
      
      return {
        kmzData: data,
        pole: nearestPole,
        distance: minDistance,
        matchType: "Coordinate match"
      };
    });
    
    // First try with close threshold
    let withPoles = matches.filter(item => 
      item.pole !== null && (item.matchType === "Direct ID match" || item.distance < closeDistanceThreshold)
    );
    
    // If we don't have enough matches, try with more generous threshold
    if (withPoles.length < validKmzEntries.length * 0.5) { // Less than 50% match rate
      console.log(`First pass matching found only ${withPoles.length} matches out of ${validKmzEntries.length} KMZ entries. Trying more generous threshold.`);
      
      withPoles = matches.filter(item => 
        item.pole !== null && (item.matchType === "Direct ID match" || item.distance < farDistanceThreshold)
      );
      
      console.log(`Second pass matching found ${withPoles.length} matches with poles within threshold`);
    }
    
    debugMessage += `\nFound ${withPoles.length} matches with poles within threshold`;
    
    // Log the matches for debugging
    console.log("KMZ-to-Pole matches:", withPoles.map(match => ({
      kmzId: match.kmzData.poleId || "No KMZ ID",
      poleId: match.pole?.structureId || "No matching pole",
      distance: match.distance,
      cb_capafo: getCbCapafo(match.kmzData),
      matchType: match.matchType
    })));
    
    // Update debug info in a non-render-blocking way
    setTimeout(() => setDebugInfo(debugMessage), 0);
    
    // Sort by distance
    return withPoles.sort((a, b) => a.distance - b.distance);
  }, [poles, kmzData]);
  
  // Render the comparison table 
  const renderComparisonTable = () => {
    if (matchedData.length === 0) {
      return (
        <div className="p-4 text-center text-muted-foreground">
          <div>No matching fiber data found for comparison</div>
          {debugInfo && (
            <div className="mt-2 p-2 bg-gray-100 text-xs text-left rounded">
              <div className="font-semibold">Debug Info:</div>
              {debugInfo.split('\n').map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
        </div>
      );
    }
    
    return (
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Pole ID</TableHead>
              <TableHead className="w-[150px]">KMZ Coordinates</TableHead>
              <TableHead className="w-[90px]" title="Distance between KMZ point and pole in coordinate units">Distance</TableHead>
              <TableHead className="w-[100px] font-semibold">KMZ cb_capafo</TableHead>
              <TableHead className="w-[130px]">PROPOSED Fiber Size</TableHead>
              <TableHead className="w-[130px]">REMEDY Fiber Size</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matchedData.map((item, index) => {
              const { kmzData, pole, distance } = item;
              const cbCapafo = getCbCapafo(kmzData);
              const cbCapafoValue = parseInt(cbCapafo, 10) || 0;
              
              // Get all fiber wires from PROPOSED and REMEDY layers
              const proposedWires = findFiberWires(pole, "PROPOSED");
              const remedyWires = findFiberWires(pole, "REMEDY");
              
              // Log wire information for debugging
              console.log(`Pole ${pole?.structureId || "Unknown"} has:
                PROPOSED fiber wires: ${proposedWires.length}
                REMEDY fiber wires: ${remedyWires.length}
                cb_capafo value: ${cbCapafo} (${cbCapafoValue})
              `);
              
              // Calculate sum of fiber sizes for each layer
              const proposedFiberSizes = proposedWires.map(wire => extractFiberSize(wire));
              const remedyFiberSizes = remedyWires.map(wire => extractFiberSize(wire));
              
              const proposedFiberSum = proposedFiberSizes.reduce((sum, size) => sum + size, 0);
              const remedyFiberSum = remedyFiberSizes.reduce((sum, size) => sum + size, 0);
              
              // Determine if there's a match with either layer
              const proposedMatch = proposedFiberSum === cbCapafoValue;
              const remedyMatch = remedyFiberSum === cbCapafoValue;
              const hasMatch = proposedMatch || remedyMatch;
              
              return (
                <TableRow key={index} className={index % 2 === 0 ? "bg-gray-50" : undefined}>
                  <TableCell className="font-medium">
                    {pole?.structureId || "Unknown"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {kmzData.coordinates.latitude.toFixed(6)}, {kmzData.coordinates.longitude.toFixed(6)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {distance.toFixed(6)}
                  </TableCell>
                  <TableCell className="font-bold text-blue-700">
                    {cbCapafo}
                  </TableCell>
                  <TableCell>
                    {proposedFiberSizes.length > 0 ? (
                      <div className={`${proposedMatch ? 'text-green-700' : 'text-gray-700'}`}>
                        {proposedFiberSizes.length > 1 
                          ? proposedFiberSizes.join(' + ') + ' = ' + proposedFiberSum
                          : proposedFiberSum || 'None'}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">No fiber cables</div>
                    )}
                    {/* Show small details of detected fibers */}
                    {proposedWires.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        {proposedWires.map((wire, i) => (
                          <div key={i} className="truncate">
                            {wire.owner?.id || "Unknown"}: {wire.size || wire.clientItem?.size || "Size N/A"}
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {remedyFiberSizes.length > 0 ? (
                      <div className={`${remedyMatch ? 'text-green-700' : 'text-gray-700'}`}>
                        {remedyFiberSizes.length > 1 
                          ? remedyFiberSizes.join(' + ') + ' = ' + remedyFiberSum
                          : remedyFiberSum || 'None'}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">No fiber cables</div>
                    )}
                    {/* Show small details of detected fibers */}
                    {remedyWires.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        {remedyWires.map((wire, i) => (
                          <div key={i} className="truncate">
                            {wire.owner?.id || "Unknown"}: {wire.size || wire.clientItem?.size || "Size N/A"}
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {hasMatch ? (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        <span>Match</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-red-600">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        <span>Mismatch</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Fiber Data Comparison - {fileName}</DialogTitle>
          <DialogDescription>
            Comparing KMZ fiber counts with SPIDAcalc data
          </DialogDescription>
        </DialogHeader>
        
        <div className="w-full">
          <div className="mb-4">
            <div className="bg-blue-50 p-3 rounded-md border border-blue-200 text-blue-800">
              <h3 className="font-medium mb-1">Fiber Count Comparison</h3>
              <p className="text-sm">
                This table matches KMZ fiber data (cb_capafo values) with fiber sizes from 
                PROPOSED and REMEDY layers. The fiber count may be represented by multiple 
                smaller cables that add up to the same total.
              </p>
            </div>
            
            {/* Debug info */}
            <div className="mt-3 mb-2 text-xs bg-gray-50 p-2 rounded-md border border-gray-200">
              <div className="font-medium">Debug Information:</div>
              <div>Poles available: {poles.length}</div>
              <div>KMZ entries: {kmzData.length}</div>
              <div>KMZ entries with cb_capafo: {kmzData.filter(data => getCbCapafo(data)).length}</div>
              <div>KMZ entries with coordinates: {kmzData.filter(data => data.coordinates).length}</div>
            </div>
          </div>
          
          {/* Comparison table */}
          {renderComparisonTable()}
        </div>
        
        <DialogClose asChild>
          <Button variant="outline" onClick={onClose} className="mt-4">
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
