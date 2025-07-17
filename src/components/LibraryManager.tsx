import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { DataTable } from './DataTable';
import { 
  Search, 
  Download, 
  Edit3, 
  Trash2, 
  Plus, 
  Save,
  X,
  AlertTriangle,
  Zap,
  Brain,
  Settings,
  TestTube,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { 
  loadDamageCodeLibrary, 
  loadCauseCodeLibrary, 
  loadComponentCodeLibrary,
  saveDamageCodeLibrary,
  saveCauseCodeLibrary,
  saveComponentCodeLibrary
} from '../utils/dataStorage';
import { DamageCodeLibrary, CauseCodeLibrary, ComponentCodeLibrary } from '../types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { testAPIConnection, AI_MODELS } from '../utils/aiCodeGeneration';

interface LibraryManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LibraryManager: React.FC<LibraryManagerProps> = ({ isOpen, onClose }) => {
  const [damageLibrary, setDamageLibrary] = useState<DamageCodeLibrary[]>([]);
  const [causeLibrary, setCauseLibrary] = useState<CauseCodeLibrary[]>([]);
  const [componentLibrary, setComponentLibrary] = useState<ComponentCodeLibrary[]>([]);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingType, setEditingType] = useState<'damage' | 'cause' | 'component' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [apiTestResult, setApiTestResult] = useState<any>(null);
  const [isTestingAPI, setIsTestingAPI] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLibraries();
    }
  }, [isOpen]);

  const loadLibraries = () => {
    setDamageLibrary(loadDamageCodeLibrary());
    setCauseLibrary(loadCauseCodeLibrary());
    setComponentLibrary(loadComponentCodeLibrary());
  };

  const handleEdit = (item: any, type: 'damage' | 'cause' | 'component') => {
    setEditingItem({ ...item });
    setEditingType(type);
  };

  const handleSave = () => {
    if (!editingItem || !editingType) return;

    if (editingType === 'damage') {
      const updatedLibrary = damageLibrary.map(item => 
        item.id === editingItem.id ? editingItem : item
      );
      setDamageLibrary(updatedLibrary);
      saveDamageCodeLibrary(updatedLibrary);
    } else if (editingType === 'cause') {
      const updatedLibrary = causeLibrary.map(item => 
        item.id === editingItem.id ? editingItem : item
      );
      setCauseLibrary(updatedLibrary);
      saveCauseCodeLibrary(updatedLibrary);
    } else if (editingType === 'component') {
      const updatedLibrary = componentLibrary.map(item => 
        item.id === editingItem.id ? editingItem : item
      );
      setComponentLibrary(updatedLibrary);
      saveComponentCodeLibrary(updatedLibrary);
    }

    setEditingItem(null);
    setEditingType(null);
  };

  const handleDelete = (id: string, type: 'damage' | 'cause' | 'component') => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    if (type === 'damage') {
      const updatedLibrary = damageLibrary.filter(item => item.id !== id);
      setDamageLibrary(updatedLibrary);
      saveDamageCodeLibrary(updatedLibrary);
    } else if (type === 'cause') {
      const updatedLibrary = causeLibrary.filter(item => item.id !== id);
      setCauseLibrary(updatedLibrary);
      saveCauseCodeLibrary(updatedLibrary);
    } else if (type === 'component') {
      const updatedLibrary = componentLibrary.filter(item => item.id !== id);
      setComponentLibrary(updatedLibrary);
      saveComponentCodeLibrary(updatedLibrary);
    }
  };

  const handleTestAPI = async () => {
    setIsTestingAPI(true);
    setApiTestResult(null);
    
    try {
      const result = await testAPIConnection();
      setApiTestResult(result);
    } catch (error) {
      setApiTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: { error }
      });
    } finally {
      setIsTestingAPI(false);
    }
  };

  const exportLibrary = (type: 'damage' | 'cause' | 'component') => {
    let data: any[] = [];
    let filename = '';
    let headers: string[] = [];

    if (type === 'damage') {
      data = damageLibrary;
      filename = 'damage_code_library.csv';
      headers = ['Failure Mechanism', 'Damage Code', 'Index', 'Unique Summing Number', 'Similarities'];
    } else if (type === 'cause') {
      data = causeLibrary;
      filename = 'cause_code_library.csv';
      headers = ['Failure Cause', 'Cause Code', 'Index', 'Unique Summing Number', 'Similarities'];
    } else if (type === 'component') {
      data = componentLibrary;
      filename = 'component_code_library.csv';
      headers = ['Component Name', 'Object Part Code', 'Mechanism Sum Check', 'Cause Sum Check', 'Similarities'];
    }

    const csvContent = headers.join(',') + '\\n' +
      data.map(item => {
        if (type === 'damage') {
          return [
            item.failureMechanism,
            item.damageCode,
            item.indexNumber,
            item.uniqueSummingNumber,
            item.similarities.join(';')
          ].map(cell => `"${cell}"`).join(',');
        } else if (type === 'cause') {
          return [
            item.failureCause,
            item.causeCode,
            item.indexNumber,
            item.uniqueSummingNumber,
            item.similarities.join(';')
          ].map(cell => `"${cell}"`).join(',');
        } else {
          return [
            item.componentName,
            item.objectPartCode,
            item.mechanismSumCheck,
            item.causeSumCheck,
            item.similarities.join(';')
          ].map(cell => `"${cell}"`).join(',');
        }
      }).join('\\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const renderActionButtons = (item: any, type: 'damage' | 'cause' | 'component') => (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleEdit(item, type)}
      >
        <Edit3 className="h-3 w-3" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleDelete(item.id, type)}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );

  const filteredDamageLibrary = damageLibrary.filter(item =>
    item.failureMechanism.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.damageCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCauseLibrary = causeLibrary.filter(item =>
    item.failureCause.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.causeCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredComponentLibrary = componentLibrary.filter(item =>
    item.componentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.objectPartCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Code Library Manager
          </DialogTitle>
          <DialogDescription>
            Manage your damage codes, cause codes, and component codes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search across all libraries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Tabs defaultValue="damage" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="damage" className="text-red-600">
                <Zap className="h-4 w-4 mr-2" />
                Damage Codes ({filteredDamageLibrary.length})
              </TabsTrigger>
              <TabsTrigger value="cause" className="text-orange-600">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Cause Codes ({filteredCauseLibrary.length})
              </TabsTrigger>
              <TabsTrigger value="component" className="text-green-600">
                <Brain className="h-4 w-4 mr-2" />
                Component Codes ({filteredComponentLibrary.length})
              </TabsTrigger>
              <TabsTrigger value="ai-settings" className="text-blue-600">
                <Settings className="h-4 w-4 mr-2" />
                AI Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="damage" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Damage Code Library</h3>
                <Button
                  size="sm"
                  onClick={() => exportLibrary('damage')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>

              <DataTable
                data={filteredDamageLibrary.map(item => ({
                  ...item,
                  actions: renderActionButtons(item, 'damage'),
                  similaritiesText: item.similarities.join(', ')
                }))}
                columns={[
                  { key: 'failureMechanism', label: 'Failure Mechanism', sortable: true, filterable: true },
                  { key: 'damageCode', label: 'Damage Code', sortable: true, filterable: true },
                  { key: 'indexNumber', label: 'Index', sortable: true },
                  { key: 'uniqueSummingNumber', label: 'Unique Sum', sortable: true },
                  { key: 'similaritiesText', label: 'Similarities', sortable: false },
                  { key: 'actions', label: 'Actions', sortable: false }
                ]}
                title="Damage Codes"
                description={`${filteredDamageLibrary.length} failure mechanism codes`}
                maxHeight="400px"
              />
            </TabsContent>

            <TabsContent value="cause" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Cause Code Library</h3>
                <Button
                  size="sm"
                  onClick={() => exportLibrary('cause')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>

              <DataTable
                data={filteredCauseLibrary.map(item => ({
                  ...item,
                  actions: renderActionButtons(item, 'cause'),
                  similaritiesText: item.similarities.join(', ')
                }))}
                columns={[
                  { key: 'failureCause', label: 'Failure Cause', sortable: true, filterable: true },
                  { key: 'causeCode', label: 'Cause Code', sortable: true, filterable: true },
                  { key: 'indexNumber', label: 'Index', sortable: true },
                  { key: 'uniqueSummingNumber', label: 'Unique Sum', sortable: true },
                  { key: 'similaritiesText', label: 'Similarities', sortable: false },
                  { key: 'actions', label: 'Actions', sortable: false }
                ]}
                title="Cause Codes"
                description={`${filteredCauseLibrary.length} failure cause codes`}
                maxHeight="400px"
              />
            </TabsContent>

            <TabsContent value="component" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Component Code Library</h3>
                <Button
                  size="sm"
                  onClick={() => exportLibrary('component')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>

              <DataTable
                data={filteredComponentLibrary.map(item => ({
                  ...item,
                  actions: renderActionButtons(item, 'component'),
                  similaritiesText: item.similarities.join(', ')
                }))}
                columns={[
                  { key: 'componentName', label: 'Component Name', sortable: true, filterable: true },
                  { key: 'objectPartCode', label: 'Object Part Code', sortable: true, filterable: true },
                  { key: 'mechanismSumCheck', label: 'Mechanism Sum', sortable: true },
                  { key: 'causeSumCheck', label: 'Cause Sum', sortable: true },
                  { key: 'similaritiesText', label: 'Similarities', sortable: false },
                  { key: 'actions', label: 'Actions', sortable: false }
                ]}
                title="Component Codes"
                description={`${filteredComponentLibrary.length} component codes`}
                maxHeight="400px"
              />
            </TabsContent>

            <TabsContent value="ai-settings" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">AI Model Configuration</h3>
                <Button
                  size="sm"
                  onClick={handleTestAPI}
                  disabled={isTestingAPI}
                >
                  {isTestingAPI ? (
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4 mr-2" />
                  )}
                  {isTestingAPI ? 'Testing...' : 'Test API Connection'}
                </Button>
              </div>

              {/* API Test Results */}
              {apiTestResult && (
                <Card className={`border-l-4 ${apiTestResult.success ? 'border-l-green-500 bg-green-50' : 'border-l-red-500 bg-red-50'}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      {apiTestResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <h4 className={`font-medium ${apiTestResult.success ? 'text-green-800' : 'text-red-800'}`}>
                          {apiTestResult.success ? 'API Connection Successful' : 'API Connection Failed'}
                        </h4>
                        <p className={`text-sm mt-1 ${apiTestResult.success ? 'text-green-700' : 'text-red-700'}`}>
                          {apiTestResult.message}
                        </p>
                        {apiTestResult.details && (
                          <div className="mt-2 text-xs">
                            {apiTestResult.success && apiTestResult.details.model && (
                              <p className="text-green-600">
                                <strong>Model:</strong> {apiTestResult.details.model}
                              </p>
                            )}
                            {apiTestResult.success && apiTestResult.details.response && (
                              <p className="text-green-600">
                                <strong>Test Response:</strong> {apiTestResult.details.response}
                              </p>
                            )}
                            {!apiTestResult.success && apiTestResult.details.troubleshooting && (
                              <p className="text-red-600 mt-1">
                                <strong>Troubleshooting:</strong> {apiTestResult.details.troubleshooting}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Available Models */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Available AI Models</CardTitle>
                  <CardDescription>
                    These models are used for component code generation. The system automatically tries each model in order until one succeeds.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {AI_MODELS.map((model, index) => (
                      <div key={model.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant={model.primary ? "default" : "secondary"}>
                            {model.primary ? "Primary" : `Fallback ${index}`}
                          </Badge>
                          <div>
                            <p className="font-medium">{model.name}</p>
                            <p className="text-sm text-gray-500">{model.id}</p>
                            <p className="text-xs text-blue-600">
                              Rate limit: {model.rateLimitPerMin}/min
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            Free
                          </Badge>
                          <Badge variant="outline" className="text-blue-600 border-blue-600">
                            {model.rateLimitPerMin}/min
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Configuration Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">API Provider</span>
                    <Badge>OpenRouter</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Fallback Strategy</span>
                    <Badge variant="outline">Multi-Model + Rate Limiting</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Code Length</span>
                    <Badge variant="outline">4 Characters</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Training Data</span>
                    <Badge variant="outline">500+ Components</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Rate Limiting</span>
                    <Badge variant="outline">Intelligent + Exponential Backoff</Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Edit Modal */}
        {editingItem && (
          <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Edit {editingType === 'damage' ? 'Damage Code' : 
                        editingType === 'cause' ? 'Cause Code' : 'Component Code'}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {editingType === 'damage' && (
                  <>
                    <div>
                      <Label htmlFor="failureMechanism">Failure Mechanism</Label>
                      <Input
                        id="failureMechanism"
                        value={editingItem.failureMechanism}
                        onChange={(e) => setEditingItem({
                          ...editingItem,
                          failureMechanism: e.target.value
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="damageCode">Damage Code</Label>
                      <Input
                        id="damageCode"
                        value={editingItem.damageCode}
                        onChange={(e) => setEditingItem({
                          ...editingItem,
                          damageCode: e.target.value
                        })}
                      />
                    </div>
                  </>
                )}

                {editingType === 'cause' && (
                  <>
                    <div>
                      <Label htmlFor="failureCause">Failure Cause</Label>
                      <Input
                        id="failureCause"
                        value={editingItem.failureCause}
                        onChange={(e) => setEditingItem({
                          ...editingItem,
                          failureCause: e.target.value
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="causeCode">Cause Code</Label>
                      <Input
                        id="causeCode"
                        value={editingItem.causeCode}
                        onChange={(e) => setEditingItem({
                          ...editingItem,
                          causeCode: e.target.value
                        })}
                      />
                    </div>
                  </>
                )}

                {editingType === 'component' && (
                  <>
                    <div>
                      <Label htmlFor="componentName">Component Name</Label>
                      <Input
                        id="componentName"
                        value={editingItem.componentName}
                        onChange={(e) => setEditingItem({
                          ...editingItem,
                          componentName: e.target.value
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="objectPartCode">Object Part Code</Label>
                      <Input
                        id="objectPartCode"
                        value={editingItem.objectPartCode}
                        onChange={(e) => setEditingItem({
                          ...editingItem,
                          objectPartCode: e.target.value
                        })}
                      />
                    </div>
                  </>
                )}

                <div>
                  <Label htmlFor="similarities">Similarities (one per line)</Label>
                  <Textarea
                    id="similarities"
                    value={editingItem.similarities.join('\\n')}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      similarities: e.target.value.split('\\n').filter(s => s.trim())
                    })}
                    rows={4}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditingItem(null)}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
};