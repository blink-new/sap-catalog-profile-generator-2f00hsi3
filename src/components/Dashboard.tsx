import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Database, 
  Zap, 
  Brain, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  BarChart3,
  Settings,
  Download,
  Upload,
  Activity
} from 'lucide-react';
import { 
  loadProcessingSessions, 
  loadDamageCodeLibrary, 
  loadCauseCodeLibrary, 
  loadComponentCodeLibrary,
  loadAIModelPerformance
} from '../utils/dataStorage';
import { ProcessingSession, AIModelPerformance } from '../types';
import { LibraryManager } from './LibraryManager';

interface DashboardProps {
  user: any;
  onStartNewSession: () => void;
  onLoadSession: (session: ProcessingSession) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  user, 
  onStartNewSession, 
  onLoadSession 
}) => {
  const [sessions, setSessions] = useState<ProcessingSession[]>([]);
  const [libraryStats, setLibraryStats] = useState({
    damageCodeCount: 0,
    causeCodeCount: 0,
    componentCodeCount: 0
  });
  const [aiPerformance, setAiPerformance] = useState<AIModelPerformance[]>([]);
  const [showLibraryManager, setShowLibraryManager] = useState(false);

  useEffect(() => {
    // Load user sessions
    const allSessions = loadProcessingSessions();
    const userSessions = allSessions.filter(s => s.id.includes(user.id));
    setSessions(userSessions.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    ));

    // Load library statistics
    const damageLibrary = loadDamageCodeLibrary();
    const causeLibrary = loadCauseCodeLibrary();
    const componentLibrary = loadComponentCodeLibrary();
    
    setLibraryStats({
      damageCodeCount: damageLibrary.length,
      causeCodeCount: causeLibrary.length,
      componentCodeCount: componentLibrary.length
    });

    // Load AI performance data
    const performance = loadAIModelPerformance();
    setAiPerformance(performance.slice(-20)); // Last 20 entries
  }, [user.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in_progress': return 'text-blue-600 bg-blue-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'in_progress': return <Clock className="h-4 w-4" />;
      case 'error': return <AlertTriangle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const calculateAverageResponseTime = () => {
    if (aiPerformance.length === 0) return 0;
    const total = aiPerformance.reduce((sum, perf) => sum + perf.responseTimeMs, 0);
    return Math.round(total / aiPerformance.length);
  };

  const getMostUsedModel = () => {
    if (aiPerformance.length === 0) return 'N/A';
    const modelCounts = aiPerformance.reduce((acc, perf) => {
      acc[perf.modelName] = (acc[perf.modelName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(modelCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A';
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {user.displayName || user.email}!
        </h1>
        <p className="text-blue-100">
          SAP Catalog Profile Generator - Transform your failure modes data into standardized SAP profiles
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Sessions</p>
                <p className="text-2xl font-bold">{sessions.length}</p>
              </div>
              <Database className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Damage Codes</p>
                <p className="text-2xl font-bold">{libraryStats.damageCodeCount}</p>
              </div>
              <Zap className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cause Codes</p>
                <p className="text-2xl font-bold">{libraryStats.causeCodeCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Component Codes</p>
                <p className="text-2xl font-bold">{libraryStats.componentCodeCount}</p>
              </div>
              <Brain className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sessions">Recent Sessions</TabsTrigger>
          <TabsTrigger value="performance">AI Performance</TabsTrigger>
          <TabsTrigger value="libraries">Code Libraries</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Processing Sessions</h3>
            <Button onClick={onStartNewSession}>
              <Upload className="h-4 w-4 mr-2" />
              Start New Session
            </Button>
          </div>

          {sessions.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <div className="text-center text-gray-500">
                  <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No processing sessions yet</p>
                  <p className="text-sm">Upload your first CSV file to get started</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sessions.slice(0, 5).map((session) => (
                <Card key={session.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{session.sessionName}</h4>
                          <Badge className={`text-xs ${getStatusColor(session.status)}`}>
                            {getStatusIcon(session.status)}
                            <span className="ml-1 capitalize">{session.status.replace('_', ' ')}</span>
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>{session.inputData.length} records</span>
                          <span>Step {session.currentStep} of {session.totalSteps}</span>
                          <span>{new Date(session.updatedAt).toLocaleDateString()}</span>
                        </div>
                        
                        <div className="mt-2">
                          <Progress 
                            value={(session.currentStep / session.totalSteps) * 100} 
                            className="h-2"
                          />
                        </div>
                      </div>
                      
                      <div className="flex gap-2 ml-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => onLoadSession(session)}
                        >
                          {session.status === 'completed' ? 'View' : 'Continue'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Average Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{calculateAverageResponseTime()}ms</div>
                <p className="text-xs text-gray-600">Across all AI models</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Most Used Model</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">{getMostUsedModel()}</div>
                <p className="text-xs text-gray-600">For code generation</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Generations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{aiPerformance.length}</div>
                <p className="text-xs text-gray-600">Component codes generated</p>
              </CardContent>
            </Card>
          </div>

          {aiPerformance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent AI Performance</CardTitle>
                <CardDescription>Last 20 component code generations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {aiPerformance.map((perf) => (
                    <div key={perf.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{perf.componentName}</div>
                        <div className="text-xs text-gray-600">{perf.modelName}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm">{perf.generatedCode}</div>
                        <div className="text-xs text-gray-600">{perf.responseTimeMs}ms</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="libraries" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-red-600" />
                  Damage Code Library
                </CardTitle>
                <CardDescription>Failure mechanism codes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2">{libraryStats.damageCodeCount}</div>
                <p className="text-sm text-gray-600">Unique failure mechanisms</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => setShowLibraryManager(true)}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Library
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  Cause Code Library
                </CardTitle>
                <CardDescription>Failure cause codes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2">{libraryStats.causeCodeCount}</div>
                <p className="text-sm text-gray-600">Unique failure causes</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => setShowLibraryManager(true)}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Library
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-green-600" />
                  Component Code Library
                </CardTitle>
                <CardDescription>AI-generated component codes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2">{libraryStats.componentCodeCount}</div>
                <p className="text-sm text-gray-600">Unique component codes</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => setShowLibraryManager(true)}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Library
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Library Management</CardTitle>
              <CardDescription>
                Manage your code libraries and export data for backup
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export Damage Codes
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export Cause Codes
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export Component Codes
                </Button>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Library Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Library Manager Modal */}
      <LibraryManager
        isOpen={showLibraryManager}
        onClose={() => setShowLibraryManager(false)}
      />
    </div>
  );
};