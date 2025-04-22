
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, FileText, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface FileUploadProps {
  onFileLoaded: (data: any) => void;
  isLoading: boolean;
}

export function FileUpload({ onFileLoaded, isLoading }: FileUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError(null);
    
    if (!file) return;
    
    // Accept any file but warn if not .json
    if (!file.name.endsWith('.json')) {
      toast.warning("This appears to not be a JSON file. Processing will be attempted, but may fail.");
    }
    
    setFileName(file.name);
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Log the structure of the uploaded file for debugging
      console.log("File structure:", {
        hasLeads: !!data.leads,
        hasLocations: !!data.locations,
        hasPoles: !!data.poles,
        hasClientData: !!data.clientData,
        leadCount: data.leads?.length,
        locationCount: data.locations?.length,
        poleCount: data.poles?.length,
      });
      
      // Check if we have any recognizable structure
      if (!data.leads && !data.locations && !data.poles && !data.clientData) {
        const errorMessage = "The file doesn't contain any recognizable pole data structure. Please check the file contents.";
        setError(errorMessage);
        toast.error(errorMessage);
        return;
      }
      
      onFileLoaded(data);
    } catch (err) {
      const errorMessage = "Unable to process the file. Please ensure it's a valid JSON file.";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("File parsing error:", err);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-center">Upload File</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div 
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 w-full text-center cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => document.getElementById('file-upload')?.click()}
        >
          <input
            id="file-upload"
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
            disabled={isLoading}
          />
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-sm font-medium">
            {fileName ? fileName : "Click to upload or drag and drop"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Upload your pole data file to begin analysis
          </p>
        </div>
        
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          disabled={!fileName || isLoading}
          onClick={() => document.getElementById('file-upload')?.click()}
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </span>
          ) : (
            <span className="flex items-center">
              <FileText className="mr-2 h-4 w-4" />
              {fileName ? "Upload Different File" : "Upload File"}
            </span>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
