
import { useState, useEffect, useCallback } from "react";
import { FileUpload } from "@/components/FileUpload";
import { Results } from "@/components/Results";
import { Pole, ProjectInfo, ParsedData, KmzFiberData, DesignComparisonResults, PoleLayer } from "@/types"; // Added DesignComparisonResults, PoleLayer
import { extractPoleData, validatePoleData } from "@/utils/parsers";
import { compareDesigns } from "@/utils/comparisonUtils"; // Import the comparison function
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [poles, setPoles] = useState<Pole[]>([]);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({});
  const [fileUploaded, setFileUploaded] = useState(false);
  const [originalJsonData, setOriginalJsonData] = useState<Record<string, unknown> | undefined>(undefined);
  const [kmzFiberData, setKmzFiberData] = useState<KmzFiberData[]>([]);
  const [designComparisonResults, setDesignComparisonResults] = useState<DesignComparisonResults | null>(null); // State for comparison results

  // Memoize validation logic to prevent unnecessary runs if dependencies don't change
  const runValidation = useCallback((currentPoles: Pole[], currentProjectInfo: ProjectInfo, currentKmzData: KmzFiberData[]) => {
    if (currentPoles.length === 0) return currentPoles; // No poles to validate

    const dataToValidate: ParsedData = { poles: currentPoles, projectInfo: currentProjectInfo };
    // Pass KMZ data only if it exists
    const validated = validatePoleData(dataToValidate, currentKmzData.length > 0 ? currentKmzData : undefined);
    return validated;
  }, []); // Dependencies are passed explicitly

  // Revalidate poles when KMZ data changes
  useEffect(() => {
    // Skip validation if no poles or no KMZ data
    if (poles.length === 0 || kmzFiberData.length === 0) return;

    console.log("Revalidating poles due to KMZ data change...");
    const revalidatedPoles = runValidation(poles, projectInfo, kmzFiberData);
    setPoles(revalidatedPoles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kmzFiberData]); // Only re-run when KMZ data changes (runValidation is stable)


  const handleFileLoaded = async (jsonData: Record<string, unknown>) => {
    setIsProcessing(true);
    setDesignComparisonResults(null); // Reset comparison results on new file load

    try {
      // Store the original JSON data
      setOriginalJsonData(jsonData);

      // Extract pole data and project info
      const parsedData = extractPoleData(jsonData);
      setProjectInfo(parsedData.projectInfo); // Store project info

      // Initial validation (without KMZ data initially)
      const validatedPoles = runValidation(parsedData.poles, parsedData.projectInfo, []);
      setPoles(validatedPoles); // Update state with initially validated poles

      // --- Perform Design Comparison ---
      // Check if both Proposed and Remedy layers exist in the data
      const hasProposed = validatedPoles.some(p => p.layers['Proposed']);
      const hasRemedy = validatedPoles.some(p => p.layers['Remedy']);

      if (hasProposed && hasRemedy) {
        console.log("Found Proposed and Remedy layers, performing comparison...");
        // Create temporary ParsedData structures for comparison function
        const createLayerSpecificData = (layerName: string): ParsedData => ({
          projectInfo: parsedData.projectInfo,
          poles: validatedPoles
            .filter(p => p.layers[layerName]) // Only include poles that have this layer
            .map(p => ({
              ...p,
              // Keep only the specific layer for this structure
              layers: { [layerName]: p.layers[layerName] } as Record<string, PoleLayer>
            }))
        });

        const proposedLayerData = createLayerSpecificData('Proposed');
        const remedyLayerData = createLayerSpecificData('Remedy');

        // Run the comparison
        const comparisonResults = compareDesigns(proposedLayerData, remedyLayerData);
        setDesignComparisonResults(comparisonResults);
        console.log("Comparison complete:", comparisonResults);
      } else {
        console.log("Proposed and/or Remedy layers not found. Skipping comparison.");
      }
      // --- End Design Comparison ---


      setFileUploaded(true);
    } catch (err) {
      console.error("Error processing file:", err);
      // TODO: Add user-facing error message
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow border-b border-slate-200">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SPIDAcalc QC Assistant</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Quality Control Tools for PNM Pole Inspections
              </p>
            </div>
            <div className="mt-2 md:mt-0 flex items-center space-x-2">
              <Badge variant="outline" className="text-sm px-3 py-1">
                PNM Specifications
              </Badge>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {!fileUploaded ? (
          <div className="flex items-center justify-center py-10">
            <FileUpload onFileLoaded={handleFileLoaded} isLoading={isProcessing} />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Analysis Results</h2>
              <button
                onClick={() => setFileUploaded(false)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Upload Different File
              </button>
            </div>
            
            <Separator />
            
            <Results
              poles={poles}
              originalJsonData={originalJsonData}
              kmzFiberData={kmzFiberData}
              onKmzDataParsed={setKmzFiberData}
              designComparisonResults={designComparisonResults} // Pass comparison results
            />
          </div>
        )}
      </main>
      
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-500">
              SPIDAcalc QC Assistant - A tool for quality control of pole analysis data
            </p>
            <p className="text-sm text-gray-500 mt-2 md:mt-0">
              <span className="font-medium">PNM Utility Specifications</span> - <span className="italic">v1.0.0</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
