
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pole } from "@/types";
import { AttachmentTable } from "./AttachmentTable";
import { safeDisplayValue } from "@/utils/formatting";

interface PoleDetailsProps {
  pole: Pole;
}

export function PoleDetails({ pole }: PoleDetailsProps) {
  console.log('PoleDetails component received pole:', pole);
  console.log('Available layers:', Object.keys(pole.layers));
  
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
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Pole: {safeDisplayValue(pole.structureId)}</span>
          {pole.alias && (
            <span className="text-sm font-normal text-muted-foreground">
              Alias: {safeDisplayValue(pole.alias)}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedLayerKeys.length > 0 ? (
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="w-full">
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
                <TabsContent key={layerKey} value={layerKey} className="mt-4">
                  <AttachmentTable 
                    attachments={layer.attachments} 
                    layerName={layerKey} 
                  />
                </TabsContent>
              );
            })}
          </Tabs>
        ) : (
          <div className="text-center p-4 text-muted-foreground">
            No layer data available for this pole
          </div>
        )}
      </CardContent>
    </Card>
  );
}
