
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PoleAttachment } from "@/types";
import { metersToFeetInches } from "@/utils/parsers";
import { safeDisplayValue } from "@/utils/formatting";
import { Check, X } from "lucide-react";

interface AttachmentTableProps {
  attachments: PoleAttachment[];
  layerName: string;
}

export function AttachmentTable({ attachments, layerName }: AttachmentTableProps) {
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

  return (
    <div className="rounded-md border">
      <div className="p-4 flex items-center justify-between border-b">
        <h3 className="font-medium">{layerName} Attachments</h3>
        <Badge variant={getBadgeVariant()}>
          {attachments.length} item{attachments.length !== 1 ? 's' : ''}
        </Badge>
      </div>
      
      {attachments.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Description</TableHead>
              <TableHead className="w-[150px]">Owner</TableHead>
              <TableHead className="w-[120px]">Height</TableHead>
              <TableHead className="w-[150px]">Assembly Unit</TableHead>
              <TableHead className="w-[80px] text-center">Valid</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attachments.map((attachment, index) => (
              <TableRow key={attachment.id || index}>
                <TableCell className="font-medium">{safeDisplayValue(attachment.description)}</TableCell>
                <TableCell>{safeDisplayValue(attachment.owner)}</TableCell>
                <TableCell>
                  {metersToFeetInches(attachment.height.value)}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({attachment.height.value.toFixed(2)} m)
                  </span>
                </TableCell>
                <TableCell>{safeDisplayValue(attachment.assemblyUnit)}</TableCell>
                <TableCell className="text-center">
                  {attachment.isValid !== undefined ? (
                    attachment.isValid ? (
                      <Check className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-red-500 mx-auto" />
                    )
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="p-4 text-center text-muted-foreground">
          No attachments found in this layer
        </div>
      )}
    </div>
  );
}
