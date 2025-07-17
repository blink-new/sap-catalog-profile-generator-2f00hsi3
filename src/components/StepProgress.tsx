import React from 'react';
import { Check, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

interface Step {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

interface StepProgressProps {
  currentStep: number;
  steps: Step[];
}

const STEP_DEFINITIONS: Step[] = [
  {
    id: 1,
    title: 'Catalog Profile Coding',
    description: 'Generate catalog profiles and location indexing',
    status: 'pending'
  },
  {
    id: 2,
    title: 'Object Part Grouping',
    description: 'Group maintainable items and generate part codes',
    status: 'pending'
  },
  {
    id: 3,
    title: 'Damage Code Library',
    description: 'Process failure mechanisms with QA checks',
    status: 'pending'
  },
  {
    id: 4,
    title: 'Cause Code Library',
    description: 'Process failure causes with QA checks',
    status: 'pending'
  },
  {
    id: 5,
    title: 'Failure Set Check',
    description: 'Calculate mechanism and cause sum checks',
    status: 'pending'
  },
  {
    id: 6,
    title: 'Component Code Library',
    description: 'Generate AI-powered component codes',
    status: 'pending'
  },
  {
    id: 7,
    title: 'Code Allocations',
    description: 'Allocate all codes to failure modes',
    status: 'pending'
  },
  {
    id: 8,
    title: 'B Catalog',
    description: 'Generate maintainable item catalog',
    status: 'pending'
  },
  {
    id: 9,
    title: 'C Catalog',
    description: 'Generate component-mechanism catalog',
    status: 'pending'
  },
  {
    id: 10,
    title: 'Final Load Sheet',
    description: 'Create SAP catalog profile loadsheet',
    status: 'pending'
  }
];

export const StepProgress: React.FC<StepProgressProps> = ({ currentStep, steps }) => {
  const stepDefinitions = steps && steps.length > 0 ? steps : STEP_DEFINITIONS;
  const getStepStatus = (stepId: number): 'pending' | 'processing' | 'completed' | 'error' => {
    if (stepId < currentStep) return 'completed';
    if (stepId === currentStep) return 'processing';
    return 'pending';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 border-green-200';
      case 'processing':
        return 'bg-blue-100 border-blue-200';
      case 'error':
        return 'bg-red-100 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default' as const;
      case 'processing':
        return 'secondary' as const;
      case 'error':
        return 'destructive' as const;
      default:
        return 'outline' as const;
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Processing Progress</h3>
            <Badge variant="outline">
              Step {currentStep} of {stepDefinitions.length}
            </Badge>
          </div>
          
          <div className="space-y-3">
            {stepDefinitions.map((step, index) => {
              const status = getStepStatus(step.id);
              
              return (
                <div
                  key={step.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${getStatusColor(status)}`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getStatusIcon(status)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">{step.title}</h4>
                      <Badge variant={getBadgeVariant(status)} className="text-xs">
                        {status === 'processing' ? 'In Progress' : 
                         status === 'completed' ? 'Done' :
                         status === 'error' ? 'Error' : 'Pending'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between text-xs text-gray-600 mb-2">
              <span>Progress</span>
              <span>{Math.round(((currentStep - 1) / stepDefinitions.length) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${((currentStep - 1) / stepDefinitions.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};