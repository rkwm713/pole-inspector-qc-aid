
# SPIDAcalc QC Assistant

## Overview
SPIDAcalc QC Assistant is a web application designed to streamline the quality control process for electrical pole structure data. It allows users to upload SPIDAcalc JSON files, parses the data, and presents it in an organized, easy-to-read format alongside a map visualization of pole locations.

## Key Features
- **File Upload**: Simple drag-and-drop interface for SPIDAcalc JSON files
- **Data Extraction**: Parses JSON to extract pole structures and attachments
- **Layer Organization**: Separates data by design layers (Existing, Proposed, Remedy)
- **Unit Conversion**: Automatically converts metric measurements to imperial units
- **Validation Checks**: Performs basic validation on attachment data
- **Map Visualization**: Displays pole locations on an interactive map
- **Responsive Design**: Works well on various screen sizes

## How to Use
1. **Upload a File**: Drag and drop a SPIDAcalc JSON file or click to browse
2. **Review Data**: Once uploaded, the application will parse and display the data
3. **Navigate Poles**: Select poles from the list or the map to view details
4. **Examine Layers**: Switch between Existing, Proposed, and Remedy layers to see attachments
5. **Check Validation**: Review validation indicators for potential issues

## Development
This project is built with:
- React
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Leaflet for maps

## Sample Data
The application includes a sample SPIDAcalc JSON file in the public directory for testing.

## Project Structure
- `/src/components`: UI components
- `/src/utils`: Utility functions for parsing and validation
- `/src/types`: TypeScript interfaces
- `/public`: Static assets including sample data

## Getting Started
```
npm install
npm run dev
```

Visit `http://localhost:8080` to see the application running.
