import React from 'react';
import { DesignComparisonResults, SpanComparisonResult, WireChange, PoleWire } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertTriangle, ArrowRight, CheckCircle, MinusCircle, PlusCircle } from 'lucide-react';

interface SpanComparisonTableProps {
  results: DesignComparisonResults;
}

// Helper to format wire details
const formatWire = (wire: PoleWire | undefined): string => {
  if (!wire) return 'N/A';
  const owner = wire.owner?.id || 'Unknown Owner';
  const type = wire.clientItem?.type || wire.type || 'Unknown Type';
  const size = wire.clientItem?.size || wire.size || 'Unknown Size';
  const height = wire.attachmentHeight?.value?.toFixed(2) ?? 'N/A';
  return `${owner} - ${type} ${size} @ ${height}ft`; // Assuming height is in feet or converted
};

// Helper to render wire changes
const renderWireChanges = (changes: WireChange[]) => {
  if (changes.length === 0) {
    return <TableCell className="text-xs text-muted-foreground">No changes</TableCell>;
  }
  return (
    <TableCell>
      <ul className="list-none p-0 m-0 space-y-1">
        {changes.map((change, index) => (
          <li key={index} className="text-xs flex items-start gap-1">
            {change.type === 'ADDED' && <PlusCircle className="h-3 w-3 text-green-600 flex-shrink-0 mt-0.5" />}
            {change.type === 'REMOVED' && <MinusCircle className="h-3 w-3 text-red-600 flex-shrink-0 mt-0.5" />}
            {change.type === 'MODIFIED' && <AlertTriangle className="h-3 w-3 text-yellow-600 flex-shrink-0 mt-0.5" />}
            <span>
              {formatWire(change.wire)}
              {change.type === 'MODIFIED' && change.changeDetails && (
                <span className="text-muted-foreground ml-1">({change.changeDetails.join(', ')})</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </TableCell>
  );
};

export const SpanComparisonTable: React.FC<SpanComparisonTableProps> = ({ results }) => {
  if (!results || !results.spanResults || results.spanResults.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Span Comparison</CardTitle>
          <CardDescription>Proposed vs. Remedy Layer Span Analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No span comparison results available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Span Comparison</CardTitle>
        <CardDescription>{results.comparisonDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {results.spanResults.map((spanResult, index) => (
            <AccordionItem value={`span-${index}`} key={`span-${index}`}>
              <AccordionTrigger className="text-sm hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-2">
                     {spanResult.spanStatus === 'MATCHED' && <CheckCircle className="h-4 w-4 text-green-600" />}
                     {spanResult.spanStatus === 'ADDED_IN_REMEDY' && <PlusCircle className="h-4 w-4 text-blue-600" />}
                     {spanResult.spanStatus === 'REMOVED_IN_REMEDY' && <MinusCircle className="h-4 w-4 text-red-600" />}
                    <span className="font-medium">{spanResult.poleA_Id}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{spanResult.poleB_Id}</span>
                  </div>
                  <Badge variant={
                    spanResult.spanStatus === 'MATCHED' ? 'default' :
                    spanResult.spanStatus === 'ADDED_IN_REMEDY' ? 'outline' : 'destructive'
                  } className="text-xs">
                    {spanResult.spanStatus.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Pole</TableHead>
                      <TableHead>Wire Changes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium text-xs">{spanResult.poleA_Id}</TableCell>
                      {renderWireChanges(spanResult.changesAtPoleA)}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-xs">{spanResult.poleB_Id}</TableCell>
                      {renderWireChanges(spanResult.changesAtPoleB)}
                    </TableRow>
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
};
