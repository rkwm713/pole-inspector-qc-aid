import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap, Tooltip } from "react-leaflet";
import { Pole, WireEndPoint, PoleWire } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Check } from "lucide-react";
import { metersToFeetInches } from "@/utils/parsers";
import "leaflet/dist/leaflet.css";

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
  initialZoom?: number; // Added prop for initial zoom level
}

export function MapView({ poles, selectedPoleId, onSelectPole, onEnvironmentChange, initialZoom = 17 }: MapViewProps) {
  // State to track which WEPs have "Entry Required" or "N/A" checked
  const [entryRequiredMap, setEntryRequiredMap] = useState<Record<string, boolean>>({});
  const [naMap, setNaMap] = useState<Record<string, boolean>>({});
  // State for editing environments
  const [editingEnvironments, setEditingEnvironments] = useState<Record<string, boolean>>({});
  const [environmentValues, setEnvironmentValues] = useState<Record<string, string>>({});
  
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
  
  return (
    <Card className="w-full h-[400px]">
      <CardHeader className="p-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Pole Locations</CardTitle>
          
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
  );
}
