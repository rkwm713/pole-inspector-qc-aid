
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PoleAttachment } from "@/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AttachmentTableProps {
  attachments: PoleAttachment[];
  layerName: string;
}

export function AttachmentTable({ attachments, layerName }: AttachmentTableProps) {
  // State to track ordered attachments by category
  const [orderedAttachments, setOrderedAttachments] = useState<Record<string, PoleAttachment[]>>({});

  // Initialize ordered attachments when component mounts or attachments change
  useEffect(() => {
    // Create a copy of categorized attachments
    const categorized: Record<string, PoleAttachment[]> = {};
    attachments.forEach(attachment => {
      const type = attachment.attachmentType || "OTHER";
      if (!categorized[type]) categorized[type] = [];
      categorized[type].push(attachment);
    });
    setOrderedAttachments(categorized);
  }, [attachments]);

  // Function to move an attachment up within its category
  const moveAttachmentUp = (type: string, index: number) => {
    if (index === 0) return; // Already at the top
    
    const newOrderedAttachments = { ...orderedAttachments };
    const category = [...newOrderedAttachments[type]];
    
    // Swap with the item above
    [category[index - 1], category[index]] = [category[index], category[index - 1]];
    
    newOrderedAttachments[type] = category;
    setOrderedAttachments(newOrderedAttachments);
  };

  // Function to move an attachment down within its category
  const moveAttachmentDown = (type: string, index: number) => {
    if (!orderedAttachments[type] || index >= orderedAttachments[type].length - 1) return; // Already at the bottom
    
    const newOrderedAttachments = { ...orderedAttachments };
    const category = [...newOrderedAttachments[type]];
    
    // Swap with the item below
    [category[index], category[index + 1]] = [category[index + 1], category[index]];
    
    newOrderedAttachments[type] = category;
    setOrderedAttachments(newOrderedAttachments);
  };

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

  // Categorize attachments by type
  const categorizedAttachments = attachments.reduce<Record<string, PoleAttachment[]>>((acc, attachment) => {
    const type = attachment.attachmentType || "OTHER";
    if (!acc[type]) acc[type] = [];
    acc[type].push(attachment);
    return acc;
  }, {});

  // Order of attachment types to display
  const typeOrder = ["POWER", "COMMUNICATION", "EQUIPMENT", "INSULATOR", "GUY", "ANCHOR", "OTHER"];

  // Get display name for attachment type
  const getTypeName = (type: string): string => {
    switch (type) {
      case "POWER": return "Power Attachments";
      case "COMMUNICATION": return "Communication Attachments";
      case "EQUIPMENT": return "Equipment";
      case "INSULATOR": return "Insulators";
      case "GUY": return "Guy Wires";
      case "ANCHOR": return "Anchors";
      case "OTHER": return "Other Attachments";
      default: return `${type} Attachments`;
    }
  };

  return (
    <div className="rounded-md border">
      <div className="p-4 flex items-center justify-between border-b">
        <h3 className="font-medium">{layerName} Attachments</h3>
        <div className="flex items-center">
          <Badge variant={getBadgeVariant()} className="ml-2">
            <span>{attachments.length}</span>
          </Badge>
          <span className="text-sm ml-1">
            item{attachments.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      
      {attachments.length > 0 ? (
        <div>
          {typeOrder.map(type => {
            const typeAttachments = categorizedAttachments[type] || [];
            if (typeAttachments.length === 0) return null;
            
            return (
              <div key={type} className="mb-4">
                <div className="px-4 py-2 bg-muted/50">
                  <h4 className="text-sm font-medium">{getTypeName(type)}</h4>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead className="w-[180px]">Description</TableHead>
                      <TableHead className="w-[120px]">Owner</TableHead>
                      <TableHead className="w-[100px]">Height</TableHead>
                      <TableHead className="w-[100px]">Assembly Unit</TableHead>
                      {type === "ANCHOR" && <TableHead className="w-[80px]">Bearing</TableHead>}
                      {type === "GUY" && <TableHead className="w-[80px]">Size</TableHead>}
                      <TableHead className="w-[80px] text-center">Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(orderedAttachments[type] || typeAttachments).map((attachment, index) => (
                      <TableRow key={attachment.id || index}>
                        <TableCell className="p-0 w-[40px]">
                          <div className="flex flex-col space-y-1 items-center justify-center py-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => moveAttachmentUp(type, index)}
                              disabled={index === 0}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost" 
                              className="h-6 w-6"
                              onClick={() => moveAttachmentDown(type, index)}
                              disabled={index === (orderedAttachments[type]?.length || 0) - 1}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {attachment.clientItemAlias || attachment.description}
                          {attachment.model && (
                            <span className="text-xs block text-muted-foreground">
                              Model: {attachment.model}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{attachment.owner.id}</TableCell>
                        <TableCell>
                          {attachment.heightInFeet || "-"}
                          <span className="text-xs text-muted-foreground block">
                            ({attachment.height.value.toFixed(2)} m)
                          </span>
                        </TableCell>
                        <TableCell>{attachment.assemblyUnit}</TableCell>
                        {type === "ANCHOR" && (
                          <TableCell>
                            {attachment.bearing !== undefined 
                              ? `${attachment.bearing}°` 
                              : <span className="text-red-500">Missing</span>
                            }
                          </TableCell>
                        )}
                        {type === "GUY" && (
                          <TableCell>
                            {attachment.size || "Unknown"}
                          </TableCell>
                        )}
                        <TableCell className="text-center">
                          {attachment.qcIssues && attachment.qcIssues.length > 0 ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertCircle className="h-4 w-4 text-red-500 mx-auto" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="max-w-xs">
                                    <p className="font-medium mb-1">Issues:</p>
                                    <ul className="list-disc pl-4 text-sm">
                                      {attachment.qcIssues.map((issue, i) => (
                                        <li key={i}>{issue}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-4 text-center text-muted-foreground">
          No attachments found in this layer
        </div>
      )}
    </div>
  );
}
