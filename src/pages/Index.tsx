
import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import { Results } from "@/components/Results";
import { Pole, ProjectInfo, ParsedData } from "@/types";
import { extractPoleData, validatePoleData } from "@/utils/parsers";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [poles, setPoles] = useState<Pole[]>([]);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({});
  const [fileUploaded, setFileUploaded] = useState(false);
  const [originalJsonData, setOriginalJsonData] = useState<Record<string, unknown> | undefined>(undefined);

  const handleFileLoaded = async (jsonData: Record<string, unknown>) => {
    setIsProcessing(true);
    
    try {
      // Store the original JSON data for later use when saving changes
      setOriginalJsonData(jsonData);
      
      // Extract pole data and project info from the JSON
      const parsedData = extractPoleData(jsonData);
      
      // Store project info separately
      setProjectInfo(parsedData.projectInfo);
      
      // Validate the extracted data with the project info
      const validatedPoles = validatePoleData(parsedData);
      
      // Update state with the processed poles
      setPoles(validatedPoles);
      setFileUploaded(true);
    } catch (err) {
      console.error("Error processing file:", err);
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
