// Input data structure
export interface InputData {
  assetClassTypeId: string;
  locationId: string;
  locationName: string;
  maintainableItemName: string;
  componentName: string;
  failureMechanism: string;
  failureCause: string;
}

// Step 1: Catalog Profile Coding and Naming
export interface CatalogProfile {
  id: string;
  assetClassTypeId: string;
  locationId: string;
  locationName: string;
  variationL1CodeCheck: string;
  firstNumber: number;
  numberConsolidate: string;
  locationIndex: number;
  locationConsolidate: string;
  catalogProfile: string;
  catalogProfileDescription: string;
}

// Step 2: Object Part Grouping
export interface ObjectPartGroup {
  id: string;
  assetClassTypeId: string;
  locationId: string;
  locationName: string;
  maintainableItemName: string;
  catalogProfile: string;
  maintainableItemIndex: number;
  maintainableItemAlpha: string;
  objectPartCodeGroup: string;
  objectPartGroupName: string;
}

// Step 3: Damage Code Library
export interface DamageCodeLibrary {
  id: string;
  failureMechanism: string;
  finalChosenFailureMechanism?: string;
  indexNumber: number;
  numberCode: string;
  damageCode: string;
  uniqueSummingNumber: number;
  similarities: string[];
}

// Step 4: Cause Code Library
export interface CauseCodeLibrary {
  id: string;
  failureCause: string;
  finalChosenFailureCause?: string;
  indexNumber: number;
  numberCode: string;
  causeCode: string;
  uniqueSummingNumber: number;
  similarities: string[];
}

// Step 5: Failure Set Check
export interface FailureSetCheck {
  id: string;
  locationId: string;
  locationName: string;
  maintainableItemName: string;
  componentName: string;
  failureMechanism: string;
  failureCause: string;
  mechanismScoring: number;
  causeScoring: number;
  locMiCompCombined: string;
  mechanismSumCheck: number;
  causeSumCheck: number;
}

// Step 6: Component Code Library
export interface ComponentCodeLibrary {
  id: string;
  componentName: string;
  mechanismSumCheck: number;
  causeSumCheck: number;
  checkDuplicateCompDiffSumCheck: boolean;
  objectPartCode: string;
  damageCodeGroup: string;
  causeCodeGroup: string;
  compSumCheckCombine: string;
  similarities: string[];
  finalChosenComponentName?: string;
}

// Step 7: Code Allocations
export interface CodeAllocation {
  id: string;
  locationId: string;
  locationName: string;
  maintainableItemName: string;
  componentName: string;
  failureMechanism: string;
  failureCause: string;
  mechanismSumCheck: number;
  causeSumCheck: number;
  damageCode: string;
  causeCode: string;
  compSumCheckCombine: string;
  objectPartCode: string;
  damageCodeGroup: string;
  causeCodeGroup: string;
  combiLookupOpCode: string;
}

// Step 8: B Catalog
export interface BCatalog {
  id: string;
  locationId: string;
  locationName: string;
  maintainableItemName: string;
  componentName: string;
  objectPartCodeGroup: string;
  combiLookupOpCode: string;
  objectPartCode: string;
  codeGroup: string;
  codeGroupDescription: string;
  code: string;
  codeDescription: string;
}

// Step 9: C Catalog
export interface CCatalog {
  id: string;
  locationId: string;
  locationName: string;
  maintainableItemName: string;
  componentName: string;
  failureMechanism: string;
  damageCode: string;
  damageCodeGroup: string;
  codeGroup: string;
  codeGroupDescription: string;
  code: string;
  codeDescription: string;
}

// Step 10: 5 Catalog
export interface FiveCatalog {
  id: string;
  locationId: string;
  locationName: string;
  maintainableItemName: string;
  componentName: string;
  failureCause: string;
  causeCode: string;
  causeCodeGroup: string;
  codeGroup: string;
  codeGroupDescription: string;
  code: string;
  codeDescription: string;
}

// Final Load Sheet
export interface SAPCatalogLoadsheet {
  id: string;
  locationId: string;
  catalogProfile: string;
  catalogProfileDescription: string;
  catalog: 'B' | 'C' | '5';
  codeGroup: string;
  codeGroupDescription: string;
  code: string;
  codeDescription: string;
  catalogSorting: number;
  namingSorting: string;
}

// QA Conflict Resolution
export interface QAConflict {
  id: string;
  type: 'damage' | 'cause' | 'component';
  originalName: string;
  suggestedMatches: Array<{
    name: string;
    similarity: number;
    code?: string;
  }>;
  userChoice?: string;
  resolved: boolean;
}

// Processing Session
export interface ProcessingSession {
  id: string;
  sessionName: string;
  currentStep: number;
  totalSteps: number;
  status: 'in_progress' | 'completed' | 'error';
  inputData: InputData[];
  qaConflicts: QAConflict[];
  createdAt: string;
  updatedAt: string;
}

// AI Model Performance
export interface AIModelPerformance {
  id: string;
  modelName: string;
  componentName: string;
  generatedCode: string;
  userApprovedCode?: string;
  accuracyScore?: number;
  responseTimeMs: number;
  createdAt: string;
}

// Component code training data
export interface ComponentCodeTrainingData {
  componentName: string;
  objectPartCode: string;
  variations: string[];
}