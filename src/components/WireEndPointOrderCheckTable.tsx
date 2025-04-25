import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface WireEndPointOrderCheckTableProps {
  summary: Array<{ locationLabel: string; status: string; message?: string }>;
}

export const WireEndPointOrderCheckTable: React.FC<WireEndPointOrderCheckTableProps> = ({ summary }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wire End Point Order Check</CardTitle>
        <CardDescription>
          Checks and corrects the order of Wire End Points in the Remedy design layer to match the Proposed layer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {summary && summary.length > 0 ? (
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.locationLabel}</TableCell>
                    <TableCell>{item.status}</TableCell>
                    <TableCell>{item.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center p-4 text-muted-foreground">
            No wire end point order check results available.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
