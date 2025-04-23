
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, FileText, InfoIcon, Upload, Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface FileUploadProps {
  onFileLoaded: (data: Record<string, unknown>) => void;
  isLoading: boolean;
}

export function FileUpload({ onFileLoaded, isLoading }: FileUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [validateStatus, setValidateStatus] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
  
  // Function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError(null);
    setValidateStatus("idle");
    
    if (!file) return;
    
    if (!file.name.endsWith('.json')) {
      setError("Please upload a valid JSON file");
      return;
    }
    
    setFileName(file.name);
    setFileSize(formatFileSize(file.size));
    setValidateStatus("validating");
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Basic validation to see if it looks like a SPIDAcalc file
      if (!data.leads && !data.poles) {
        setValidateStatus("invalid");
        setError("This doesn't appear to be a valid SPIDAcalc JSON file. Please check that you're uploading the correct file.");
        return;
      }
      
      setValidateStatus("valid");
      onFileLoaded(data);
    } catch (err) {
      setValidateStatus("invalid");
      setError("Failed to parse the JSON file. Please check the file format.");
      console.error("File parsing error:", err);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-center">Upload SPIDAcalc File</CardTitle>
        <CardDescription className="text-center">
          Upload a SPIDAcalc JSON file to analyze pole designs
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div 
          className="border-2 border-dashed border-slate-300 rounded-lg p-8 w-full text-center cursor-pointer hover:bg-slate-50 transition-colors"
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
          <Upload className="mx-auto h-12 w-12 text-slate-400 mb-4" />
          <p className="text-sm font-medium">
            {fileName ? fileName : "Click to upload or drag and drop"}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            SPIDAcalc JSON files only
          </p>
          
          {fileSize && (
            <Badge variant="outline" className="mt-2">
              {fileSize}
            </Badge>
          )}
        </div>
        
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {fileName && !error && (
          <Alert className={validateStatus === "valid" ? "bg-green-50 border-green-200 text-green-800 mt-4" : "mt-4"}>
            {validateStatus === "validating" ? (
              <>
                <InfoIcon className="h-4 w-4 text-blue-500" />
                <AlertTitle>Validating File</AlertTitle>
                <AlertDescription>Analyzing SPIDAcalc format...</AlertDescription>
              </>
            ) : validateStatus === "valid" ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertTitle>Valid SPIDAcalc File</AlertTitle>
                <AlertDescription>File format appears to be correct.</AlertDescription>
              </>
            ) : null}
          </Alert>
        )}
        
        <div className="w-full mt-6 bg-muted/20 rounded-lg p-4">
          <div className="flex items-center">
            <Zap className="text-amber-500 h-5 w-5 mr-2" />
            <h3 className="text-sm font-medium">Load Example Data</h3>
          </div>
          <Separator className="my-2" />
          <p className="text-xs text-muted-foreground mb-2">
            Don't have a SPIDAcalc file? Use our sample data to explore the application features.
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-xs"
            disabled={isLoading}
            onClick={() => {
              // This would load the sample data directly from your public folder
              fetch('/sample-spidacalc-data.json')
                .then(response => response.json())
                .then(data => {
                  setFileName('sample-spidacalc-data.json');
                  setValidateStatus("valid");
                  onFileLoaded(data);
                })
                .catch(error => {
                  console.error('Error loading sample data:', error);
                  setError('Failed to load sample data.');
                });
            }}
          >
            Load Sample Data
          </Button>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          disabled={!fileName || isLoading || validateStatus === "invalid"}
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
