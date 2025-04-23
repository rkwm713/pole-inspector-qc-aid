import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PoleWire } from "@/types";
import { AlertCircle, Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { metersToFeetInches } from "@/utils/parsers";

interface WireTableProps {
  wires: PoleWire[];
  layerName: string;
}

export function WireTable({ wires, layerName }: WireTableProps) {
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

  // Categorize wires by type/purpose
  const categorizeWire = (wire: PoleWire): string => {
    if (!wire.type) return "OTHER";
    
    const type = wire.type.toLowerCase();
    
    if (type.includes("primary") || type.includes("transmission")) {
      return "PRIMARY";
    } else if (type.includes("secondary") || type.includes("distribution")) {
      return "SECONDARY";
    } else if (type.includes("neutral") || type.includes("ground")) {
      return "NEUTRAL/GROUND";
    } else if (type.includes("guy")) {
      return "GUY";
    } else if (type.includes("comm") || type.includes("fiber") || type.includes("cable")) {
      return "COMMUNICATION";
    } else {
      return "OTHER";
    }
  };

  // Group wires by category
  const wireCategories = wires.reduce<Record<string, PoleWire[]>>((acc, wire) => {
    const category = categorizeWire(wire);
    if (!acc[category]) acc[category] = [];
    acc[category].push(wire);
    return acc;
  }, {});

  // Category display order
  const categoryOrder = [
    "PRIMARY", 
    "SECONDARY", 
    "NEUTRAL/GROUND", 
    "COMMUNICATION", 
    "GUY", 
    "OTHER"
  ];

  // Get display name for category
  const getCategoryName = (category: string): string => {
    switch (category) {
      case "PRIMARY": return "Primary Conductors";
      case "SECONDARY": return "Secondary Conductors";
      case "NEUTRAL/GROUND": return "Neutral/Ground Wires";
      case "COMMUNICATION": return "Communication Cables";
      case "GUY": return "Guy Wires";
      case "OTHER": return "Other Wires";
      default: return `${category} Wires`;
    }
  };

  // Check if tension is suspiciously low
  const hasTensionIssue = (wire: PoleWire): boolean => {
    return wire.tension === 0 || wire.tension < 100; // 100 is arbitrary threshold
  };

  return (
    <div className="rounded-md border">
      <div className="p-4 flex items-center justify-between border-b">
        <h3 className="font-medium">{layerName} Wires & Conductors</h3>
        <div className="flex items-center">
          <Badge variant={getBadgeVariant()} className="ml-2">
            <span>{wires.length}</span>
          </Badge>
          <span className="text-sm ml-1">
            item{wires.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      
      {wires.length > 0 ? (
        <div>
          {categoryOrder.map(category => {
            const categoryWires = wireCategories[category] || [];
            if (categoryWires.length === 0) return null;
            
            return (
              <div key={category} className="mb-4">
                <div className="px-4 py-2 bg-muted/50">
                  <h4 className="text-sm font-medium">{getCategoryName(category)}</h4>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Owner</TableHead>
                      <TableHead className="w-[200px]">Type/Size</TableHead>
                      <TableHead className="w-[120px]">Height</TableHead>
                      <TableHead className="w-[100px]">Tension</TableHead>
                      <TableHead className="w-[80px] text-center">Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryWires.map((wire, index) => {
                      const tensionIssue = hasTensionIssue(wire);
                      
                      return (
                        <TableRow key={wire.id || index}>
                          <TableCell>{wire.owner.id}</TableCell>
                          <TableCell>
                            {wire.type && (
                              <span className="block font-medium">
                                {wire.type}
                              </span>
                            )}
                            {wire.size && (
                              <span className="text-sm text-muted-foreground">
                                Size: {wire.size}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {wire.attachmentHeight ? (
                              <>
                                {metersToFeetInches(wire.attachmentHeight.value)}
                                <span className="text-xs text-muted-foreground block">
                                  ({wire.attachmentHeight.value.toFixed(2)} m)
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Not specified</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {wire.tension !== undefined ? (
                              <span className={tensionIssue ? "text-yellow-600 font-medium" : ""}>
                                {wire.tension.toFixed(0)} lb
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Unknown</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {tensionIssue ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertCircle className="h-4 w-4 text-yellow-600 mx-auto" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Low or missing tension value</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <Check className="h-4 w-4 text-green-500 mx-auto" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-4 text-center text-muted-foreground">
          No wires/conductors found in this layer
        </div>
      )}
    </div>
  );
}
