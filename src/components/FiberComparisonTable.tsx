import React, { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KmzFiberData, Pole } from "@/types";
import { CheckCircle, AlertCircle, Edit, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { calculateDistance, getCapafoValue } from "@/utils/fiberUtils";

interface FiberComparisonTableProps {
  kmzData: KmzFiberData[];
  poles: Pole[];
  originalJsonData?: Record<string, unknown>;
  className?: string;
  onFiberSizeChange?: (changes: FiberSizeChange[]) => void;
}

// Define interface for fiber size changes
export interface FiberSizeChange {
  fromPoleLabel: string;
  toPoleLabel: string;
  designLayer: "PROPOSED" | "REMEDY";
  newFiberSize: string;
  wireIds: string[];
}

// Enhanced span data to include wire IDs for updating
interface SpanData {
  fromPoleLabel: string;
  toPoleLabel: string;
  proposedFiberSize: string;
  remedyFiberSize: string;
  kmzFiberSize: string;
  status: string;
  details?: string;
  proposedWireIds?: string[];
  remedyWireIds?: string[];
}

export function FiberComparisonTable({ 
  kmzData, 
  poles, 
  originalJsonData, 
  className = "",
  onFiberSizeChange 
}: FiberComparisonTableProps) {
  // State for tracking which rows are being edited
  const [editingRows, setEditingRows] = useState<Record<number, boolean>>({});
  // State for tracking edited values
  const [editedValues, setEditedValues] = useState<Record<number, { proposed?: string, remedy?: string }>>({});
  // Define type interfaces for the JSON structure
  interface JsonWire {
    id: string;
    owner?: { id: string };
    clientItem?: { 
      size?: string;
      type?: string;
    };
    size?: string;
    description?: string;
  }

  interface JsonWireEndPoint {
    type?: string;
    externalId?: string;
    wires?: string[];
  }

  interface JsonStructure {
    pole?: { externalId?: string };
    wires?: JsonWire[];
    wireEndPoints?: JsonWireEndPoint[];
  }

  interface JsonDesign {
    label?: string;
    structure?: JsonStructure;
  }

  interface JsonLocation {
    label?: string;
    designs?: JsonDesign[];
  }

  interface JsonLead {
    locations?: JsonLocation[];
  }

  interface JsonData {
    leads?: JsonLead[];
  }

  // Helper to build a pole externalId to label mapping
  const buildPoleIdLookup = (jsonData: JsonData): Record<string, string> => {
    const lookup: Record<string, string> = {};
    
    if (jsonData?.leads) {
      jsonData.leads.forEach((lead) => {
        if (lead.locations) {
          lead.locations.forEach((location) => {
            if (location.designs && location.designs.length > 0) {
              const design = location.designs[0]; // Use first design for externalId
              if (design.structure?.pole?.externalId) {
                lookup[design.structure.pole.externalId] = location.label || '';
              }
            }
          });
        }
      });
    }
    
    return lookup;
  };

  // Helper to extract numbers from a string
  const extractNumbers = (str: string): string => {
    const matches = str.match(/\d+/g);
    return matches ? matches.join('') : '';
  };

  // Extract span data from the JSON structure
  const extractSpanData = (jsonData: JsonData): SpanData[] => {
    const spans: SpanData[] = [];
    const poleIdLookup = buildPoleIdLookup(jsonData);
    
    if (!jsonData?.leads) return spans;
    
    jsonData.leads?.forEach((lead) => {
      if (!lead.locations) return;
      
      lead.locations?.forEach((location) => {
        const fromPoleLabel = location.label || '';
        
        // Skip if no label
        if (!fromPoleLabel) return;
        
        // Find Proposed and Remedy designs
        const proposedDesign = location.designs?.find((d) => 
          d.label === "Proposed" || d.label === "PROPOSED");
        
        const remedyDesign = location.designs?.find((d) => 
          d.label === "Remedy" || d.label === "REMEDY");
        
        // Skip if no Proposed design (required)
        if (!proposedDesign?.structure) return;
        
        // Process wireEndPoints in Proposed design
        const wireEndPoints = proposedDesign.structure.wireEndPoints;
        if (!wireEndPoints) return;
        
        wireEndPoints.forEach((wep) => {
          // Check if this connects to another pole
          if (wep.type && 
              (wep.type === "NEXT_POLE" || 
               wep.type === "PREVIOUS_POLE" || 
               wep.type === "OTHER_POLE") && 
              wep.externalId) {
            
            // Get To Pole Label
            const toPoleExternalId = wep.externalId;
            const toPoleLabel = poleIdLookup[toPoleExternalId] || "Unknown";
            
            // Get Proposed Fiber Size
            let proposedFiberSize = "N/A";
            
            // Check each wire in this span
            if (wep.wires && proposedDesign.structure.wires) {
              const gigapowerWires = wep.wires
                ?.map(wireId => 
                  proposedDesign.structure?.wires?.find(w => w.id === wireId))
                .filter(wire => 
                  wire && wire.owner?.id && 
                  wire.owner.id.toLowerCase().includes("gigapower"));
                  
              if (gigapowerWires.length > 0) {
                // Get all sizes (without extraction)
                proposedFiberSize = gigapowerWires
                  .map(wire => 
                    wire.clientItem?.size || wire.size || wire.description || "Unknown Size")
                  .join(", ");
              }
            }
            
            // Get Remedy Fiber Size (if available)
            let remedyFiberSize = "N/A";
            
            if (remedyDesign) {
              // Find corresponding wireEndPoint in Remedy design
              const remedyWep = remedyDesign.structure?.wireEndPoints?.find(
                w => w.externalId === toPoleExternalId
              );
              
              if (remedyWep?.wires && remedyDesign.structure?.wires) {
                const gigapowerWires = remedyWep.wires
                  ?.map(wireId => 
                    remedyDesign.structure?.wires?.find(w => w.id === wireId))
                  .filter(wire => 
                    wire && wire.owner?.id && 
                    wire.owner.id.toLowerCase().includes("gigapower"));
                    
                if (gigapowerWires.length > 0) {
                  // Get all sizes (without extraction)
                  remedyFiberSize = gigapowerWires
                    .map(wire => 
                      wire.clientItem?.size || wire.size || wire.description || "Unknown Size")
                    .join(", ");
                }
              }
            }
            
            // Collect wire IDs for updates
            const proposedWireIds = wep.wires?.filter(wireId => 
              proposedDesign.structure?.wires?.find(w => 
                w.id === wireId && w.owner?.id?.toLowerCase().includes("gigapower")
              )
            ) || [];

            let remedyWireIds: string[] = [];
            if (remedyDesign && remedyDesign.structure?.wireEndPoints) {
              const remedyWep = remedyDesign.structure.wireEndPoints.find(
                w => w.externalId === toPoleExternalId
              );
              
              if (remedyWep?.wires) {
                remedyWireIds = remedyWep.wires.filter(wireId => 
                  remedyDesign.structure?.wires?.find(w => 
                    w.id === wireId && w.owner?.id?.toLowerCase().includes("gigapower")
                  )
                );
              }
            }

            // Only add span if we found Gigapower fiber in at least one design
            if (proposedFiberSize !== "N/A" || remedyFiberSize !== "N/A") {
              spans.push({
                fromPoleLabel,
                toPoleLabel,
                proposedFiberSize,
                remedyFiberSize,
                kmzFiberSize: "Pending KMZ Match", // Will be filled in later
                status: "Pending Comparison",      // Will be filled in later
                proposedWireIds,
                remedyWireIds
              });
            }
          }
        });
      });
    });
    
    return spans;
  };

  // Match KMZ data to the spans
  const matchKmzDataToSpans = (spans: SpanData[], kmzData: KmzFiberData[], poles: Pole[]): SpanData[] => {
    // Skip if no KMZ data
    if (!kmzData?.length) return spans;
    
    // Create a poles lookup by label
    const polesLookup: Record<string, Pole> = {};
    poles.forEach(pole => {
      if (pole.structureId) {
        polesLookup[pole.structureId] = pole;
      }
    });
    
    // Process each span
    return spans.map(span => {
      // Get coordinates for from and to poles
      const fromPole = polesLookup[span.fromPoleLabel];
      const toPole = polesLookup[span.toPoleLabel];
      
      if (!fromPole?.coordinates || !toPole?.coordinates) {
        return {
          ...span,
          kmzFiberSize: "No Coordinates",
          status: "Cannot Match"
        };
      }
      
      // Calculate midpoint between poles
      const midpointLat = (fromPole.coordinates.latitude + toPole.coordinates.latitude) / 2;
      const midpointLon = (fromPole.coordinates.longitude + toPole.coordinates.longitude) / 2;
      
      // Find nearest KMZ point to midpoint
      let closestKmz: KmzFiberData | null = null;
      let minDistance = Infinity;
      
      kmzData.forEach(kmz => {
        if (!kmz.coordinates) return;
        
        const distance = calculateDistance(
          midpointLat, midpointLon,
          kmz.coordinates.latitude, kmz.coordinates.longitude
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          closestKmz = kmz;
        }
      });
      
      // Set KMZ fiber size and determine status
      if (closestKmz && minDistance < 10000) { // Using reasonable threshold
        const kmzFiberSize = getCapafoValue(closestKmz) || closestKmz.fiberSize || "Unknown";
        
        // Determine status based on comparison
        let status = "Unknown";
        
        // Simply check if the strings contain the same numbers
        // This is simplified; you may want more sophisticated comparison
        const proposedMatch = span.proposedFiberSize.includes(kmzFiberSize) || 
                            kmzFiberSize.includes(extractNumbers(span.proposedFiberSize));
                            
        const remedyMatch = span.remedyFiberSize.includes(kmzFiberSize) || 
                          kmzFiberSize.includes(extractNumbers(span.remedyFiberSize));
        
        if (proposedMatch || remedyMatch) {
          status = "Match";
        } else {
          status = "Mismatch";
        }
        
        return {
          ...span,
          kmzFiberSize,
          status
        };
      } else {
        return {
          ...span,
          kmzFiberSize: "No KMZ Data Found",
          status: "Cannot Match"
        };
      }
    });
  };

  // Process data for the table
  const spanData = useMemo(() => {
    if (!originalJsonData) return [];
    
    // First extract spans from JSON
    const spans = extractSpanData(originalJsonData);
    
    // Then match KMZ data to spans
    return matchKmzDataToSpans(spans, kmzData, poles);
  }, [originalJsonData, kmzData, poles]);

  // Handle starting edit mode for a row
  const handleEditRow = (index: number) => {
    setEditingRows(prev => ({ ...prev, [index]: true }));
    setEditedValues(prev => ({
      ...prev,
      [index]: {
        proposed: spanData[index]?.proposedFiberSize !== "N/A" ? spanData[index].proposedFiberSize : "",
        remedy: spanData[index]?.remedyFiberSize !== "N/A" ? spanData[index].remedyFiberSize : ""
      }
    }));
  };

  // Handle saving changes for a row
  const handleSaveRow = (index: number) => {
    if (!onFiberSizeChange) return;

    const span = spanData[index];
    const changes: FiberSizeChange[] = [];

    // Check if proposed fiber size was changed
    if (
      editedValues[index]?.proposed !== undefined && 
      editedValues[index].proposed !== span.proposedFiberSize &&
      span.proposedWireIds?.length
    ) {
      changes.push({
        fromPoleLabel: span.fromPoleLabel,
        toPoleLabel: span.toPoleLabel,
        designLayer: "PROPOSED",
        newFiberSize: editedValues[index].proposed,
        wireIds: span.proposedWireIds || []
      });
    }

    // Check if remedy fiber size was changed
    if (
      editedValues[index]?.remedy !== undefined && 
      editedValues[index].remedy !== span.remedyFiberSize &&
      span.remedyWireIds?.length
    ) {
      changes.push({
        fromPoleLabel: span.fromPoleLabel,
        toPoleLabel: span.toPoleLabel,
        designLayer: "REMEDY",
        newFiberSize: editedValues[index].remedy,
        wireIds: span.remedyWireIds || []
      });
    }

    if (changes.length > 0) {
      onFiberSizeChange(changes);
    }

    // Exit edit mode
    setEditingRows(prev => ({ ...prev, [index]: false }));
  };

  // Handle input change for edited values
  const handleInputChange = (index: number, field: 'proposed' | 'remedy', value: string) => {
    setEditedValues(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        [field]: value
      }
    }));
  };

  return (
    <div className={className}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">From Pole</TableHead>
            <TableHead className="w-[100px]">To Pole</TableHead>
            <TableHead className="w-[140px]">Proposed Fiber Size</TableHead>
            <TableHead className="w-[140px]">Remedy Fiber Size</TableHead>
            <TableHead className="w-[120px]">KMZ Fiber Size</TableHead>
            <TableHead className="w-[80px]">Status</TableHead>
            <TableHead className="w-[70px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {spanData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                No comparison data available. Please ensure both pole data and KMZ data are loaded.
              </TableCell>
            </TableRow>
          ) : (
            spanData.map((item, index) => (
              <TableRow key={index} className={index % 2 === 0 ? "bg-gray-50" : undefined}>
                <TableCell className="font-medium">{item.fromPoleLabel}</TableCell>
                <TableCell>{item.toPoleLabel}</TableCell>
                <TableCell>
                  {editingRows[index] ? (
                    <Input
                      value={editedValues[index]?.proposed || ""}
                      onChange={(e) => handleInputChange(index, 'proposed', e.target.value)}
                      placeholder="Enter fiber size"
                      className="h-8 w-full"
                      disabled={item.proposedFiberSize === "N/A" || !item.proposedWireIds?.length}
                    />
                  ) : (
                    item.proposedFiberSize
                  )}
                </TableCell>
                <TableCell>
                  {editingRows[index] ? (
                    <Input
                      value={editedValues[index]?.remedy || ""}
                      onChange={(e) => handleInputChange(index, 'remedy', e.target.value)}
                      placeholder="Enter fiber size"
                      className="h-8 w-full"
                      disabled={item.remedyFiberSize === "N/A" || !item.remedyWireIds?.length}
                    />
                  ) : (
                    item.remedyFiberSize
                  )}
                </TableCell>
                <TableCell className="font-medium text-blue-700">{item.kmzFiberSize}</TableCell>
                <TableCell className="flex gap-2 items-center">
                  {item.status === "Match" ? (
                    <div className="flex items-center text-green-600">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      <span>Match</span>
                    </div>
                  ) : item.status === "Mismatch" ? (
                    <div className="flex items-center text-red-600">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      <span>Mismatch</span>
                    </div>
                  ) : (
                    <span className="text-gray-500">{item.status}</span>
                  )}
                </TableCell>
                <TableCell>
                  {editingRows[index] ? (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleSaveRow(index)}
                      className="px-2 h-7"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleEditRow(index)}
                      className="px-2 h-7"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
