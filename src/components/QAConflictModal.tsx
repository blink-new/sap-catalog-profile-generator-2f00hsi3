import React, { useState } from 'react';
import { AlertTriangle, Check, X, Edit3 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { QAConflict } from '../types';

interface QAConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: QAConflict[];
  onResolveConflicts: (resolutions: Array<{ conflictId: string; resolution: 'accept' | 'reject' | 'custom'; customValue?: string; selectedMatch?: string }>) => void;
}

export const QAConflictModal: React.FC<QAConflictModalProps> = ({
  isOpen,
  onClose,
  conflicts,
  onResolveConflicts
}) => {
  const [resolutions, setResolutions] = useState<Record<string, {
    resolution: 'accept' | 'reject' | 'custom';
    selectedMatch?: string;
    customValue?: string;
  }>>({});

  const damageConflicts = conflicts.filter(c => c.type === 'damage');
  const causeConflicts = conflicts.filter(c => c.type === 'cause');
  const componentConflicts = conflicts.filter(c => c.type === 'component');

  const handleResolutionChange = (conflictId: string, resolution: 'accept' | 'reject' | 'custom', selectedMatch?: string, customValue?: string) => {
    setResolutions(prev => ({
      ...prev,
      [conflictId]: { resolution, selectedMatch, customValue }
    }));
  };

  const handleSubmit = () => {
    const resolutionArray = conflicts.map(conflict => ({
      conflictId: conflict.id,
      resolution: resolutions[conflict.id]?.resolution || 'reject',
      selectedMatch: resolutions[conflict.id]?.selectedMatch,
      customValue: resolutions[conflict.id]?.customValue
    }));
    
    onResolveConflicts(resolutionArray);
    setResolutions({});
    onClose();
  };

  const handleBulkAction = (action: 'accept_all' | 'reject_all', conflictType?: string) => {
    const targetConflicts = conflictType 
      ? conflicts.filter(c => c.type === conflictType)
      : conflicts;
    
    const newResolutions = { ...resolutions };
    
    targetConflicts.forEach(conflict => {
      if (action === 'accept_all' && conflict.suggestedMatches.length > 0) {
        newResolutions[conflict.id] = {
          resolution: 'accept',
          selectedMatch: conflict.suggestedMatches[0].name
        };
      } else if (action === 'reject_all') {
        newResolutions[conflict.id] = {
          resolution: 'reject'
        };
      }
    });
    
    setResolutions(newResolutions);
  };

  const getTabColor = (type: string) => {
    switch (type) {
      case 'damage': return 'text-red-600';
      case 'cause': return 'text-orange-600';
      case 'component': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const renderConflictCard = (conflict: QAConflict) => {
    const resolution = resolutions[conflict.id];
    
    return (
      <Card key={conflict.id} className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="font-medium">{conflict.originalName}</span>
            <Badge variant="outline" className={getTabColor(conflict.type)}>
              {conflict.type === 'damage' ? 'Failure Mechanism' : 
               conflict.type === 'cause' ? 'Failure Cause' : 'Component'}
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Found {conflict.suggestedMatches.length} similar {conflict.type === 'damage' ? 'mechanism' : conflict.type === 'cause' ? 'cause' : 'component'}(s) in the library
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Suggested Matches */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Suggested Matches:</Label>
            {conflict.suggestedMatches.map((match, index) => (
              <div 
                key={index}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  resolution?.resolution === 'accept' && resolution?.selectedMatch === match.name
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleResolutionChange(conflict.id, 'accept', match.name)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{match.name}</span>
                  <div className="flex items-center gap-2">
                    {match.code && (
                      <Badge variant="secondary" className="text-xs">{match.code}</Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {Math.round(match.similarity * 100)}% match
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Resolution Options */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={resolution?.resolution === 'accept' ? 'default' : 'outline'}
              onClick={() => {
                if (conflict.suggestedMatches.length > 0) {
                  handleResolutionChange(conflict.id, 'accept', conflict.suggestedMatches[0].name);
                }
              }}
              disabled={conflict.suggestedMatches.length === 0}
            >
              <Check className="h-3 w-3 mr-1" />
              Accept Match
            </Button>
            
            <Button
              size="sm"
              variant={resolution?.resolution === 'reject' ? 'default' : 'outline'}
              onClick={() => handleResolutionChange(conflict.id, 'reject')}
            >
              <X className="h-3 w-3 mr-1" />
              Create New
            </Button>
            
            <Button
              size="sm"
              variant={resolution?.resolution === 'custom' ? 'default' : 'outline'}
              onClick={() => handleResolutionChange(conflict.id, 'custom')}
            >
              <Edit3 className="h-3 w-3 mr-1" />
              Custom Name
            </Button>
          </div>

          {/* Custom Input */}
          {resolution?.resolution === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor={`custom-${conflict.id}`} className="text-xs">Custom Name:</Label>
              <Input
                id={`custom-${conflict.id}`}
                placeholder={`Enter custom ${conflict.type} name`}
                value={resolution.customValue || ''}
                onChange={(e) => handleResolutionChange(conflict.id, 'custom', undefined, e.target.value)}
                className="text-sm"
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (conflicts.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Quality Assurance - Resolve Conflicts
          </DialogTitle>
          <DialogDescription>
            We found {conflicts.length} potential duplicate(s) in your data. Please review and resolve each conflict below.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="damage" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="damage" className="text-red-600">
              Failure Mechanisms ({damageConflicts.length})
            </TabsTrigger>
            <TabsTrigger value="cause" className="text-orange-600">
              Failure Causes ({causeConflicts.length})
            </TabsTrigger>
            <TabsTrigger value="component" className="text-blue-600">
              Components ({componentConflicts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="damage" className="space-y-4">
            {damageConflicts.length > 0 ? (
              <>
                <div className="flex gap-2 pb-2 border-b">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleBulkAction('accept_all', 'damage')}
                  >
                    Accept All Best Matches
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleBulkAction('reject_all', 'damage')}
                  >
                    Create All New
                  </Button>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-4">
                  {damageConflicts.map(renderConflictCard)}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No failure mechanism conflicts found
              </div>
            )}
          </TabsContent>

          <TabsContent value="cause" className="space-y-4">
            {causeConflicts.length > 0 ? (
              <>
                <div className="flex gap-2 pb-2 border-b">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleBulkAction('accept_all', 'cause')}
                  >
                    Accept All Best Matches
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleBulkAction('reject_all', 'cause')}
                  >
                    Create All New
                  </Button>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-4">
                  {causeConflicts.map(renderConflictCard)}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No failure cause conflicts found
              </div>
            )}
          </TabsContent>

          <TabsContent value="component" className="space-y-4">
            {componentConflicts.length > 0 ? (
              <>
                <div className="flex gap-2 pb-2 border-b">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleBulkAction('accept_all', 'component')}
                  >
                    Accept All Best Matches
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleBulkAction('reject_all', 'component')}
                  >
                    Create All New
                  </Button>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-4">
                  {componentConflicts.map(renderConflictCard)}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No component conflicts found
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-600">
            Resolved: {Object.keys(resolutions).length} of {conflicts.length}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={Object.keys(resolutions).length < conflicts.length}
            >
              Apply Resolutions
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};