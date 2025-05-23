import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QCResults, QCCheckResult, QCCheckStatus, Pole } from "@/types";
import { AlertCircle, AlertTriangle, Check, ExternalLink, HelpCircle, RefreshCw } from "lucide-react";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { reorderWireEndPointsForLocation, SPIDAcalcData, Location, Design } from "@/utils/dataCorrections";

interface QCResultsCardProps {
  results?: QCResults;
  jsonData?: SPIDAcalcData; // The full JSON data object
  onDataUpdate?: (updatedData: SPIDAcalcData) => void; // Callback to update the JSON data
}

export function QCResultsCard({ results, jsonData, onDataUpdate }: QCResultsCardProps) {
  if (!results) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quality Control Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">
            QC checks have not been performed
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get the status icon based on check status
  const getStatusIcon = (status: QCCheckStatus) => {
    switch (status) {
      case "PASS":
        return <Check className="h-4 w-4 text-green-500" />;
      case "FAIL":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "WARNING":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "NOT_CHECKED":
      default:
        return <HelpCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  // Get the status text and class based on check status
  const getStatusInfo = (status: QCCheckStatus): { text: string; className: string } => {
    switch (status) {
      case "PASS":
        return { text: "PASS", className: "text-green-600" };
      case "FAIL":
        return { text: "FAIL", className: "text-red-600" };
      case "WARNING":
        return { text: "WARNING", className: "text-yellow-600" };
      case "NOT_CHECKED":
      default:
        return { text: "NOT CHECKED", className: "text-gray-400" };
    }
  };

  // Convert a check key to a display name
  const getCheckName = (key: string): string => {
    switch (key) {
      case "ownerCheck": return "Owner Consistency";
      case "anchorCheck": return "Anchor & Guy Wire Specifications";
      case "poleSpecCheck": return "Pole Specifications";
      case "assemblyUnitsCheck": return "Assembly Units";
      case "glcCheck": return "Ground-Line Circumference";
      case "poleOrderCheck": return "Pole Order";
      case "tensionCheck": return "Wire Tensions";
      case "attachmentSpecCheck": return "Attachment Specifications";
      case "heightCheck": return "Attachment Heights";
      case "specFileCheck": return "PNM Spec File";
      case "clearanceCheck": return "Clearance Checks";
      // New checks
      case "layerComparisonCheck": return "Layer-to-Layer Owner/Usage Changes";
      case "poleStressCheck": return "Pole Stress Change";
      case "stationNameCheck": return "Station Name Format";
      case "loadCaseCheck": return "Load Case Verification";
      case "projectSettingsCheck": return "Project Settings Completeness";
      case "messengerSizeCheck": return "Messenger Size Verification";
      case "wireEndPointOrderCheck": return "Wire End Point Order";
      case "fiberSizeCheck": return "Fiber Size Verification";
      default: return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }
  };

  // Get ordered list of checks (excluding wireEndPointOrderCheck which will be displayed separately)
  const orderedChecks = [
    // Original checks
    { key: "ownerCheck" as keyof QCResults, result: results.ownerCheck },
    { key: "poleSpecCheck" as keyof QCResults, result: results.poleSpecCheck },
    { key: "glcCheck" as keyof QCResults, result: results.glcCheck },
    { key: "anchorCheck" as keyof QCResults, result: results.anchorCheck },
    { key: "assemblyUnitsCheck" as keyof QCResults, result: results.assemblyUnitsCheck },
    { key: "tensionCheck" as keyof QCResults, result: results.tensionCheck },
    { key: "attachmentSpecCheck" as keyof QCResults, result: results.attachmentSpecCheck },
    { key: "clearanceCheck" as keyof QCResults, result: results.clearanceCheck },
    { key: "poleOrderCheck" as keyof QCResults, result: results.poleOrderCheck },
    { key: "heightCheck" as keyof QCResults, result: results.heightCheck },
    { key: "specFileCheck" as keyof QCResults, result: results.specFileCheck },
    // New checks
    { key: "layerComparisonCheck" as keyof QCResults, result: results.layerComparisonCheck },
    { key: "poleStressCheck" as keyof QCResults, result: results.poleStressCheck },
    { key: "stationNameCheck" as keyof QCResults, result: results.stationNameCheck },
    { key: "loadCaseCheck" as keyof QCResults, result: results.loadCaseCheck },
    { key: "projectSettingsCheck" as keyof QCResults, result: results.projectSettingsCheck },
    { key: "messengerSizeCheck" as keyof QCResults, result: results.messengerSizeCheck },
    { key: "fiberSizeCheck" as keyof QCResults, result: results.fiberSizeCheck },
  ].filter(check => check.result && check.result.status !== "NOT_CHECKED");

  // Sort checks by status (FAIL first, then WARNING, then PASS)
  const statusPriority: Record<QCCheckStatus, number> = {
    "FAIL": 0,
    "WARNING": 1,
    "PASS": 2,
    "NOT_CHECKED": 3
  };

  orderedChecks.sort((a, b) => 
    statusPriority[a.result.status] - statusPriority[b.result.status]
  );

  const { text: overallStatusText, className: overallStatusClass } = getStatusInfo(results.overallStatus);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Quality Control Results</CardTitle>
          <div className="flex items-center space-x-2">
            <Badge 
              variant={results.failCount > 0 ? "destructive" : 
                     (results.warningCount > 0 ? "outline" : "default")}
            >
              <span className="mr-1">Status:</span>
              <span className={overallStatusClass}>{overallStatusText}</span>
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between text-sm mb-4">
          <div className="flex items-center">
            <Check className="h-4 w-4 text-green-500 mr-1.5" />
            <span>Passed: {results.passCount}</span>
          </div>
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mr-1.5" />
            <span>Warnings: {results.warningCount}</span>
          </div>
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-red-500 mr-1.5" />
            <span>Failed: {results.failCount}</span>
          </div>
        </div>

        {orderedChecks.length > 0 ? (
          <Accordion type="multiple" className="w-full">
            {orderedChecks.map(({ key, result }) => {
              const { className: statusClass } = getStatusInfo(result.status);
              
              return (
                <AccordionItem key={key} value={key}>
                  <AccordionTrigger className="py-2">
                    <div className="flex items-center text-left">
                      <div className="mr-2">{getStatusIcon(result.status)}</div>
                    <div>
                      <span className="font-medium">{getCheckName(key)}</span>
                      <p className={`text-xs ${statusClass}`}>{result.message}</p>
                    </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {result.details.length > 0 ? (
                      <div className="space-y-3">
                        <ul className="list-disc pl-6 space-y-1 text-sm">
                          {result.details.map((detail, index) => (
                            <li key={index}>{detail}</li>
                          ))}
                        </ul>
                        
                        {/* Add "Correct Order" button for wireEndPoint order mismatches */}
                        {key === "wireEndPointOrderCheck" && 
                         result.status === "FAIL" && 
                         jsonData && 
                         onDataUpdate && (
                          <div className="mt-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="flex items-center space-x-1"
                              onClick={() => {
                                // Find the location with wireEndPoint order mismatch from details
                                const locationDetail = result.details.find(d => d.includes("PROPOSED order"));
                                if (locationDetail) {
                                  // Location ID would be in the pole.structureId
                                const locationId = jsonData.leads?.[0]?.locations?.find(
                                  (loc: Location) => loc.designs?.some(
                                    (d: Design) => d.label === "Proposed" && d.structure?.wireEndPoints
                                  )
                                )?.label;
                                  
                                  if (locationId) {
                                    // Apply reordering
                                    const correctedData = reorderWireEndPointsForLocation(jsonData, locationId);
                                    // Update the JSON data through the callback
                                    onDataUpdate(correctedData);
                                  }
                                }
                              }}
                            >
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Correct Wire End Point Order
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No additional details available.</p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : (
          <div className="text-center text-muted-foreground py-4">
            No QC checks have been performed
          </div>
        )}
      </CardContent>
    </Card>
  );
}
