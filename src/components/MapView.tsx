import React, { useEffect, useMemo, useState, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap, Tooltip } from "react-leaflet";
import { Pole, WireEndPoint, PoleWire, KmzFiberData } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Check, Upload, MapPin, FileUp } from "lucide-react";
import { metersToFeetInches } from "@/utils/parsers";
import "leaflet/dist/leaflet.css";
import * as omnivore from "leaflet-omnivore";
import L from "leaflet";
import JSZip from "jszip";

// Environment options in the specified order
const ENVIRONMENT_OPTIONS = [
  "Street",
  "Pedestrian",
  "Residential Driveway",
  "None",
  "Alley",
  "AMAFCA Channel",
  "BCPWD Channel",
  "Commercial Driveway",
  "DOT Highway",
  "Farm",
  "MRGCD Channel",
  "Obstructed Parallel To Street",
  "Parallel To Street",
  "Railroad",
  "Rural",
  "Unlikely Parallel To Street"
];

/**
 * Calculate a new coordinate based on a starting coordinate, direction, and distance
 * @param startLat Starting latitude in degrees
 * @param startLng Starting longitude in degrees
 * @param direction Direction in degrees (0 = North, 90 = East, 180 = South, 270 = West)
 * @param distance Distance in meters
 * @returns New coordinate as [latitude, longitude]
 */
function calculateEndpoint(
  startLat: number, 
  startLng: number, 
  direction: number, 
  distance: number
): [number, number] {
  // Earth's radius in meters
  const R = 6378137;
  
  // Convert to radians
  const startLatRad = startLat * Math.PI / 180;
  const startLngRad = startLng * Math.PI / 180;
  const directionRad = direction * Math.PI / 180;
  
  // Calculate angular distance (in radians)
  const angularDistance = distance / R;
  
  // Calculate new latitude
  const newLatRad = Math.asin(
    Math.sin(startLatRad) * Math.cos(angularDistance) +
    Math.cos(startLatRad) * Math.sin(angularDistance) * Math.cos(directionRad)
  );
  
  // Calculate new longitude
  const newLngRad = startLngRad + Math.atan2(
    Math.sin(directionRad) * Math.sin(angularDistance) * Math.cos(startLatRad),
    Math.cos(angularDistance) - Math.sin(startLatRad) * Math.sin(newLatRad)
  );
  
  // Convert back to degrees
  const newLat = newLatRad * 180 / Math.PI;
  const newLng = newLngRad * 180 / Math.PI;
  
  return [newLat, newLng];
}

/**
 * Determine if a WEP is a service drop based on its connected wires
 * @param wep Wire end point object
 * @param wires Map of wire IDs to wire objects
 * @returns Object with isService and isComm flags
 */
function identifyWepType(
  wep: WireEndPoint, 
  wires: Map<string, PoleWire>
): { isService: boolean, isComm: boolean } {
  let isService = false;
  let isComm = false;
  
  // Check each wire connected to this WEP
  for (const wireId of wep.wires) {
    const wire = wires.get(wireId);
    if (!wire) continue;
    
    // Check usageGroup first (most direct indicator)
    if (wire.usageGroup === "UTILITY_SERVICE") {
      isService = true;
    } else if (wire.usageGroup === "COMMUNICATION_SERVICE") {
      isComm = true;
    } 
    // If usageGroup isn't set, check owner
    else if (
      wire.owner.industry === "UTILITY" || 
      wire.owner.id.includes("PNM") || 
      wire.owner.id.includes("Utility")
    ) {
      isService = true;
    } else if (
      wire.owner.industry === "COMMUNICATION" || 
      wire.owner.id.includes("Comcast") || 
      wire.owner.id.includes("Centurylink") || 
      wire.owner.id.includes("Brightspeed")
    ) {
      isComm = true;
    }
    
    // Also check client item descriptions as a fallback
    const clientItemDesc = wire.clientItem?.size || "";
    if (
      clientItemDesc.includes("Triplex") || 
      clientItemDesc.includes("Service")
    ) {
      isService = true;
    } else if (
      clientItemDesc.includes("Coax") || 
      clientItemDesc.includes("TELCO") || 
      clientItemDesc.includes("Drop")
    ) {
      isComm = true;
    }
  }
  
  return { isService, isComm };
}

// Circle marker style constants
const DEFAULT_RADIUS = 6;
const SELECTED_RADIUS = 9;
const DEFAULT_COLOR = "#3388ff";
const SELECTED_COLOR = "#0066cc";
const SERVICE_DROP_COLOR = "#ff9900"; // Orange for service drops
const COMM_DROP_COLOR = "#9900cc";    // Purple for communication drops
const WEP_RADIUS = 4;

// MapController component to handle pan to selected pole without changing zoom
function MapController({ center, initialZoom, preserveZoom = true }: { 
  center: [number, number], 
  initialZoom: number,
  preserveZoom?: boolean 
}) {
  const map = useMap();
  const initializedRef = React.useRef(false);
  
  // Set initial zoom and center on first render
  useEffect(() => {
    // This will only run once to set the initial view
    if (!initializedRef.current) {
      map.setView(center, initialZoom);
      initializedRef.current = true;
    }
  }, [map, center, initialZoom]);

  // Pan to new center when selected pole changes, but preserve zoom level
  useEffect(() => {
    if (initializedRef.current && preserveZoom) {
      // Use flyTo with the current zoom level to prevent zoom changes
      const currentZoom = map.getZoom();
      map.flyTo(center, currentZoom, { duration: 0.5 });
    }
  }, [map, center, preserveZoom]);
  
  return null;
}

interface MapViewProps {
  poles: Pole[];
  selectedPoleId?: string;
  onSelectPole?: (poleId: string) => void;
  onEnvironmentChange?: (poleId: string, wepId: string, layerName: string, newEnvironment: string) => void;
  onKmzDataParsed?: (kmzData: KmzFiberData[]) => void;
  initialZoom?: number; // Added prop for initial zoom level
}

export function MapView({ 
  poles, 
  selectedPoleId, 
  onSelectPole, 
  onEnvironmentChange, 
  onKmzDataParsed,
  initialZoom = 17 
}: MapViewProps) {
  // State to track which WEPs have "Entry Required" or "N/A" checked
  const [entryRequiredMap, setEntryRequiredMap] = useState<Record<string, boolean>>({});
  const [naMap, setNaMap] = useState<Record<string, boolean>>({});
  // State for editing environments
  const [editingEnvironments, setEditingEnvironments] = useState<Record<string, boolean>>({});
  const [environmentValues, setEnvironmentValues] = useState<Record<string, string>>({});
  
  // State for KMZ layer and data viewer
  const [kmzLayer, setKmzLayer] = useState<L.Layer | null>(null);
  const [isKmzLoaded, setIsKmzLoaded] = useState<boolean>(false);
  const [isKmzVisible, setIsKmzVisible] = useState<boolean>(true);
  const [kmzLoadError, setKmzLoadError] = useState<string | null>(null);
  const [kmzFileName, setKmzFileName] = useState<string | null>(null);
  const [kmzFiberData, setKmzFiberData] = useState<KmzFiberData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  
  // Function to toggle the "Entry Required" state for a specific WEP
  const toggleEntryRequired = (wepId: string) => {
    // If Entry Required is being checked, uncheck N/A
    if (!entryRequiredMap[wepId]) {
      setNaMap(prev => ({
        ...prev,
        [wepId]: false
      }));
    }
    
    setEntryRequiredMap(prev => ({
      ...prev,
      [wepId]: !prev[wepId]
    }));
  };
  
  // Function to toggle the "N/A" state for a specific WEP
  const toggleNa = (wepId: string) => {
    // If N/A is being checked, uncheck Entry Required
    if (!naMap[wepId]) {
      setEntryRequiredMap(prev => ({
        ...prev,
        [wepId]: false
      }));
    }
    
    setNaMap(prev => ({
      ...prev,
      [wepId]: !prev[wepId]
    }));
  };
  
  // Filter poles that have coordinates
  const polesWithCoordinates = useMemo(() => 
    poles.filter(pole => pole.coordinates), 
    [poles]
  );
  
  // Find the selected pole
  const selectedPole = useMemo(() => 
    polesWithCoordinates.find(pole => pole.structureId === selectedPoleId),
    [polesWithCoordinates, selectedPoleId]
  );
  
  // Use the selected pole's coordinates as center if available, otherwise use average of all poles
  const mapCenter = useMemo(() => {
    if (selectedPole && selectedPole.coordinates) {
      return [
        selectedPole.coordinates.latitude,
        selectedPole.coordinates.longitude
      ] as [number, number];
    }
    
    return polesWithCoordinates.length > 0
      ? [
          polesWithCoordinates.reduce((sum, pole) => sum + (pole.coordinates?.latitude || 0), 0) / polesWithCoordinates.length,
          polesWithCoordinates.reduce((sum, pole) => sum + (pole.coordinates?.longitude || 0), 0) / polesWithCoordinates.length
        ] as [number, number]
      : [39.8283, -98.5795] as [number, number]; // Center of US as default
  }, [polesWithCoordinates, selectedPole]);
  
  // We no longer automatically calculate zoom level based on pole spread
  // This prevents unwanted zoom changes when interacting with the map

  // Style for the map container
  const mapContainerStyle = {
    height: "100%", 
    width: "100%", 
    borderRadius: "0 0 0.5rem 0.5rem",
    position: "relative"
  } as const;
  
  // Function to handle map instance when it's available
  const handleMapInstance = (map: L.Map) => {
    mapRef.current = map;
  };
  
  // Function to handle KMZ file upload
  const handleKmzFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Reset previous state
    setKmzLoadError(null);
    
    // Store filename for display
    setKmzFileName(file.name);
    
    // Remove existing KMZ layer if it exists
    if (kmzLayer && mapRef.current) {
      mapRef.current.removeLayer(kmzLayer);
      setKmzLayer(null);
      setIsKmzLoaded(false);
    }
    
    // Read the file
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        // Parse KMZ/KML using leaflet-omnivore
        const kmlString = e.target?.result;
        if (typeof kmlString !== 'string' && !(kmlString instanceof ArrayBuffer)) {
          throw new Error('Invalid file content');
        }
        
        if (!mapRef.current) {
          throw new Error('Map not initialized');
        }
        
        let newLayer: L.Layer;
        
        if (file.name.toLowerCase().endsWith('.kmz')) {
          // For KMZ files, use ArrayBuffer and JSZip to extract the KML content
          if (!(kmlString instanceof ArrayBuffer)) {
            throw new Error('Expected ArrayBuffer for KMZ file');
          }
          
          // Use JSZip to extract the KML file from the KMZ (which is a ZIP archive)
          const zip = new JSZip();
          await zip.loadAsync(kmlString);
          
          // Look for doc.kml, the standard main KML file in a KMZ archive
          let kmlContent = null;
          let kmlFilename = null;
          
          // First try to find doc.kml (standard name)
          if (zip.file('doc.kml')) {
            kmlContent = await zip.file('doc.kml').async('string');
            kmlFilename = 'doc.kml';
          } else {
            // If doc.kml doesn't exist, look for any .kml file
            const kmlFiles = Object.keys(zip.files).filter(filename => 
              filename.toLowerCase().endsWith('.kml') && !zip.files[filename].dir
            );
            
            if (kmlFiles.length > 0) {
              kmlFilename = kmlFiles[0];
              kmlContent = await zip.file(kmlFilename).async('string');
            }
          }
          
          if (!kmlContent) {
            throw new Error('No KML file found in the KMZ archive');
          }
          
          // Now parse the extracted KML content
          newLayer = omnivore.kml.parse(kmlContent);
          
        } else {
          // For KML files, use string content
          if (typeof kmlString !== 'string') {
            throw new Error('Expected string content for KML file');
          }
          
          newLayer = omnivore.kml.parse(kmlString);
        }
        
        // Add layer to map
        newLayer.addTo(mapRef.current);
        setKmzLayer(newLayer);
        setIsKmzLoaded(true);
        
        // Extract fiber data from GeoJSON features
        const fiberData: KmzFiberData[] = extractFiberDataFromLayer(newLayer);
        
        // Store locally and pass up to parent component
        setKmzFiberData(fiberData);
        
        // Always call the callback to notify the parent, even if fiberData is empty
        if (onKmzDataParsed) { 
          onKmzDataParsed(fiberData); 
        }
      } catch (error) {
        console.error('Error parsing KMZ/KML file:', error);
        setKmzLoadError(error instanceof Error ? error.message : 'Unknown error parsing file');
      }
    };
    
    reader.onerror = () => {
      setKmzLoadError('Error reading file');
    };
    
    // Read the file as text or ArrayBuffer depending on the file type
    if (file.name.toLowerCase().endsWith('.kmz')) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };
  
  // Helper function to extract value from HTML table content
  const extractFromHtml = (html: string, propName: string): string | null => {
    if (!html || typeof html !== 'string') return null;

    // Check if it's HTML content
    if (!html.includes('<html') && !html.includes('<table')) {
      return null;
    }
    
    try {
      // For HTML table content, look for table cells with the property name
      const pattern = new RegExp(`<td[^>]*>${propName}</td>\\s*<td[^>]*>(.*?)</td>`, 'i');
      const match = html.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch (error) {
      console.error("Error parsing HTML:", error);
    }
    
    return null;
  };

  // Function to extract fiber data from GeoJSON layer
  const extractFiberDataFromLayer = (layer: L.Layer): KmzFiberData[] => {
    const fiberData: KmzFiberData[] = [];
    let featureCount = 0; // Added counter
    console.log("MapView: Starting KMZ fiber data extraction..."); 
    
    // Check if layer has eachLayer method (like a GeoJSON layer)
    if ('eachLayer' in layer) {
      const geoJsonLayer = layer as L.GeoJSON;
      
      geoJsonLayer.eachLayer((featureLayer: L.Layer) => {
        featureCount++; // Increment counter
        if ('feature' in featureLayer) {
          // Define proper types for GeoJSON features
          interface GeoJSONGeometry {
            type: string;
            coordinates: number[] | number[][] | number[][][];
          }
          
          interface GeoJSONProperties {
            description?: string;
            fiber_size?: string;
            fiberSize?: string;
            fiber_count?: number;
            fiberCount?: number;
            pole_id?: string;
            poleId?: string;
            cb_capafo?: string | number;
            owner?: string;
            company?: string;
            [key: string]: unknown;
          }
          
          // Cast to GeoJSON Feature layer with proper types
          const geoLayer = featureLayer as unknown as { 
            feature: { 
              geometry: GeoJSONGeometry; 
              properties: GeoJSONProperties;
            } 
          };
          const feature = geoLayer.feature;
          if (!feature || !feature.geometry || !feature.properties) return;
          
          // Extract coordinates
          let coordinates: { latitude: number; longitude: number } | undefined;
          
          if (feature.geometry.type === 'Point') {
            const coords = feature.geometry.coordinates as number[];
            coordinates = {
              latitude: coords[1],
              longitude: coords[0]
            };
          } else if (feature.geometry.type === 'LineString') {
            // Use first point of linestring
            const lineCoords = feature.geometry.coordinates as number[][];
            if (lineCoords.length > 0) {
              coordinates = {
                latitude: lineCoords[0][1],
                longitude: lineCoords[0][0]
              };
            }
          }
          
          // If coordinates are missing, skip this feature
          if (!coordinates) return;
          
          // Try to extract fiber size and count from properties
          const props = feature.properties;
          let fiberSize = '';
          let fiberCount = 0;
          let poleId: string | undefined;
          let cbCapafo: string | null = null;
          
          // Extract the cb_capafo directly from properties if available
          if (props.cb_capafo !== undefined) {
            cbCapafo = props.cb_capafo?.toString() || null;
          }
          
          // Look for properties that might contain fiber information
          const description = props.description;
          if (description && typeof description === 'string') {
            // Check if the description is HTML content with tables
            if (description.includes('<html') && description.includes('<table')) {
              // Try to extract cb_capafo from HTML table
              const extractedCbCapafo = extractFromHtml(description, "cb_capafo");
              if (extractedCbCapafo) {
                cbCapafo = extractedCbCapafo;
                // Save it to properties for later use
                props.cb_capafo = extractedCbCapafo;
              }
              
              // Try to extract SRO/section info which might help identify Gigapower
              const sro = extractFromHtml(description, "c_sro");
              if (sro) {
                props.c_sro = sro;
              }
              
              // Extract other potential useful fields
              ['cb_nbftth', 'cb_nbftte', 'cb_code', 'cb_section'].forEach(field => {
                const value = extractFromHtml(description, field);
                if (value) {
                  props[field] = value;
                }
              });
            }
            else {
              try {
                // Try to parse description as JSON if it looks like it
                if (description.trim().startsWith('{') && description.trim().endsWith('}')) {
                  const descObj = JSON.parse(description);
                  
                  // Extract cb_capafo from parsed JSON if available
                  if (descObj.cb_capafo !== undefined) {
                    cbCapafo = descObj.cb_capafo?.toString() || null;
                  }
                  
                  // Extract company/owner information if needed
                  if (descObj.company) {
                    props.company = descObj.company;
                  }
                  if (descObj.owner) {
                    props.owner = descObj.owner;
                  }
                }
              } catch {
                // If it's not valid JSON, try regex patterns
                // Try to extract fiber size from description text
                const sizeMatch = description.match(/(\d+)\s*fiber/i);
                if (sizeMatch && sizeMatch[1]) {
                  fiberSize = sizeMatch[1];
                  fiberCount = parseInt(sizeMatch[1], 10);
                }
                
                // Try to extract cb_capafo from description text if not already found
                if (!cbCapafo) {
                  const cbMatch = description.match(/cb_capafo[:\s=]+(\d+)/i);
                  if (cbMatch && cbMatch[1]) {
                    cbCapafo = cbMatch[1];
                  }
                }
                
                // Try to extract pole ID if it exists
                const poleMatch = description.match(/pole[:\s]+([A-Z0-9]+)/i);
                if (poleMatch && poleMatch[1]) {
                  poleId = poleMatch[1];
                }
              }
            }
          }
          
          // Check specific named properties for fiber info
          if (props.fiber_size && typeof props.fiber_size === 'string') {
            fiberSize = props.fiber_size;
          } else if (props.fiberSize && typeof props.fiberSize === 'string') {
            fiberSize = props.fiberSize;
          } else if (cbCapafo) {
            // Use cb_capafo for fiber size if available
            fiberSize = cbCapafo;
            fiberCount = parseInt(cbCapafo, 10) || 0;
          }
          
          if (props.fiber_count && typeof props.fiber_count === 'number') {
            fiberCount = props.fiber_count;
          } else if (props.fiberCount && typeof props.fiberCount === 'number') {
            fiberCount = props.fiberCount;
          }
          
          if (props.pole_id && typeof props.pole_id === 'string') {
            poleId = props.pole_id;
          } else if (props.poleId && typeof props.poleId === 'string') {
            poleId = props.poleId;
          }
          
          // Log extracted properties for debugging
          console.log(`MapView: Extracting feature ${featureCount}:`, { 
            geometryType: feature.geometry.type, 
            hasCoords: !!coordinates, 
            props: props, // Log all properties found
            extractedFiberSize: fiberSize,
            extractedFiberCount: fiberCount,
            extractedPoleId: poleId,
            extractedCbCapafo: cbCapafo
          });

          // Always add to dataset if we have coordinates - we need all possible data for QC
          if (coordinates) {
            // Create a special property to store cb_capafo if it exists
            if (cbCapafo && !props.cb_capafo) {
              props.cb_capafo = cbCapafo;
            }
            
            const extractedData: KmzFiberData = {
              poleId,
              coordinates,
              fiberSize: fiberSize || cbCapafo || '',
              fiberCount: fiberCount || parseInt(cbCapafo || '0', 10) || 0,
              description: props.description,
            };
            fiberData.push(extractedData);
            // console.log("MapView: Added fiber data:", extractedData); // Optional: Log added data
          } else {
            console.log(`MapView: Skipping feature ${featureCount} due to missing coordinates.`);
          }
        } else {
           console.log(`MapView: Skipping layer ${featureCount}, does not have 'feature' property.`);
        }
      });
    } else {
      console.log("MapView: KMZ layer does not have 'eachLayer' method.");
    }
    
    console.log(`MapView: Finished KMZ extraction. Found ${fiberData.length} features with fiber data out of ${featureCount} total features.`);
    return fiberData;
  };
  
  // Function to trigger file input click
  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <>
      <Card className="w-full h-[400px]">
        <CardHeader className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CardTitle className="text-lg">Pole Locations</CardTitle>
            
              {/* KMZ layer toggle button (only if KMZ is loaded) */}
              {isKmzLoaded && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsKmzVisible(!isKmzVisible);
                    if (kmzLayer && mapRef.current) {
                      if (isKmzVisible) {
                        mapRef.current.removeLayer(kmzLayer);
                      } else {
                        kmzLayer.addTo(mapRef.current);
                      }
                    }
                  }}
                  className="text-xs flex items-center gap-1"
                >
                  {isKmzVisible ? 'Hide KML Layer' : 'Show KML Layer'}
                </Button>
              )}
          </div>
          
          {/* KMZ upload button - hidden but keep it for functionality */}
          <div className="flex items-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleKmzFileUpload}
              accept=".kml,.kmz"
              className="hidden"
              id="map-kmz-file-upload"
            />
          </div>
          
          {/* Environment status summary indicator */}
          {polesWithCoordinates.length > 0 && (
            <div className="flex items-center">
              <div className="text-xs text-gray-500 mr-2">Environment Check:</div>
              <div className="flex items-center gap-1">
                {(() => {
                  // Count WEPs with various statuses across all poles
                  let neCount = 0;
                  let entryRequiredCount = 0;
                  let naCount = 0;
                  let totalWeps = 0;
                  
                  // Generate list of all WEP IDs for counting
                  const wepIds: string[] = [];
                  
                  polesWithCoordinates.forEach(pole => {
                    Object.values(pole.layers).forEach(layer => {
                      if (layer.wireEndPoints) {
                        totalWeps += layer.wireEndPoints.length;
                        layer.wireEndPoints.forEach(wep => {
                          if (wep.environmentStatus === 'NE') {
                            neCount++;
                            
                            // Generate a consistent ID for each WEP for status tracking
                            const wepId = wep.id || `wep-${wep.direction}-${wep.distance.value}`;
                            wepIds.push(wepId);
                            
                            // Count how many are marked as Entry Required or N/A
                            if (entryRequiredMap[wepId]) {
                              entryRequiredCount++;
                            } else if (naMap[wepId]) {
                              naCount++;
                            }
                          }
                        });
                      }
                    });
                  });
                  
                  const remainingToReview = neCount - entryRequiredCount - naCount;
                  
                  return (
                    <div className="flex items-center gap-2">
                      {neCount > 0 ? (
                        <>
                          <div className="bg-red-100 text-red-600 text-xs font-medium px-2 py-0.5 rounded-md">
                            {neCount} NE
                          </div>
                          
                          {/* Only show the review stats if there are NE environments */}
                          <div className="flex gap-1">
                            {remainingToReview > 0 && (
                              <div className="bg-orange-100 text-orange-600 text-xs font-medium px-2 py-0.5 rounded-md">
                                {remainingToReview} To Review
                              </div>
                            )}
                            
                            {entryRequiredCount > 0 && (
                              <div className="bg-blue-100 text-blue-600 text-xs font-medium px-2 py-0.5 rounded-md">
                                {entryRequiredCount} Required
                              </div>
                            )}
                            
                            {naCount > 0 && (
                              <div className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-md">
                                {naCount} N/A
                              </div>
                            )}
                          </div>
                        </>
                      ) : totalWeps > 0 ? (
                        <div className="bg-green-100 text-green-600 text-xs font-medium px-2 py-0.5 rounded-md">
                          All Entered
                        </div>
                      ) : (
                        <div className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-md">
                          No WEPs
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 h-[340px]">
        {polesWithCoordinates.length > 0 ? (
          <MapContainer 
            center={mapCenter} 
            zoom={initialZoom} 
            style={mapContainerStyle}
            zoomControl={true}
            ref={(map) => map && handleMapInstance(map)}
          >
            <MapController center={mapCenter} initialZoom={initialZoom} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {polesWithCoordinates.map((pole) => {
              // Determine if this pole is selected
              const isSelected = pole.structureId === selectedPoleId;
              
              // Pre-compute pole center coordinates for easier reference
              const poleCoords: [number, number] = [
                pole.coordinates?.latitude || 0,
                pole.coordinates?.longitude || 0
              ];
              
              // Create a map of wire IDs to wire objects for this pole
              const wireMap = new Map<string, PoleWire>();
              
              // Collect all WEPs across all layers and their corresponding end coordinates
              const wepEndpoints: {
                wep: WireEndPoint;
                coords: [number, number];
                isServiceDrop: boolean;
                isCommDrop: boolean;
              }[] = [];
              
              // Process the pole's layers for WEPs
              Object.values(pole.layers).forEach(layer => {
                // Add wires to the wire map
                if (layer.wires) {
                  layer.wires.forEach(wire => {
                    if (wire.id) {
                      wireMap.set(wire.id, wire);
                    }
                  });
                }
                
                // Process wire endpoints if they exist
                if (layer.wireEndPoints) {
                  layer.wireEndPoints.forEach(wep => {
                    // Skip if no distance or direction data
                    if (!wep.distance?.value || wep.direction === undefined) return;
                    
                    // Calculate the coordinates of the WEP based on distance and direction
                    const wepCoords = calculateEndpoint(
                      poleCoords[0],
                      poleCoords[1],
                      wep.direction,
                      wep.distance.value
                    );
                    
                    // Determine if this is a service or communication drop
                    const { isService, isComm } = identifyWepType(wep, wireMap);
                    
                    // Save all WEPs (not just service/comm drops)
                    wepEndpoints.push({
                      wep,
                      coords: wepCoords,
                      isServiceDrop: isService,
                      isCommDrop: isComm
                    });
                  });
                }
              });
              
              return (
                <React.Fragment key={pole.structureId}>
                  {/* Render the pole marker */}
                  <CircleMarker 
                    center={poleCoords}
                    radius={isSelected ? SELECTED_RADIUS : DEFAULT_RADIUS}
                    pathOptions={{
                      fillColor: isSelected ? SELECTED_COLOR : DEFAULT_COLOR,
                      color: isSelected ? "#004c99" : "#2778e2",
                      weight: 1,
                      fillOpacity: 0.8
                    }}
                    eventHandlers={{
                      click: () => onSelectPole && onSelectPole(pole.structureId)
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -20]} opacity={0.9}>
                      <div className="text-sm font-medium">
                        {pole.structureId}
                        {pole.qcResults && (
                          <span className={`ml-2 ${
                            pole.qcResults.overallStatus === "PASS" ? "text-green-600" : 
                            pole.qcResults.overallStatus === "FAIL" ? "text-red-600" : 
                            pole.qcResults.overallStatus === "WARNING" ? "text-yellow-600" : ""
                          }`}>
                            • {pole.qcResults.overallStatus}
                          </span>
                        )}
                      </div>
                    </Tooltip>
                    <Popup>
                      <div className="pole-popup">
                        <h3 className="text-lg font-bold mb-1">Pole: {pole.structureId}</h3>
                        {pole.alias && <div className="text-sm mb-2">Alias: {pole.alias}</div>}
                        <div className="text-xs mb-2">
                          Coordinates: {pole.coordinates?.latitude.toFixed(6)}, {pole.coordinates?.longitude.toFixed(6)}
                        </div>
                        
                        <div className="text-sm mt-2">
                          <strong>Layers:</strong> {Object.keys(pole.layers).join(", ")}
                        </div>
                        
                        {/* Show additional information if available */}
                        {pole.qcResults && (
                          <div className="text-sm mt-2">
                            <strong>QC Status:</strong> <span className={`font-medium ${
                              pole.qcResults.overallStatus === "PASS" ? "text-green-600" : 
                              pole.qcResults.overallStatus === "FAIL" ? "text-red-600" : 
                              pole.qcResults.overallStatus === "WARNING" ? "text-yellow-600" : ""
                            }`}>{pole.qcResults.overallStatus}</span>
                          </div>
                        )}
                        
                        <div className="text-xs mt-3 text-blue-600 cursor-pointer" 
                          onClick={() => onSelectPole && onSelectPole(pole.structureId)}>
                          Click to view full details
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                  
                  {/* Render WEP markers and lines */}
                  {wepEndpoints.map((endpoint, index) => {
                    const isService = endpoint.isServiceDrop;
                    const isComm = endpoint.isCommDrop;
                    const color = isService ? SERVICE_DROP_COLOR : isComm ? COMM_DROP_COLOR : "#999999";
                    
                    return (
                      <React.Fragment key={`wep-${pole.structureId}-${index}`}>
                        {/* Line from pole to WEP */}
                        <Polyline 
                          positions={[poleCoords, endpoint.coords]} 
                          pathOptions={{
                            color: color,
                            weight: 1.5,
                            dashArray: isComm ? '5, 5' : undefined // Dashed for comm drops
                          }}
                        />
                        
                        {/* WEP marker */}
                        <CircleMarker 
                          center={endpoint.coords}
                          radius={endpoint.wep.environmentStatus === 'NE' ? WEP_RADIUS + 1 : WEP_RADIUS}
                          pathOptions={{
                            fillColor: color,
                            color: endpoint.wep.environmentStatus === 'NE' ? '#dc2626' : '#555555',
                            weight: endpoint.wep.environmentStatus === 'NE' ? 2 : 1,
                            fillOpacity: 0.8
                          }}
                        >
                        <Tooltip direction="top" offset={[0, -5]} opacity={0.9}>
                          <div className="text-xs">
                            <strong>{isService ? 'Service Drop' : isComm ? 'Comm Drop' : 'Wire End Point'}</strong>
                            {endpoint.wep.environmentStatus === 'NE' && (
                              <span className="bg-red-100 text-red-600 font-bold px-1 ml-1 rounded">NE</span>
                            )}
                            <br/>
                            Distance: {metersToFeetInches(endpoint.wep.distance.value)}<br/>
                            Direction: {endpoint.wep.direction.toFixed(0)}°
                            {endpoint.wep.environment && (
                              <><br/>Environment: {endpoint.wep.environment}</>
                            )}
                            
                            {/* Show status in tooltip if marked */}
                            {endpoint.wep.environmentStatus === 'NE' && (
                              <>
                                {entryRequiredMap[endpoint.wep.id || `wep-${index}`] && (
                                  <div className="mt-1 bg-blue-50 text-blue-600 text-xs px-1 py-0.5 rounded">
                                    Marked: Entry Required
                                  </div>
                                )}
                                {naMap[endpoint.wep.id || `wep-${index}`] && (
                                  <div className="mt-1 bg-gray-50 text-gray-600 text-xs px-1 py-0.5 rounded">
                                    Marked: N/A
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </Tooltip>
                        
                        <Popup>
                          <div className="wep-popup">
                            <h3 className="text-sm font-bold mb-1">
                              {endpoint.wep.id || "WEP"}
                              {endpoint.wep.environmentStatus === 'NE' && (
                                <span className="bg-red-100 text-red-600 font-bold px-1 ml-1 rounded">NE</span>
                              )}
                            </h3>
                            <div className="text-xs mb-1">
                              Type: {isService ? 'Service Drop' : isComm ? 'Comm Drop' : endpoint.wep.type || 'Other'}
                            </div>
                            <div className="text-xs mb-1">
                              Distance: {metersToFeetInches(endpoint.wep.distance.value)}
                              <span className="text-xs text-muted-foreground block">
                                ({endpoint.wep.distance.value.toFixed(2)} m)
                              </span>
                            </div>
                            <div className="text-xs mb-1">
                              Direction: {endpoint.wep.direction.toFixed(0)}°
                            </div>
                            
                            {/* Environment information with edit capability */}
                            <div className="text-xs mb-1">
                              <div className="font-semibold mt-2 mb-1">Environment:</div>
                              {editingEnvironments[endpoint.wep.id || `wep-${index}`] ? (
                                <div className="mt-1">
                                  <Select
                                    value={environmentValues[endpoint.wep.id || `wep-${index}`] || ''}
                                    onValueChange={(value) => {
                                      // Save the environment value immediately
                                      setEnvironmentValues(prev => ({
                                        ...prev,
                                        [endpoint.wep.id || `wep-${index}`]: value
                                      }));
                                      
                                      // Find the layer name for this WEP
                                      if (onEnvironmentChange) {
                                        let layerName = '';
                                        Object.entries(pole.layers).forEach(([name, layer]) => {
                                          if (layer.wireEndPoints?.some(wep => wep.id === endpoint.wep.id)) {
                                            layerName = name;
                                          }
                                        });
                                        
                                        if (layerName) {
                                          onEnvironmentChange(
                                            pole.structureId,
                                            endpoint.wep.id || `wep-${index}`,
                                            layerName,
                                            value
                                          );
                                        }
                                      }
                                      
                                      // Exit edit mode after selection
                                      setEditingEnvironments(prev => ({
                                        ...prev,
                                        [endpoint.wep.id || `wep-${index}`]: false
                                      }));
                                    }}
                                  >
                                    <SelectTrigger className="h-6 text-xs">
                                      <SelectValue placeholder="Select environment" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ENVIRONMENT_OPTIONS.map((option) => (
                                        <SelectItem key={option} value={option} className="text-xs">
                                          {option}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : (
                                <div 
                                  className="cursor-pointer hover:bg-slate-50 p-1 rounded"
                                  onClick={() => {
                                    // Initialize the current value
                                    setEnvironmentValues(prev => ({
                                      ...prev,
                                      [endpoint.wep.id || `wep-${index}`]: endpoint.wep.environment || ''
                                    }));
                                    
                                    // Enter edit mode
                                    setEditingEnvironments(prev => ({
                                      ...prev,
                                      [endpoint.wep.id || `wep-${index}`]: true
                                    }));
                                  }}
                                >
                                  {endpoint.wep.environment ? endpoint.wep.environment : (
                                    <span className="text-muted-foreground">None (click to edit)</span>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {/* Checkboxes for NE status */}
                            {endpoint.wep.environmentStatus === 'NE' && (
                              <div className="mt-2 flex flex-col gap-1">
                                <div className="flex items-center">
                                  <input 
                                    type="checkbox" 
                                    id={`entry-required-${endpoint.wep.id || index}`}
                                    className="mr-1"
                                    checked={entryRequiredMap[endpoint.wep.id || `wep-${index}`] || false}
                                    onChange={() => toggleEntryRequired(endpoint.wep.id || `wep-${index}`)}
                                  />
                                  <label 
                                    htmlFor={`entry-required-${endpoint.wep.id || index}`}
                                    className="text-xs font-medium"
                                  >
                                    Entry Required?
                                  </label>
                                </div>
                                <div className="flex items-center">
                                  <input 
                                    type="checkbox" 
                                    id={`na-${endpoint.wep.id || index}`}
                                    className="mr-1"
                                    checked={naMap[endpoint.wep.id || `wep-${index}`] || false}
                                    onChange={() => toggleNa(endpoint.wep.id || `wep-${index}`)}
                                  />
                                  <label 
                                    htmlFor={`na-${endpoint.wep.id || index}`}
                                    className="text-xs font-medium"
                                  >
                                    N/A (e.g., residential backyard)
                                  </label>
                                </div>
                              </div>
                            )}
                          </div>
                        </Popup>
                        </CircleMarker>
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </MapContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            No pole location data available
          </div>
        )}
        </CardContent>
      </Card>
      
    </>
  );
}
