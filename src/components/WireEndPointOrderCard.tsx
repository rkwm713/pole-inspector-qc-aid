import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QCCheckResult, QCCheckStatus } from "@/types";
import { AlertCircle, Check, HelpCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reorderWireEndPointsForLocation, SPIDAcalcData, Location, Design } from "@/utils/dataCorrections";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface WireEndPointOrderCardProps {
  checkResult?: QCCheckResult;
  poleStructureId: string;
  jsonData?: SPIDAcalcData; 
  onDataUpdate?: (updatedData: SPIDAcalcData) => void;
}

export function WireEndPointOrderCard({ checkResult, poleStructureId, jsonData, onDataUpdate }: WireEndPointOrderCardProps) {
  if (!checkResult || checkResult.status === "NOT_CHECKED") {
    return null; // Don't render anything if we don't have a result
  }

  // Get the status icon based on check status
  const getStatusIcon = (status: QCCheckStatus) => {
    switch (status) {
      case "PASS":
        return <Check className="h-5 w-5 text-green-500" />;
      case "FAIL":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "WARNING":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <HelpCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  // Get badge variant based on status
  const getBadgeVariant = (status: QCCheckStatus) => {
    switch (status) {
      case "PASS":
        return "default";
      case "FAIL":
        return "destructive";
      case "WARNING":
        return "outline";
      default:
        return "secondary";
    }
  };

  // Get status text color class
  const getStatusTextClass = (status: QCCheckStatus) => {
    switch (status) {
      case "PASS":
        return "text-green-600";
      case "FAIL":
        return "text-red-600";
      case "WARNING":
        return "text-yellow-600";
      default:
        return "text-gray-400";
    }
  };

  // Parse the details to extract the proposed and remedy wireEndPoint orders
  const getProposedAndRemedyOrders = (): { proposed: string[], remedy: string[] } => {
    const result = { proposed: [], remedy: [] };
    
    if (!checkResult.details || checkResult.details.length === 0) {
      return result;
    }

    // Look for the specific detail entries that contain the orders
    const proposedDetail = checkResult.details.find(d => d.includes("PROPOSED order:"));
    const remedyDetail = checkResult.details.find(d => d.includes("REMEDY order:"));

    if (proposedDetail) {
      const match = proposedDetail.match(/PROPOSED order: (.+)/);
      if (match && match[1]) {
        result.proposed = match[1].split(", ");
      }
    }

    if (remedyDetail) {
      const match = remedyDetail.match(/REMEDY order: (.+)/);
      if (match && match[1]) {
        result.remedy = match[1].split(", ");
      }
    }

    return result;
  };

  // Get the wireEndPoint orders
  const { proposed, remedy } = getProposedAndRemedyOrders();
  const hasOrderDetail = proposed.length > 0 && remedy.length > 0;

  return (
    <Card className={checkResult.status === "FAIL" ? "border-red-200" : ""}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center">
            {getStatusIcon(checkResult.status)}
            <span className="ml-2">Wire End Point Order Check</span>
          </CardTitle>
          <Badge variant={getBadgeVariant(checkResult.status)}>
            {checkResult.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className={`mb-4 ${getStatusTextClass(checkResult.status)}`}>{checkResult.message}</p>

        {hasOrderDetail && (
          <div className="mb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Layer</TableHead>
                  <TableHead>Wire End Point Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Proposed</TableCell>
                  <TableCell>{proposed.join(", ")}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Remedy</TableCell>
                  <TableCell>{remedy.join(", ")}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}

        {checkResult.details
          .filter(d => !d.includes("PROPOSED order:") && !d.includes("REMEDY order:"))
          .map((detail, index) => (
            <p key={index} className="text-sm mb-1">{detail}</p>
          ))}

        {checkResult.status === "FAIL" && jsonData && onDataUpdate && (
          <div className="mt-4">
            <Button 
              variant="outline"
              size="sm"
              className="w-full flex items-center justify-center"
              onClick={() => {
                // Find the location ID (should be the pole's structureId)
                const locationId = poleStructureId;
                  
                if (locationId) {
                  // Apply reordering
                  const correctedData = reorderWireEndPointsForLocation(jsonData, locationId);
                  // Update the JSON data through the callback
                  onDataUpdate(correctedData);
                }
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Correct Wire End Point Order
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
