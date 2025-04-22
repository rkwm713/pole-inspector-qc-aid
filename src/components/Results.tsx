
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pole, ValidationResults } from "@/types";
import { PoleDetails } from "./PoleDetails";
import { MapView } from "./MapView";

interface ResultsProps {
  poles: Pole[];
  validationResults?: ValidationResults;
}

export function Results({ poles, validationResults }: ResultsProps) {
  const [selectedPoleId, setSelectedPoleId] = useState<string | undefined>(
    poles.length > 0 ? poles[0].structureId : undefined
  );

  const handlePoleSelect = (poleId: string) => {
    setSelectedPoleId(poleId);
  };

  // Get the currently selected pole object
  const selectedPole = poles.find(pole => pole.structureId === selectedPoleId);

  // Helper function to safely display any value as a string
  const safeDisplayValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    return typeof value === 'string' ? value : JSON.stringify(value);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Pole Selection</CardTitle>
              <CardDescription>
                {poles.length} pole{poles.length !== 1 ? 's' : ''} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] overflow-y-auto">
                {poles.map((pole) => (
                  <div
                    key={pole.structureId}
                    className={`p-3 border-b cursor-pointer transition-colors ${
                      selectedPoleId === pole.structureId
                        ? "bg-muted"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => handlePoleSelect(pole.structureId)}
                  >
                    <div className="font-medium">{pole.structureId}</div>
                    {pole.alias && (
                      <div className="text-sm text-muted-foreground">
                        Alias: {safeDisplayValue(pole.alias)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <MapView
            poles={poles}
            selectedPoleId={selectedPoleId}
            onSelectPole={handlePoleSelect}
          />
        </div>
      </div>

      {selectedPole && (
        <div className="mt-6">
          <PoleDetails pole={selectedPole} />
        </div>
      )}
    </div>
  );
}
