import React, { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KmzFiberData, Pole } from "@/types"; // Removed PoleWire import
import { CheckCircle, AlertCircle, Edit, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
// Import the main processing function and the data type from the new utility file
import { processFiberComparisonData, ProcessedSpanData } from "@/utils/fiberComparisonUtils"; 

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

// Use ProcessedSpanData directly as the type for items in the table
type SpanData = ProcessedSpanData; 

export function FiberComparisonTable({ 
  kmzData, 
  poles, 
  originalJsonData, 
  className = "",
  onFiberSizeChange 
}: FiberComparisonTableProps) {
  // State for tracking which rows are being edited
  const [editingRows, setEditingRows] = useState<Record<number, boolean>>({});
  // State for tracking edited values (still uses strings for input fields)
  const [editedValues, setEditedValues] = useState<Record<number, { proposed?: string, remedy?: string }>>({});

  // Log props received by the component
  console.log("FiberComparisonTable props:", { 
    hasJson: !!originalJsonData, 
    kmzDataCount: kmzData?.length ?? 0, 
    polesCount: poles?.length ?? 0 
  });

  // Process data for the table using the refactored utility function
  const spanData: SpanData[] = useMemo(() => {
    console.log("FiberComparisonTable useMemo recalculating...");
    // Pass the required data to the processing function
    const processedData = processFiberComparisonData(originalJsonData, kmzData, poles);
    console.log(`FiberComparisonTable useMemo finished. Span count: ${processedData.length}`);
    return processedData;
  }, [originalJsonData, kmzData, poles]);

  // Handle starting edit mode for a row
  const handleEditRow = (index: number) => {
    const currentSpan = spanData[index];
    setEditingRows(prev => ({ ...prev, [index]: true }));
    setEditedValues(prev => ({
      ...prev,
      [index]: {
        proposed: currentSpan?.proposedFiberSize !== "N/A" ? currentSpan.proposedFiberSize : "",
        remedy: currentSpan?.remedyFiberSize !== "N/A" ? currentSpan.remedyFiberSize : ""
      }
    }));
  };

  // Handle saving changes for a row
  const handleSaveRow = (index: number) => {
    if (!onFiberSizeChange) return;

    const currentSpan = spanData[index];
    const editedData = editedValues[index];
    const changes: FiberSizeChange[] = [];

    // Check if proposed fiber size string was changed and is valid
    if (
      editedData?.proposed !== undefined && 
      editedData.proposed !== currentSpan.proposedFiberSize &&
      currentSpan.proposedWireIds?.length // Ensure there are wires to update
    ) {
      // Optional: Add validation here if needed before sending
      changes.push({
        fromPoleLabel: currentSpan.fromPoleLabel,
        toPoleLabel: currentSpan.toPoleLabel,
        designLayer: "PROPOSED",
        newFiberSize: editedData.proposed, // Send the string value back
        wireIds: currentSpan.proposedWireIds || []
      });
    }

    // Check if remedy fiber size string was changed and is valid
    if (
      editedData?.remedy !== undefined && 
      editedData.remedy !== currentSpan.remedyFiberSize &&
      currentSpan.remedyWireIds?.length // Ensure there are wires to update
    ) {
      // Optional: Add validation here if needed before sending
      changes.push({
        fromPoleLabel: currentSpan.fromPoleLabel,
        toPoleLabel: currentSpan.toPoleLabel,
        designLayer: "REMEDY",
        newFiberSize: editedData.remedy, // Send the string value back
        wireIds: currentSpan.remedyWireIds || []
      });
    }

    if (changes.length > 0) {
      onFiberSizeChange(changes);
    }

    // Exit edit mode
    setEditingRows(prev => ({ ...prev, [index]: false }));
    // Clear edited values for this row
    setEditedValues(prev => {
      const newState = { ...prev };
      delete newState[index];
      return newState;
    });
  };

  // Handle input change for edited values (works with strings)
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
                <TableCell>
                  {/* Updated Status Display Logic */}
                  {(() => {
                    switch (item.status) {
                      case "MATCH":
                        return (
                          <div className="flex items-center text-green-600">
                            <CheckCircle className="h-4 w-4 mr-1 flex-shrink-0" />
                            <span>Match</span>
                          </div>
                        );
                      case "MISMATCH":
                        return (
                          <div className="flex items-center text-red-600">
                            <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
                            <span>Mismatch</span>
                          </div>
                        );
                      case "JSON_ONLY":
                        return (
                          <div className="flex items-center text-orange-600" title="Fiber found in JSON data, but not in nearby KMZ data.">
                            <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
                            <span>JSON Only</span>
                          </div>
                        );
                      case "KMZ_ONLY":
                         return (
                          <div className="flex items-center text-purple-600" title="Fiber found in nearby KMZ data, but not in JSON data.">
                            <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
                            <span>KMZ Only</span>
                          </div>
                        );
                      case "NO_FIBER_FOUND":
                         return (
                          <div className="flex items-center text-gray-500" title="No fiber count > 0 found in either JSON or nearby KMZ data.">
                            <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
                            <span>No Fiber</span>
                          </div>
                        );
                      case "NO_KMZ_NEARBY":
                        return <span className="text-gray-500">No KMZ Nearby</span>;
                      case "NO_POLE_COORDS":
                        return <span className="text-gray-500">No Pole Coords</span>;
                      case "NO_KMZ_DATA_LOADED":
                         return <span className="text-gray-500">No KMZ Loaded</span>;
                      default:
                        return <span className="text-gray-500">{item.status}</span>; // Fallback for any unexpected status
                    }
                  })()}
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
