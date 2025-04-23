import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WireEndPoint } from "@/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Check, Save } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { metersToFeetInches } from "@/utils/parsers";
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

interface WireEndPointsTableProps {
  wireEndPoints: WireEndPoint[];
  layerName: string;
  onEnvironmentChange?: (wepId: string, newEnvironment: string) => void;
}

export function WireEndPointsTable({ wireEndPoints, layerName, onEnvironmentChange }: WireEndPointsTableProps) {
  // Store state for checkboxes and environment values
  const [entryRequired, setEntryRequired] = useState<Record<string, boolean>>({});
  const [environments, setEnvironments] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});

  // Initialize environments from wireEndPoints
  useEffect(() => {
    const initialEnvironments: Record<string, string> = {};
    wireEndPoints.forEach(wep => {
      const wepId = wep.id || `unknown-${Math.random()}`;
      initialEnvironments[wepId] = wep.environment || '';
    });
    setEnvironments(initialEnvironments);
  }, [wireEndPoints]);

  // Determine badge color based on layer name
  const getBadgeVariant = () => {
    switch (layerName.toUpperCase()) {
      case "EXISTING":
        return "secondary";
      case "PROPOSED":
        return "outline";
      case "REMEDY":
        return "default";
      default:
        return "outline";
    }
  };

  // Get display name for WEP type
  const getTypeName = (type?: string): string => {
    if (!type) return "Unknown";

    switch (type.toUpperCase()) {
      case "OTHER_POLE": return "Pole";
      case "CROSSING_POLE": return "Crossing Pole";
      case "BUILDING": return "Building";
      case "GROUND": return "Ground";
      default: return type;
    }
  };

  // Format direction in degrees to compass direction
  const formatDirection = (degrees: number): string => {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(degrees / 45) % 8;
    return `${directions[index]} (${degrees.toFixed(1)}°)`;
  };

  // Toggle checkbox for a specific WEP
  const toggleEntryRequired = (wepId: string) => {
    setEntryRequired(prev => ({
      ...prev,
      [wepId]: !prev[wepId]
    }));
  };

  return (
    <div className="rounded-md border">
      <div className="p-4 flex items-center justify-between border-b">
        <h3 className="font-medium">{layerName} Wire End Points</h3>
        <div className="flex items-center">
          <Badge variant={getBadgeVariant()} className="ml-2">
            <span>{wireEndPoints.length}</span>
          </Badge>
          <span className="text-sm ml-1">
            item{wireEndPoints.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      
      {wireEndPoints.length > 0 ? (
        <div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">ID</TableHead>
                <TableHead className="w-[120px]">Direction</TableHead>
                <TableHead className="w-[120px]">Distance</TableHead>
                <TableHead className="w-[120px]">Type</TableHead>
                <TableHead className="w-[120px]">Environment</TableHead>
                <TableHead className="w-[180px]">Environment Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wireEndPoints.map((wep, index) => {
                const wepId = wep.id || `wep-${index}`;
                return (
                  <TableRow key={wepId}>
                    <TableCell>{wep.id || "Unknown"}</TableCell>
                    <TableCell>
                      {typeof wep.direction === 'number' ? formatDirection(wep.direction) : "Unknown"}
                    </TableCell>
                    <TableCell>
                      {wep.distance ? (
                        <>
                          {metersToFeetInches(wep.distance.value)}
                          <span className="text-xs text-muted-foreground block">
                            ({wep.distance.value.toFixed(2)} m)
                          </span>
                        </>
                      ) : (
                        "Unknown"
                      )}
                    </TableCell>
                    <TableCell>{getTypeName(wep.type)}</TableCell>
                    <TableCell>
                      {editing[wepId] ? (
                        <Select
                          value={environments[wepId] || ''}
                          onValueChange={(value) => {
                            setEnvironments(prev => ({
                              ...prev,
                              [wepId]: value
                            }));
                            
                            if (onEnvironmentChange) {
                              onEnvironmentChange(wepId, value);
                            }
                            
                            // Exit edit mode after selection
                            setEditing(prev => ({...prev, [wepId]: false}));
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
                          onClick={() => setEditing(prev => ({...prev, [wepId]: true}))}
                        >
                          {environments[wepId] ? environments[wepId] : (
                            <span className="text-muted-foreground">None (click to edit)</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {wep.environmentStatus === 'NE' ? (
                        <div className="flex items-center gap-3">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="destructive" className="cursor-help">NE</Badge>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p>Environment Not Entered</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id={`entry-required-${wepId}`} 
                              checked={entryRequired[wepId]} 
                              onCheckedChange={() => toggleEntryRequired(wepId)} 
                            />
                            <label 
                              htmlFor={`entry-required-${wepId}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Entry Required?
                            </label>
                          </div>
                        </div>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-600 hover:bg-green-50">E</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="p-4 text-center text-muted-foreground">
          No wire end points found in this layer
        </div>
      )}
    </div>
  );
}
