import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PoleProperties } from "@/types";
import { metersToFeetInches } from "@/utils/parsers";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";

// Environment options in the specified order
const ENVIRONMENT_OPTIONS = [
  "Street",
  "Pedestrian",
  "Residential Driveway",
  "None",
  "Alley",
  "AMAFCA Channel",
  "BCPWD Channel",
  "Commercial Driveway",
  "DOT Highway",
  "Farm",
  "MRGCD Channel",
  "Obstructed Parallel To Street",
  "Parallel To Street",
  "Railroad",
  "Rural",
  "Unlikely Parallel To Street"
];

interface PolePropertiesCardProps {
  properties?: PoleProperties;
  layerName: string;
  onEnvironmentChange?: (newEnvironment: string) => void;
}

export function PolePropertiesCard({ properties, layerName, onEnvironmentChange }: PolePropertiesCardProps) {
  const [environment, setEnvironment] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);

  useEffect(() => {
    // Initialize environment from properties
    if (properties?.environment) {
      setEnvironment(properties.environment);
    }
  }, [properties]);

  const handleSaveEnvironment = () => {
    setIsEditing(false);
    if (onEnvironmentChange) {
      onEnvironmentChange(environment);
    }
  };
  if (!properties) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{layerName} Pole Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">
            No pole property data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format GLC and AGL values
  const glcValue = properties.glc?.value 
    ? `${properties.glc.value.toFixed(2)} ${properties.glc.unit}`
    : "Not specified";
    
  const aglValue = properties.agl?.value 
    ? `${properties.agl.value.toFixed(2)} ${properties.agl.unit}`
    : "Not specified";
    
  const heightInFeet = properties.length 
    ? metersToFeetInches(properties.length)
    : "Not specified";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{layerName} Pole Properties</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-medium mb-2">Specification</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">Item/Alias:</div>
            <div className="font-medium">{properties.clientItemAlias || "Not specified"}</div>
            
            <div className="text-muted-foreground">Species:</div>
            <div className="font-medium">{properties.species || "Not specified"}</div>
            
            <div className="text-muted-foreground">Class:</div>
            <div className="font-medium">{properties.class || "Not specified"}</div>
            
            <div className="text-muted-foreground">Length:</div>
            <div className="font-medium">
              {properties.length 
                ? `${heightInFeet} (${properties.length.toFixed(2)} m)` 
                : "Not specified"}
            </div>

            <div className="text-muted-foreground">Environment:</div>
            <div className="font-medium">
              {isEditing ? (
                <Select
                  value={environment}
                  onValueChange={(value) => {
                    setEnvironment(value);
                    if (onEnvironmentChange) {
                      onEnvironmentChange(value);
                    }
                    setIsEditing(false);
                  }}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENVIRONMENT_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div 
                  className="cursor-pointer hover:bg-slate-50 p-1 rounded"
                  onClick={() => setIsEditing(true)}
                >
                  {environment ? environment : (
                    <span className="text-muted-foreground">None (click to edit)</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <Separator />
        
        <div>
          <h3 className="font-medium mb-2">Measurements</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">
              Ground Line Circumference (GLC):
            </div>
            <div className="font-medium">{glcValue}</div>
            
            <div className="text-muted-foreground">
              Above Ground Length (AGL):
            </div>
            <div className="font-medium">{aglValue}</div>
          </div>
        </div>
        
        {/* Remedies section removed - now displayed at top level */}
      </CardContent>
    </Card>
  );
}
