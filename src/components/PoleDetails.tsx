
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pole, WireEndPoint } from "@/types";
import { SPIDAcalcData } from "@/utils/dataCorrections";
import { AttachmentTable } from "./AttachmentTable";
import { WireTable } from "./WireTable";
import { WireEndPointsTable } from "./WireEndPointsTable";
import { PolePropertiesCard } from "./PolePropertiesCard";
import { ClearanceResultsTable } from "./ClearanceResultsTable";
import { QCResultsCard } from "./QCResultsCard";
import { WireEndPointOrderCard } from "./WireEndPointOrderCard";
import { Separator } from "@/components/ui/separator";

interface PoleDetailsProps {
  pole: Pole;
  onEnvironmentChange?: (poleId: string, wepId: string, layerName: string, newEnvironment: string) => void;
  jsonData?: SPIDAcalcData;
  onJsonDataUpdate?: (updatedData: SPIDAcalcData) => void;
}

export function PoleDetails({ pole, onEnvironmentChange, jsonData, onJsonDataUpdate }: PoleDetailsProps) {
  // Debug logging
  if (pole.structureId === "H14C378") {
    console.log("PoleDetails - Found H14C378 pole");
    console.log("Pole coordinates:", pole.coordinates);
    
    // Log the properties of each layer to debug remedies
    Object.entries(pole.layers).forEach(([layerName, layer]) => {
      console.log(`Layer ${layerName} poleProperties:`, layer.poleProperties);
      if (layer.poleProperties?.remedies) {
        console.log(`Layer ${layerName} remedies:`, layer.poleProperties.remedies);
      } else {
        console.log(`Layer ${layerName} has NO remedies`);
      }
    });
  }
  
  // Sort layers to ensure consistent order (EXISTING, PROPOSED, REMEDY)
  const layerOrder = ["EXISTING", "PROPOSED", "REMEDY"];
  
  const sortedLayerKeys = Object.keys(pole.layers).sort((a, b) => {
    const aIndex = layerOrder.indexOf(a.toUpperCase());
    const bIndex = layerOrder.indexOf(b.toUpperCase());
    
    // If both are in the layerOrder array, sort by their index
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    
    // If only one is in the layerOrder array, prioritize it
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    
    // If neither is in the layerOrder array, sort alphabetically
    return a.localeCompare(b);
  });
  
  // Use the first layer as default tab
  const defaultTab = sortedLayerKeys.length > 0 ? sortedLayerKeys[0] : undefined;
  
  // Get coordinate string if available
  const coordinateString = pole.coordinates 
    ? `${pole.coordinates.latitude.toFixed(6)}, ${pole.coordinates.longitude.toFixed(6)}`
    : "Coordinates not available";
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center">
            <CardTitle className="text-xl">
              Pole: {pole.structureId}
            </CardTitle>
            <div className="text-sm text-muted-foreground mt-1 md:mt-0">
              {pole.alias && <div>Alias: {pole.alias}</div>}
              <div>Coordinates: {coordinateString}</div>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      {/* Remedies Card - Show remedies only once */}
      {(() => {
        // Find the first layer with remedies
        const layerWithRemedies = Object.values(pole.layers).find(
          layer => layer.poleProperties?.remedies?.length > 0
        );
        
        if (!layerWithRemedies || !layerWithRemedies.poleProperties?.remedies?.length) return null;
        
        const remedies = layerWithRemedies.poleProperties.remedies;
        
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Remedies / Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {remedies
                  .filter(remedy => remedy.description && remedy.description.trim() !== '') // Filter out empty descriptions
                  .map((remedy, index) => (
                    <li key={index}>{remedy.description.replace(/^\s*•\s*|\u2022\s*/g, '')}</li> // Remove leading bullet if present
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })()}
      
      {/* QC Results Card */}
      <QCResultsCard 
        results={pole.qcResults} 
        jsonData={jsonData} 
        onDataUpdate={onJsonDataUpdate} 
      />
      
      {/* Wire End Point Order Check Card - Displayed separately */}
      {pole.qcResults?.wireEndPointOrderCheck && (
        <WireEndPointOrderCard
          checkResult={pole.qcResults.wireEndPointOrderCheck}
          poleStructureId={pole.structureId}
          jsonData={jsonData}
          onDataUpdate={onJsonDataUpdate}
        />
      )}
      
      {/* Design Layers */}
      {sortedLayerKeys.length > 0 ? (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-lg">Design Layers</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Tabs defaultValue={defaultTab} className="w-full mt-4">
              <TabsList className="w-full mb-4">
                {sortedLayerKeys.map((layerKey) => (
                  <TabsTrigger 
                    key={layerKey} 
                    value={layerKey}
                    className="flex-1"
                  >
                    {layerKey}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {sortedLayerKeys.map((layerKey) => {
                const layer = pole.layers[layerKey];
                return (
                  <TabsContent key={layerKey} value={layerKey} className="space-y-6">
                    {/* Pole Properties */}
                    <PolePropertiesCard 
                      properties={layer.poleProperties} 
                      layerName={layerKey} 
                      onEnvironmentChange={(newEnvironment) => {
                        if (onEnvironmentChange) {
                          // Use a special 'pole' identifier to indicate this is for pole properties, not a WEP
                          onEnvironmentChange(pole.structureId, 'pole', layerKey, newEnvironment);
                        }
                      }}
                    />
                    
                    <Separator />
                    
                    {/* Attachments */}
                    <div className="mt-4">
                      <AttachmentTable 
                        attachments={layer.attachments} 
                        layerName={layerKey} 
                      />
                    </div>
                    
                    {/* Wires */}
                    {layer.wires && layer.wires.length > 0 && (
                      <div className="mt-4">
                        <WireTable 
                          wires={layer.wires} 
                          layerName={layerKey} 
                        />
                      </div>
                    )}
                    
                    {/* Wire End Points */}
                    {layer.wireEndPoints && layer.wireEndPoints.length > 0 && (
                      <div className="mt-4">
                        <WireEndPointsTable 
                          wireEndPoints={layer.wireEndPoints} 
                          layerName={layerKey} 
                          onEnvironmentChange={(wepId, newEnvironment) => {
                            if (onEnvironmentChange) {
                              onEnvironmentChange(pole.structureId, wepId, layerKey, newEnvironment);
                            }
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Clearance Results */}
                    {layer.clearanceResults && layer.clearanceResults.length > 0 && (
                      <div className="mt-4">
                        <ClearanceResultsTable 
                          clearanceResults={layer.clearanceResults} 
                          layerName={layerKey} 
                        />
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="text-center p-4 text-muted-foreground">
              No layer data available for this pole
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
