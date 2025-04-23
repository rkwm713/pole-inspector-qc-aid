import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClearanceResult } from "@/types";
import { AlertCircle, Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ClearanceResultsTableProps {
  clearanceResults: ClearanceResult[];
  layerName: string;
}

export function ClearanceResultsTable({ clearanceResults, layerName }: ClearanceResultsTableProps) {
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

  // Get row class based on pass/fail status
  const getRowClass = (status: string): string => {
    switch (status) {
      case "PASSING":
        return "";
      case "FAILING":
        return "bg-red-50";
      default:
        return "bg-yellow-50";
    }
  };

  // Count passing and failing clearances
  const passingCount = clearanceResults.filter(result => result.status === "PASSING").length;
  const failingCount = clearanceResults.filter(result => result.status === "FAILING").length;

  return (
    <div className="rounded-md border">
      <div className="p-4 flex items-center justify-between border-b">
        <h3 className="font-medium">{layerName} Clearance Results</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <Badge variant="secondary" className="ml-2">
              <span>{passingCount}</span>
            </Badge>
            <span className="text-sm ml-1 text-green-600">
              Passing
            </span>
          </div>
          <div className="flex items-center">
            <Badge variant="destructive" className="ml-2">
              <span>{failingCount}</span>
            </Badge>
            <span className="text-sm ml-1 text-red-600">
              Failing
            </span>
          </div>
        </div>
      </div>
      
      {clearanceResults.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Rule Name</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[120px]">Actual Distance</TableHead>
              <TableHead className="w-[120px]">Required Distance</TableHead>
              <TableHead className="w-[80px] text-center">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clearanceResults.map((result, index) => (
              <TableRow key={result.id || index} className={getRowClass(result.status)}>
                <TableCell className="font-medium">
                  {result.clearanceRuleName}
                </TableCell>
                <TableCell>
                  {result.status === "PASSING" ? (
                    <span className="inline-flex items-center text-green-600">
                      <Check className="h-3 w-3 mr-1" /> Pass
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-red-600">
                      <AlertCircle className="h-3 w-3 mr-1" /> Fail
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {result.actualDistance !== undefined ? (
                    <span className={result.status === "FAILING" ? "text-red-600 font-medium" : ""}>
                      {result.actualDistance.toFixed(2)} {result.distance?.unit}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Unknown</span>
                  )}
                </TableCell>
                <TableCell>
                  {result.requiredDistance !== undefined ? (
                    <span>
                      {result.requiredDistance.toFixed(2)} {result.required?.unit}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Unknown</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {result.failingDetails ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertCircle className="h-4 w-4 text-red-500 mx-auto" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{result.failingDetails}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="p-4 text-center text-muted-foreground">
          No clearance results found in this layer
        </div>
      )}
    </div>
  );
}
