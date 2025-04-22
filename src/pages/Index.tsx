
import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import { Results } from "@/components/Results";
import { Pole } from "@/types";
import { extractPoleData, validatePoleData } from "@/utils/parsers";
import { Separator } from "@/components/ui/separator";

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [poles, setPoles] = useState<Pole[]>([]);
  const [fileUploaded, setFileUploaded] = useState(false);

  const handleFileLoaded = async (jsonData: any) => {
    setIsProcessing(true);
    
    try {
      // Extract pole data from the JSON
      const extractedPoles = extractPoleData(jsonData);
      
      // Validate the extracted data
      const validatedPoles = validatePoleData(extractedPoles);
      
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">SPIDAcalc QC Assistant</h1>
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
            
            <Results poles={poles} />
          </div>
        )}
      </main>
      
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            SPIDAcalc QC Assistant - A tool for quality control of pole analysis data
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
