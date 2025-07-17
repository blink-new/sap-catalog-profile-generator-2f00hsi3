import React, { useState, useEffect } from 'react';
import { Toaster } from './components/ui/toaster';
import { useToast } from './hooks/use-toast';
import { NotificationDisplay } from './components/NotificationDisplay';
import { blink } from './blink/client';
import { FileUpload } from './components/FileUpload';
import { StepProgress } from './components/StepProgress';
import { QAConflictModal } from './components/QAConflictModal';
import { DataTable } from './components/DataTable';
import { Dashboard } from './components/Dashboard';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Settings, Database, Zap, Brain, Download } from 'lucide-react';
import { 
  InputData, 
  ProcessingSession, 
  QAConflict,
  SAPCatalogLoadsheet,
  DamageCodeLibrary,
  CauseCodeLibrary,
  ComponentCodeLibrary
} from './types';
import {
  saveProcessingSession,
  loadProcessingSessions,
  loadDamageCodeLibrary,
  loadCauseCodeLibrary,
  loadComponentCodeLibrary,
  saveDamageCodeLibrary,
  saveCauseCodeLibrary,
  saveComponentCodeLibrary
} from './utils/dataStorage';
import {
  processStep1,
  processStep2,
  processStep3,
  processStep4,
  processStep5,
  processStep6,
  processStep7,
  processStep8,
  processStep9,
  processStep10,
  processFinalLoadSheet
} from './utils/stepProcessors';
import { testAllModels, testAPIConnection, getModelStatus } from './utils/aiCodeGeneration';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentSession, setCurrentSession] = useState<ProcessingSession | null>(null);
  const [inputData, setInputData] = useState<InputData[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [qaConflicts, setQaConflicts] = useState<QAConflict[]>([]);
  const [showQAModal, setShowQAModal] = useState(false);
  const [finalData, setFinalData] = useState<SAPCatalogLoadsheet[]>([]);
  const [stepData, setStepData] = useState<any>({});
  const [showDashboard, setShowDashboard] = useState(true);
  const { toast } = useToast();

  // Authentication
  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user);
      setLoading(state.isLoading);
    });
    return unsubscribe;
  }, []);

  // Load existing sessions
  useEffect(() => {
    if (user) {
      const sessions = loadProcessingSessions();
      const userSessions = sessions.filter(s => s.id.includes(user.id));
      if (userSessions.length > 0) {
        // Load the most recent session
        const latestSession = userSessions.sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0];
        setCurrentSession(latestSession);
        setCurrentStep(latestSession.currentStep);
        setInputData(latestSession.inputData);
      }
    }
  }, [user]);

  const handleDataLoaded = (data: InputData[]) => {
    setInputData(data);
    setShowDashboard(false);
    
    // Create new processing session
    const session: ProcessingSession = {
      id: `session_${user.id}_${Date.now()}`,
      sessionName: `Processing ${new Date().toLocaleDateString()}`,
      currentStep: 1,
      totalSteps: 10,
      status: 'in_progress',
      inputData: data,
      qaConflicts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setCurrentSession(session);
    saveProcessingSession(session);
    
    toast({
      title: "Data Loaded Successfully",
      description: `${data.length} records loaded and ready for processing`
    });
  };

  const handleStartNewSession = () => {
    setShowDashboard(false);
    setInputData([]);
    setCurrentStep(1);
    setFinalData([]);
    setStepData({});
    setCurrentSession(null);
  };

  const handleLoadSession = (session: ProcessingSession) => {
    setCurrentSession(session);
    setInputData(session.inputData);
    setCurrentStep(session.currentStep);
    setShowDashboard(false);
    
    toast({
      title: "Session Loaded",
      description: `Loaded session: ${session.sessionName}`
    });
  };

  const handleBackToDashboard = () => {
    setShowDashboard(true);
  };

  const processAllSteps = async () => {
    if (!inputData.length || !currentSession) return;
    
    setIsProcessing(true);
    setCurrentStep(1);
    
    try {
      // Step 1: Catalog Profile Coding and Naming
      toast({ title: "Processing Step 1", description: "Catalog Profile Coding and Naming" });
      const step1Data = processStep1(inputData);
      setStepData(prev => ({ ...prev, step1: step1Data }));
      setCurrentStep(2);
      
      // Step 2: Object Part Grouping
      toast({ title: "Processing Step 2", description: "Object Part Grouping" });
      const step2Data = processStep2(inputData, step1Data);
      setStepData(prev => ({ ...prev, step2: step2Data }));
      setCurrentStep(3);
      
      // Step 3: Damage Code Library
      toast({ title: "Processing Step 3", description: "Damage Code Library with QA checks" });
      const existingDamageLibrary = loadDamageCodeLibrary();
      const step3Result = await processStep3(inputData, existingDamageLibrary);
      
      if (step3Result.conflicts.length > 0) {
        setQaConflicts(step3Result.conflicts);
        setShowQAModal(true);
        setIsProcessing(false);
        return;
      }
      
      saveDamageCodeLibrary(step3Result.library);
      setStepData(prev => ({ ...prev, step3: step3Result.library }));
      setCurrentStep(4);
      
      // Step 4: Cause Code Library
      toast({ title: "Processing Step 4", description: "Cause Code Library with QA checks" });
      const existingCauseLibrary = loadCauseCodeLibrary();
      const step4Result = await processStep4(inputData, existingCauseLibrary);
      
      if (step4Result.conflicts.length > 0) {
        setQaConflicts(step4Result.conflicts);
        setShowQAModal(true);
        setIsProcessing(false);
        return;
      }
      
      saveCauseCodeLibrary(step4Result.library);
      setStepData(prev => ({ ...prev, step4: step4Result.library }));
      setCurrentStep(5);
      
      // Continue with remaining steps...
      await continueProcessing(step1Data, step2Data, step3Result.library, step4Result.library);
      
    } catch (error) {
      console.error('Processing error:', error);
      toast({
        title: "Processing Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  };

  const continueProcessing = async (
    step1Data: any,
    step2Data: any,
    damageLibrary: DamageCodeLibrary[],
    causeLibrary: CauseCodeLibrary[]
  ) => {
    try {
      // Step 5: Failure Set Check
      toast({ title: "Processing Step 5", description: "Failure Set Check" });
      const step5Data = processStep5(inputData, damageLibrary, causeLibrary);
      setStepData(prev => ({ ...prev, step5: step5Data }));
      setCurrentStep(6);
      
      // Step 6: Component Code Library
      toast({ title: "Processing Step 6", description: "Component Code Library with AI generation" });
      const existingComponentLibrary = loadComponentCodeLibrary();
      const step6Result = await processStep6(step5Data, existingComponentLibrary);
      
      saveComponentCodeLibrary(step6Result.library);
      setStepData(prev => ({ ...prev, step6: step6Result.library }));
      setCurrentStep(7);
      
      // Step 7: Code Allocations
      toast({ title: "Processing Step 7", description: "OP&D&C Code Allocations" });
      const step7Data = processStep7(step5Data, damageLibrary, causeLibrary, step6Result.library);
      setStepData(prev => ({ ...prev, step7: step7Data }));
      setCurrentStep(8);
      
      // Step 8: B Catalog
      toast({ title: "Processing Step 8", description: "B Catalog" });
      const step8Data = processStep8(step7Data, step2Data);
      setStepData(prev => ({ ...prev, step8: step8Data }));
      setCurrentStep(9);
      
      // Step 9: C Catalog
      toast({ title: "Processing Step 9", description: "C Catalog" });
      const step9Data = processStep9(step7Data);
      setStepData(prev => ({ ...prev, step9: step9Data }));
      setCurrentStep(10);
      
      // Step 10: 5 Catalog
      toast({ title: "Processing Step 10", description: "5 Catalog" });
      const step10Data = processStep10(step7Data);
      setStepData(prev => ({ ...prev, step10: step10Data }));
      
      // Final Load Sheet
      toast({ title: "Generating Final Load Sheet", description: "SAP Catalog Profile Loadsheet" });
      const finalLoadSheet = processFinalLoadSheet(step1Data, step8Data, step9Data, step10Data);
      setFinalData(finalLoadSheet);
      
      // Update session
      if (currentSession) {
        const updatedSession = {
          ...currentSession,
          currentStep: 11,
          status: 'completed' as const,
          updatedAt: new Date().toISOString()
        };
        setCurrentSession(updatedSession);
        saveProcessingSession(updatedSession);
      }
      
      setCurrentStep(11);
      setIsProcessing(false);
      
      toast({
        title: "Processing Complete!",
        description: `Generated ${finalLoadSheet.length} SAP catalog profile entries`
      });
      
    } catch (error) {
      console.error('Processing error:', error);
      toast({
        title: "Processing Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  };

  const handleQAResolution = async (resolutions: Array<{
    conflictId: string;
    resolution: 'accept' | 'reject' | 'custom';
    selectedMatch?: string;
    customValue?: string;
  }>) => {
    // Apply QA resolutions and continue processing
    setShowQAModal(false);
    setQaConflicts([]);
    
    // Update libraries based on resolutions
    const damageLibrary = loadDamageCodeLibrary();
    const causeLibrary = loadCauseCodeLibrary();
    
    // Continue processing from where we left off
    if (currentStep === 3) {
      await continueProcessing(stepData.step1, stepData.step2, damageLibrary, causeLibrary);
    }
  };

  const exportFinalData = (format: 'csv' | 'xlsx') => {
    const headers = [
      'Location ID',
      'Catalog Profile', 
      'Catalog Profile Description',
      'Catalog',
      'Code Group',
      'Code Group Description',
      'Code',
      'Code Description'
    ];
    
    const csvContent = headers.join(',') + '\n' +
      finalData.map(row => [
        row.locationId,
        row.catalogProfile,
        row.catalogProfileDescription,
        row.catalog,
        row.codeGroup,
        row.codeGroupDescription,
        row.code,
        row.codeDescription
      ].map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SAP_Catalog_Profile_Loadsheet.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const testAIModels = async () => {
    toast({ title: "Testing AI Models", description: "Testing API connection and comparing performance..." });
    
    try {
      // First test API connection
      const connectionTest = await testAPIConnection();
      
      if (!connectionTest.success) {
        toast({
          title: "API Connection Failed",
          description: connectionTest.message,
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "API Connection Successful",
        description: "Now testing all models..."
      });
      
      const componentNames = [
        'Bearing', 'Motor', 'Pump', 'Valve', 'Transformer', 
        'Switch', 'Cable', 'Fan', 'Filter', 'Sensor'
      ];
      
      const results = await testAllModels(componentNames);
      console.log('AI Model Test Results:', results);
      
      toast({
        title: "AI Model Testing Complete",
        description: `Tested ${results.length} models. Check console for detailed results.`
      });
    } catch (error) {
      toast({
        title: "AI Model Testing Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading SAP Catalog Profile Generator...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>SAP Catalog Profile Generator</CardTitle>
            <CardDescription>
              Please sign in to access the application
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => blink.auth.login()}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Database className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  SAP Catalog Profile Generator
                </h1>
                <p className="text-sm text-gray-500">
                  Intelligent failure modes processing system
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {!showDashboard && (
                <Button variant="outline" size="sm" onClick={handleBackToDashboard}>
                  <Database className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              )}
              
              <Button variant="outline" size="sm" onClick={async () => {
                const result = await testAPIConnection();
                toast({
                  title: result.success ? "API Connection Successful" : "API Connection Failed",
                  description: result.message,
                  variant: result.success ? "default" : "destructive"
                });
              }}>
                <Zap className="h-4 w-4 mr-2" />
                Test API
              </Button>
              
              <Button variant="outline" size="sm" onClick={testAIModels}>
                <Brain className="h-4 w-4 mr-2" />
                Test All Models
              </Button>
              
              <Badge variant="outline">
                {user.email}
              </Badge>
              
              <Button variant="outline" size="sm" onClick={() => blink.auth.logout()}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showDashboard ? (
          <Dashboard 
            user={user}
            onStartNewSession={handleStartNewSession}
            onLoadSession={handleLoadSession}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Progress and Controls */}
            <div className="space-y-6">
              <StepProgress currentStep={currentStep} steps={[]} />
              
              {!inputData.length && (
                <FileUpload 
                  onDataLoaded={handleDataLoaded}
                  isProcessing={isProcessing}
                />
              )}
              
              {inputData.length > 0 && currentStep < 11 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      Processing Controls
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-gray-600">
                      <p>Data loaded: <strong>{inputData.length} records</strong></p>
                      <p>Current step: <strong>{currentStep} of 10</strong></p>
                    </div>
                    
                    <Button 
                      onClick={processAllSteps}
                      disabled={isProcessing}
                      className="w-full"
                    >
                      {isProcessing ? 'Processing...' : 'Start Processing'}
                    </Button>
                    
                    <Button 
                      variant="outline"
                      onClick={handleStartNewSession}
                      className="w-full"
                    >
                      Reset & Upload New Data
                    </Button>
                  </CardContent>
                </Card>
              )}
              
              {finalData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="h-5 w-5" />
                      Export Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        Generated <strong>{finalData.length}</strong> SAP catalog profile entries
                      </p>
                      <Button 
                        onClick={() => exportFinalData('csv')}
                        className="w-full"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download CSV
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Data Display */}
            <div className="lg:col-span-2">
              {finalData.length > 0 ? (
                <DataTable
                  data={finalData}
                  columns={[
                    { key: 'locationId', label: 'Location ID', sortable: true, filterable: true },
                    { key: 'catalogProfile', label: 'Catalog Profile', sortable: true, filterable: true },
                    { key: 'catalogProfileDescription', label: 'Profile Description', sortable: true },
                    { key: 'catalog', label: 'Catalog', sortable: true, filterable: true },
                    { key: 'codeGroup', label: 'Code Group', sortable: true, filterable: true },
                    { key: 'codeGroupDescription', label: 'Group Description', sortable: true },
                    { key: 'code', label: 'Code', sortable: true, filterable: true },
                    { key: 'codeDescription', label: 'Code Description', sortable: true }
                  ]}
                  title="SAP Catalog Profile Loadsheet"
                  description="Final processed data ready for SAP import"
                  onExport={exportFinalData}
                />
              ) : inputData.length > 0 ? (
                <DataTable
                  data={inputData}
                  columns={[
                    { key: 'assetClassTypeId', label: 'Asset Class Type ID', sortable: true, filterable: true },
                    { key: 'locationId', label: 'Location ID', sortable: true, filterable: true },
                    { key: 'locationName', label: 'Location Name', sortable: true },
                    { key: 'maintainableItemName', label: 'Maintainable Item', sortable: true },
                    { key: 'componentName', label: 'Component Name', sortable: true, filterable: true },
                    { key: 'failureMechanism', label: 'Failure Mechanism', sortable: true, filterable: true },
                    { key: 'failureCause', label: 'Failure Cause', sortable: true, filterable: true }
                  ]}
                  title="Input Data Preview"
                  description="Loaded data ready for processing"
                />
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center h-96">
                    <div className="text-center text-gray-500">
                      <Database className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No Data Loaded</h3>
                      <p>Upload a CSV file to begin processing</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      {/* QA Conflict Modal */}
      <QAConflictModal
        isOpen={showQAModal}
        onClose={() => setShowQAModal(false)}
        conflicts={qaConflicts}
        onResolveConflicts={handleQAResolution}
      />

      <Toaster />
      <NotificationDisplay />
    </div>
  );
}

export default App;