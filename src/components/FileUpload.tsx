import React, { useCallback, useState } from 'react';
import { Upload, Download, FileText, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import Papa from 'papaparse';
import { InputData } from '../types';

interface FileUploadProps {
  onDataLoaded: (data: InputData[]) => void;
  isProcessing?: boolean;
}

const REQUIRED_COLUMNS = [
  'Asset Class Type ID',
  'Location ID', 
  'Location Name',
  'Maintainable Item Name',
  'Component Name',
  'Failure Mechanism',
  'Failure Cause'
];

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, isProcessing = false }) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const downloadTemplate = () => {
    const csvContent = REQUIRED_COLUMNS.join(',') + '\n' +
      'CRGY,ABC-001,Power Plant Unit 1,Blower Fan,Casing,Wear,Dust Ingress\n' +
      'CRGY,ABC-002,Power Plant Unit 2,Motor,Bearing,Corrosion,Moisture Ingress\n' +
      'ELEC,DEF-001,Electrical Substation,Transformer,Winding,Overheating,Overload';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SAP_Catalog_Profile_Template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const validateColumns = (headers: string[]): boolean => {
    const normalizedHeaders = headers.map(h => h.trim());
    return REQUIRED_COLUMNS.every(col => normalizedHeaders.includes(col));
  };

  const processFile = useCallback((file: File) => {
    setError(null);
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          if (results.errors.length > 0) {
            setError(`CSV parsing error: ${results.errors[0].message}`);
            return;
          }

          const headers = Object.keys(results.data[0] as object);
          
          if (!validateColumns(headers)) {
            setError(`Invalid file format. Required columns: ${REQUIRED_COLUMNS.join(', ')}`);
            return;
          }

          const data: InputData[] = (results.data as any[]).map((row, index) => ({
            assetClassTypeId: row['Asset Class Type ID']?.trim() || '',
            locationId: row['Location ID']?.trim() || '',
            locationName: row['Location Name']?.trim() || '',
            maintainableItemName: row['Maintainable Item Name']?.trim() || '',
            componentName: row['Component Name']?.trim() || '',
            failureMechanism: row['Failure Mechanism']?.trim() || '',
            failureCause: row['Failure Cause']?.trim() || ''
          })).filter(row => 
            row.assetClassTypeId && 
            row.locationId && 
            row.locationName &&
            row.maintainableItemName &&
            row.componentName &&
            row.failureMechanism &&
            row.failureCause
          );

          if (data.length === 0) {
            setError('No valid data rows found in the file');
            return;
          }

          onDataLoaded(data);
        } catch (err) {
          setError(`Error processing file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      },
      error: (error) => {
        setError(`File reading error: ${error.message}`);
      }
    });
  }, [onDataLoaded]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        processFile(file);
      } else {
        setError('Please upload a CSV file');
      }
    }
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        processFile(file);
      } else {
        setError('Please upload a CSV file');
      }
    }
  }, [processFile]);

  return (
    <div className="space-y-6">
      {/* Template Download */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download Template
          </CardTitle>
          <CardDescription>
            Download the CSV template with the required column structure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={downloadTemplate} variant="outline" className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download SAP Catalog Profile Template
          </Button>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Data File
          </CardTitle>
          <CardDescription>
            Upload your CSV file with failure modes data to begin processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <div className="space-y-2">
              <p className="text-lg font-medium">
                {dragActive ? 'Drop your CSV file here' : 'Drag and drop your CSV file here'}
              </p>
              <p className="text-sm text-gray-500">or</p>
              <div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileInput}
                  className="hidden"
                  id="file-upload"
                  disabled={isProcessing}
                />
                <label htmlFor="file-upload">
                  <Button variant="outline" className="cursor-pointer" disabled={isProcessing}>
                    <Upload className="h-4 w-4 mr-2" />
                    Choose File
                  </Button>
                </label>
              </div>
            </div>
            
            {fileName && (
              <div className="mt-4 p-3 bg-green-50 rounded-md">
                <p className="text-sm text-green-700">
                  <FileText className="h-4 w-4 inline mr-1" />
                  {fileName} uploaded successfully
                </p>
              </div>
            )}
          </div>

          {error && (
            <Alert className="mt-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="mt-4 text-sm text-gray-600">
            <p className="font-medium mb-2">Required columns:</p>
            <ul className="list-disc list-inside space-y-1">
              {REQUIRED_COLUMNS.map(col => (
                <li key={col}>{col}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};