
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pole, ValidationResults, QCCheckStatus } from "@/types";
import { PoleDetails } from "./PoleDetails";
import { MapView } from "./MapView";
import { QCSummary } from "./QCSummary";
import { AlertCircle, AlertTriangle, Check, Download, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "./ui/button";

interface ResultsProps {
  poles: Pole[];
  validationResults?: ValidationResults;
  originalJsonData?: Record<string, unknown>;
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

interface EnvironmentChange {
  poleId: string;
  wepId: string; // 'pole' for pole properties
  layerName: string;
  newEnvironment: string;
}

export function Results({ poles: initialPoles, validationResults, originalJsonData }: ResultsProps) {
  const [poles, setPoles] = useState<Pole[]>(initialPoles);
  const [selectedPoleId, setSelectedPoleId] = useState<string | undefined>(
    poles.length > 0 ? poles[0].structureId : undefined
  );
  
  // Keep track of all environment changes
  const [environmentChanges, setEnvironmentChanges] = useState<EnvironmentChange[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Tabs for switching between QC overview and pole details
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Update local poles state when props change
  useEffect(() => {
    setPoles(initialPoles);
  }, [initialPoles]);

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

  // Generate updated JSON with environment changes
  const generateUpdatedJson = () => {
    if (!originalJsonData) return null;
    
    // Create a deep copy of the original JSON data
    const updatedJson = JSON.parse(JSON.stringify(originalJsonData));
    
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
          </TabsList>
          
          <div className="text-sm text-muted-foreground">
            Analyzed {poles.length} pole{poles.length !== 1 ? 's' : ''}
          </div>
        </div>
        
        <TabsContent value="overview" className="space-y-4 mt-0">
          <QCSummary poles={poles} />
        </TabsContent>
        
        <TabsContent value="details" className="mt-0">
          {/* Save/Download button for environment changes */}
          {hasUnsavedChanges && (
            <Card className="mb-4 bg-amber-50 border-amber-200">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">Unsaved Environment Changes</h3>
                    <p className="text-sm text-muted-foreground">
                      You have made {environmentChanges.length} change{environmentChanges.length !== 1 ? 's' : ''} to environment values
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
                initialZoom={17} // Close-up zoom level when viewing the first pole
              />
            </div>
          </div>

          {selectedPole ? (
            <div className="mt-6">
              <PoleDetails 
                pole={selectedPole} 
                onEnvironmentChange={handleEnvironmentChange}
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
