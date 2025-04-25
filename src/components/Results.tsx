
import { useState, useEffect, useCallback } from "react"; // Removed useMemo for now
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pole, ValidationResults, QCCheckStatus, KmzFiberData, DesignComparisonResults } from "@/types"; // Added DesignComparisonResults
import { PoleDetails } from "./PoleDetails";
import { MapView } from "./MapView";
import { QCSummary } from "./QCSummary";
import { FiberComparisonTable, FiberSizeChange } from "./FiberComparisonTable";
import { SpanComparisonTable } from "./SpanComparisonTable"; // Import the new component
import { SPIDAcalcData, correctWireEndPointOrderForAllLocations } from "@/utils/dataCorrections";
import { WireEndPointOrderCheckTable } from "./WireEndPointOrderCheckTable";
import { AlertCircle, AlertTriangle, Check, Download, FileUp, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
// import { Separator } from "@/components/ui/separator"; // Separator seems unused here
import { Button } from "./ui/button";

interface ResultsProps {
  poles: Pole[];
  validationResults?: ValidationResults;
  originalJsonData?: Record<string, unknown>;
  kmzFiberData?: KmzFiberData[];
  onKmzDataParsed?: (data: KmzFiberData[]) => void;
  designComparisonResults?: DesignComparisonResults | null; // Added prop for comparison results
}

// Interfaces for SPIDAcalc JSON structure
interface SPIDALocation {
  id?: string;
  label?: string;
  designs?: SPIDADesign[];
}

interface SPIDADesign {
  label?: string;
  structure?: SPIDAStructure;
}

interface SPIDAStructure {
  pole?: Record<string, unknown>;
  wireEndPoints?: SPIDAWireEndPoint[];
}

interface SPIDAWireEndPoint {
  id?: string;
  environment?: string;
}

interface SPIDAWire {
  id: string;
  clientItem?: {
    size?: string;
    type?: string;
  };
  size?: string;
  description?: string;
}

interface EnvironmentChange {
  poleId: string;
  wepId: string; // 'pole' for pole properties
  layerName: string;
  newEnvironment: string;
}

export function Results({
  poles: initialPoles,
  validationResults,
  originalJsonData,
  kmzFiberData,
  onKmzDataParsed,
  designComparisonResults // Added prop
}: ResultsProps) {
  const [poles, setPoles] = useState<Pole[]>(initialPoles);
  const [selectedPoleId, setSelectedPoleId] = useState<string | undefined>(
    initialPoles.length > 0 ? initialPoles[0].structureId : undefined // Use initialPoles here
  );

  // Keep track of all environment changes
  const [environmentChanges, setEnvironmentChanges] = useState<EnvironmentChange[]>([]);
  // Keep track of fiber size changes
  const [fiberSizeChanges, setFiberSizeChanges] = useState<FiberSizeChange[]>([]);
  // Keep track of wire end point order check summary
  const [wepOrderSummary, setWepOrderSummary] = useState<Array<{ locationLabel: string; status: string; message?: string }> | null>(null);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Tabs for switching between QC overview, pole details, fiber comparison, and corrections
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Update local poles state when props change
  useEffect(() => {
    setPoles(initialPoles);
  }, [initialPoles]);

  // Run wire end point order correction when originalJsonData changes
  useEffect(() => {
    if (originalJsonData) {
      const { summary } = correctWireEndPointOrderForAllLocations(originalJsonData as SPIDAcalcData);
      setWepOrderSummary(summary);
    }
  }, [originalJsonData]);

  const handlePoleSelect = (poleId: string) => {
    setSelectedPoleId(poleId);
    setActiveTab("details"); // Switch to details tab when selecting a pole
  };

  // Handle environment changes
  const handleEnvironmentChange = (poleId: string, wepId: string, layerName: string, newEnvironment: string) => {
    // Record the change (only need to record once as we'll update all layers)
    setEnvironmentChanges(prev => [...prev, { poleId, wepId, layerName: 'ALL', newEnvironment }]);
    setHasUnsavedChanges(true);
    
    // Update the local state to reflect the change immediately in the UI
    setPoles(prevPoles => {
      return prevPoles.map(pole => {
        if (pole.structureId !== poleId) return pole;
        
        // Create a deep copy of the pole to avoid mutating the original
        const updatedPole = JSON.parse(JSON.stringify(pole)) as Pole;
        
        // Update the environment across all layers
        Object.keys(updatedPole.layers).forEach(currentLayerName => {
          const layer = updatedPole.layers[currentLayerName];
          
          if (wepId === 'pole') {
            // It's a pole environment change - update in all layers
            if (layer.poleProperties) {
              layer.poleProperties.environment = newEnvironment;
            }
          } else {
            // It's a wire end point environment change - update in all layers
            if (layer.wireEndPoints) {
              const wepIndex = layer.wireEndPoints.findIndex(wep => wep.id === wepId);
              if (wepIndex !== -1) {
                layer.wireEndPoints[wepIndex].environment = newEnvironment;
                
                // Update environment status
                layer.wireEndPoints[wepIndex].environmentStatus = 
                  newEnvironment ? 'E' : 'NE';
              }
            }
          }
        });
        
        return updatedPole;
      });
    });
  };

  // Handle fiber size changes
  const handleFiberSizeChange = useCallback((changes: FiberSizeChange[]) => {
    // Add the new changes to the existing ones
    setFiberSizeChanges(prev => [...prev, ...changes]);
    setHasUnsavedChanges(true);
  }, []);

  // Generate updated JSON with environment, fiber size, and WEP order changes
  const generateUpdatedJson = () => {
    if (!originalJsonData) return null;

    // Start with the data corrected for WEP order
    const { correctedData: updatedJson } = correctWireEndPointOrderForAllLocations(originalJsonData as SPIDAcalcData);

    // Apply all environment changes to the JSON
    environmentChanges.forEach(change => {
      const { poleId, wepId, newEnvironment } = change;

      // Find the pole in the JSON
      // The exact path depends on the JSON structure, but likely resembles:
      // updatedJson.leads[0].locations[poleIndex].designs[layerIndex]...

      // This would need to be customized based on the actual structure:
      if (updatedJson.leads && Array.isArray(updatedJson.leads) && updatedJson.leads.length > 0) {
        const locations = updatedJson.leads[0].locations;
        if (Array.isArray(locations)) {
          // Find the pole by its ID/structureId
          const poleIndex = locations.findIndex((loc: SPIDALocation) => loc.label === poleId || loc.id === poleId);

          if (poleIndex !== -1) {
            const designs = locations[poleIndex].designs;
            if (Array.isArray(designs)) {
              // Update all layers for this pole
              designs.forEach(design => {
                if (wepId === 'pole') {
                  // Update pole environment in this layer
                  if (design.structure?.pole) {
                    design.structure.pole.environment = newEnvironment;
                  }
                } else {
                  // Update wire end point environment in this layer
                  const wireEndPoints = design.structure?.wireEndPoints;
                  if (Array.isArray(wireEndPoints)) {
                    const wepIndex = wireEndPoints.findIndex((wep: SPIDAWireEndPoint) => wep.id === wepId);
                    if (wepIndex !== -1) {
                      wireEndPoints[wepIndex].environment = newEnvironment;
                    }
                  }
                }
              });
            }
          }
        }
      }
    });

    // Apply all fiber size changes to the JSON
    fiberSizeChanges.forEach(change => {
      const { fromPoleLabel, toPoleLabel, designLayer, newFiberSize, wireIds } = change;

      // Find the pole in the JSON
      if (updatedJson.leads && Array.isArray(updatedJson.leads) && updatedJson.leads.length > 0) {
        const locations = updatedJson.leads[0].locations;
        if (Array.isArray(locations)) {
          // Find the pole by its label
          const poleIndex = locations.findIndex(
            (loc: SPIDALocation) => loc.label === fromPoleLabel || loc.id === fromPoleLabel
          );

          if (poleIndex !== -1) {
            const designs = locations[poleIndex].designs;
            if (Array.isArray(designs)) {
              // Find the specific design layer (PROPOSED or REMEDY)
              const designIndex = designs.findIndex(
                d => d.label === designLayer || d.label === designLayer.toLowerCase()
              );

              if (designIndex !== -1 && designs[designIndex].structure?.wires) {
                // Update each wire in the wireIds array
                wireIds.forEach(wireId => {
                  const wireIndex = designs[designIndex].structure.wires.findIndex(
                    (w: SPIDAWire) => w.id === wireId
                  );

                  if (wireIndex !== -1) {
                    const wire = designs[designIndex].structure.wires[wireIndex];

                    // Update the fiber size in the appropriate field
                    // We'll update all possible fields where size might be stored
                    if (wire.clientItem) {
                      wire.clientItem.size = newFiberSize;
                    }
                    wire.size = newFiberSize;

                    // Update description if it contains fiber size information
                    if (wire.description &&
                        (wire.description.includes('fiber') ||
                         wire.description.includes('ct') ||
                         wire.description.includes('fbr'))) {
                      wire.description = newFiberSize;
                    }
                  }
                });
              }
            }
          }
        }
      }
    });

    return updatedJson;
  };

  // Download the updated JSON
  const handleDownloadJson = () => {
    const updatedJson = generateUpdatedJson();
    if (!updatedJson) return;
    
    // Convert to string with pretty formatting
    const jsonString = JSON.stringify(updatedJson, null, 2);
    
    // Create a blob and download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'updated-spidacalc-data.json';
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setHasUnsavedChanges(false);
    }, 100);
  };

  // Get the currently selected pole object
  const selectedPole = poles.find(pole => pole.structureId === selectedPoleId);

  // Get QC status icon for the pole list
  const getStatusIcon = (pole: Pole) => {
    const status = pole.qcResults?.overallStatus;
    
    if (!status || status === "NOT_CHECKED") {
      return null;
    }
    
    switch (status) {
      case "PASS":
        return <Check className="h-4 w-4 text-green-500" />;
      case "FAIL":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "WARNING":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  // Get badge variant based on QC status
  const getStatusBadgeVariant = (status?: QCCheckStatus) => {
    if (!status || status === "NOT_CHECKED") return "outline";
    
    switch (status) {
      case "PASS": return "default";
      case "FAIL": return "destructive";
      case "WARNING": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="overview" className="px-6">
              QC Overview
            </TabsTrigger>
            <TabsTrigger value="details" className="px-6">
              Pole Details
            </TabsTrigger>
            <TabsTrigger value="fiber" className="px-6">
              Fiber Comparison
            </TabsTrigger>
            <TabsTrigger value="fiber" className="px-6">
              Fiber Comparison
            </TabsTrigger>
            <TabsTrigger value="span-comparison" className="px-6"> {/* New Tab */}
              Span Comparison
            </TabsTrigger>
            <TabsTrigger value="corrections" className="px-6">
              Corrections
            </TabsTrigger>
          </TabsList>

          <div className="text-sm text-muted-foreground">
            Analyzed {poles.length} pole{poles.length !== 1 ? 's' : ''}
          </div>
        </div>
        
        <TabsContent value="overview" className="space-y-4 mt-0">
          <QCSummary poles={poles} />
        </TabsContent>

        <TabsContent value="span-comparison" className="mt-0"> {/* New Tab Content */}
          {designComparisonResults ? (
            <SpanComparisonTable results={designComparisonResults} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Span Comparison</CardTitle>
                <CardDescription>Proposed vs. Remedy Layer Span Analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Comparison data not available. Ensure the uploaded file contains both 'Proposed' and 'Remedy' layers.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="fiber" className="mt-0">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Fiber Size Comparison</CardTitle>
              <CardDescription>
                Comparison between pole fiber size (from JSON) and midspan fiber size (from KMZ)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <div className="mb-4 flex items-center justify-end">
                  <input
                    type="file"
                    id="kmz-file-upload"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        // Get a reference to the hidden file input in MapView
                        const mapViewFileInput = document.getElementById('map-kmz-file-upload') as HTMLInputElement;
                        if (mapViewFileInput) {
                          // Create a new FileList object
                          const dataTransfer = new DataTransfer();
                          dataTransfer.items.add(e.target.files[0]);
                          mapViewFileInput.files = dataTransfer.files;

                          // Dispatch a change event
                          const event = new Event('change', { bubbles: true });
                          mapViewFileInput.dispatchEvent(event);
                        }
                      }
                    }}
                    accept=".kml,.kmz"
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('kmz-file-upload')?.click()}
                    className="text-xs flex items-center gap-1"
                  >
                    <FileUp className="h-3 w-3" />
                    {kmzFiberData && kmzFiberData.length > 0 ? 'Change KML/KMZ File' : 'Upload KML/KMZ File'}
                  </Button>
                </div>

                {kmzFiberData && kmzFiberData.length > 0 ? (
                  <FiberComparisonTable
                    poles={poles}
                    kmzData={kmzFiberData}
                    originalJsonData={originalJsonData}
                    onFiberSizeChange={handleFiberSizeChange}
                  />
                ) : (
                  <div className="text-center p-4 text-muted-foreground">
                    <p>No KMZ data available. Please upload a KMZ file using the button above.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="corrections" className="mt-0">
          {wepOrderSummary && <WireEndPointOrderCheckTable summary={wepOrderSummary} />}
        </TabsContent>

        <TabsContent value="details" className="mt-0">
          {/* Save/Download button for environment changes */}
              {(hasUnsavedChanges || fiberSizeChanges.length > 0) && (
            <Card className="mb-4 bg-amber-50 border-amber-200">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">Unsaved Changes</h3>
                    <p className="text-sm text-muted-foreground">
                      {environmentChanges.length > 0 && (
                        <span>Environment changes: {environmentChanges.length}</span>
                      )}
                      {environmentChanges.length > 0 && fiberSizeChanges.length > 0 && (
                        <span> | </span>
                      )}
                      {fiberSizeChanges.length > 0 && (
                        <span>Fiber size changes: {fiberSizeChanges.length}</span>
                      )}
                    </p>
                  </div>
                  <Button onClick={handleDownloadJson} className="ml-4">
                    <Download className="mr-2 h-4 w-4" />
                    Download Updated JSON
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Pole Selection</CardTitle>
                  <CardDescription>
                    Select a pole to view details
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] overflow-y-auto">
                    {poles.map((pole) => (
                      <div
                        key={pole.structureId}
                        className={`p-3 border-b cursor-pointer transition-colors ${
                          selectedPoleId === pole.structureId
                            ? "bg-muted"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => handlePoleSelect(pole.structureId)}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">{pole.structureId}</div>
                            {pole.alias && (
                              <div className="text-xs text-muted-foreground">
                                {typeof pole.alias === 'string' ? pole.alias : JSON.stringify(pole.alias)}
                              </div>
                            )}
                          </div>

                          {pole.qcResults?.overallStatus && pole.qcResults.overallStatus !== "NOT_CHECKED" && (
                            <Badge variant={getStatusBadgeVariant(pole.qcResults.overallStatus)}>
                              <div className="flex items-center">
                                {getStatusIcon(pole)}
                                <span className="ml-1 text-xs">
                                  {pole.qcResults.overallStatus}
                                </span>
                              </div>
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <MapView
                poles={poles}
                selectedPoleId={selectedPoleId}
                onSelectPole={handlePoleSelect}
                onEnvironmentChange={handleEnvironmentChange}
                onKmzDataParsed={onKmzDataParsed}
                initialZoom={17} // Close-up zoom level when viewing the first pole
              />
            </div>
          </div>

          {selectedPole ? (
            <div className="mt-6">
              <PoleDetails
                pole={selectedPole}
                onEnvironmentChange={handleEnvironmentChange}
                jsonData={originalJsonData as SPIDAcalcData}
                onJsonDataUpdate={(updatedData) => {
                  // When the JSON is updated from the QCResultsCard, update the originalJsonData
                  // and set hasUnsavedChanges to true
                  setHasUnsavedChanges(true);

                  // Create a new PoleDetails function to handle wireEndPoint order changes
                  const updatedPoles = [...poles];
                  const selectedPoleIndex = updatedPoles.findIndex(p => p.structureId === selectedPole.structureId);

                  if (selectedPoleIndex >= 0) {
                    // Update the status of the wireEndPointOrderCheck
                    const updatedPole = { ...updatedPoles[selectedPoleIndex] };
                    if (updatedPole.qcResults?.wireEndPointOrderCheck) {
                      updatedPole.qcResults.wireEndPointOrderCheck = {
                        ...updatedPole.qcResults.wireEndPointOrderCheck,
                        status: "PASS",
                        message: "WireEndPoints order is consistent between PROPOSED and REMEDY designs",
                        details: ["Order has been corrected"]
                      };

                      // Update the overall QC result if needed
                      if (updatedPole.qcResults.failCount > 0) {
                        updatedPole.qcResults.failCount--;
                        updatedPole.qcResults.passCount++;
                      }

                      // Update the pole in the poles array
                      updatedPoles[selectedPoleIndex] = updatedPole;
                      setPoles(updatedPoles);
                    }
                  }
                }}
              />
            </div>
          ) : (
            <Card className="mt-6">
              <CardContent className="flex items-center justify-center p-8">
                <p className="text-muted-foreground">Select a pole to view detailed information</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
