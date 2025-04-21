
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { Pole } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default marker icons in React-Leaflet
// This is needed because the default icon paths are not properly resolved in the build
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = defaultIcon;

interface MapViewProps {
  poles: Pole[];
  selectedPoleId?: string;
  onSelectPole?: (poleId: string) => void;
}

export function MapView({ poles, selectedPoleId, onSelectPole }: MapViewProps) {
  // Filter poles that have coordinates
  const polesWithCoordinates = poles.filter(pole => pole.coordinates);
  
  // Calculate center of the map based on pole coordinates or use default
  const mapCenter = polesWithCoordinates.length > 0
    ? [
        polesWithCoordinates.reduce((sum, pole) => sum + (pole.coordinates?.latitude || 0), 0) / polesWithCoordinates.length,
        polesWithCoordinates.reduce((sum, pole) => sum + (pole.coordinates?.longitude || 0), 0) / polesWithCoordinates.length
      ] as [number, number]
    : [39.8283, -98.5795] as [number, number]; // Center of US as default
  
  return (
    <Card className="w-full h-[400px]">
      <CardHeader className="p-4">
        <CardTitle className="text-lg">Pole Locations</CardTitle>
      </CardHeader>
      <CardContent className="p-0 h-[340px]">
        {polesWithCoordinates.length > 0 ? (
          <MapContainer 
            center={mapCenter} 
            zoom={polesWithCoordinates.length > 1 ? 10 : 13} 
            style={{ height: "100%", width: "100%", borderRadius: "0 0 0.5rem 0.5rem" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {polesWithCoordinates.map((pole) => (
              <Marker 
                key={pole.structureId}
                position={[pole.coordinates?.latitude || 0, pole.coordinates?.longitude || 0]}
                eventHandlers={{
                  click: () => onSelectPole && onSelectPole(pole.structureId)
                }}
              >
                <Popup>
                  <div>
                    <strong>ID: {pole.structureId}</strong>
                    {pole.alias && <div>Alias: {pole.alias}</div>}
                    <div>
                      Layers: {Object.keys(pole.layers).join(", ")}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
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
