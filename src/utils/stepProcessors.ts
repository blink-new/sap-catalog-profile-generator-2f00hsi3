// Step processing utilities for the SAP Catalog Profile Generator
import { 
  InputData, 
  CatalogProfile, 
  ObjectPartGroup, 
  DamageCodeLibrary, 
  CauseCodeLibrary,
  FailureSetCheck,
  ComponentCodeLibrary,
  CodeAllocation,
  BCatalog,
  CCatalog,
  FiveCatalog,
  SAPCatalogLoadsheet,
  QAConflict
} from '../types';
import { generateComponentCode } from './aiCodeGeneration';
import Fuse from 'fuse.js';

// Step 1: Catalog Profile Coding and Naming
export const processStep1 = (inputData: InputData[]): CatalogProfile[] => {
  // Remove duplicates based on Asset Class Type ID + Location ID + Location Name
  const uniqueData = inputData.filter((item, index, self) => 
    index === self.findIndex(t => 
      t.assetClassTypeId === item.assetClassTypeId &&
      t.locationId === item.locationId &&
      t.locationName === item.locationName
    )
  );
  
  // Sort by Location ID
  uniqueData.sort((a, b) => a.locationId.localeCompare(b.locationId));
  
  const result: CatalogProfile[] = [];
  let currentVariationCode = '';
  let firstNumber = 1;
  
  uniqueData.forEach((item, index) => {
    // Extract Variation L1 Code Check (before first "-")
    const variationL1CodeCheck = item.locationId.split('-')[0];
    
    // Update First Number when Variation L1 Code Check changes
    if (variationL1CodeCheck !== currentVariationCode) {
      if (currentVariationCode !== '') {
        firstNumber++;
      }
      currentVariationCode = variationL1CodeCheck;
    }
    
    // Number consolidate (2-digit format)
    const numberConsolidate = firstNumber.toString().padStart(2, '0');
    
    // Location Index (sequential)
    const locationIndex = index + 1;
    
    // Location consolidate (2-digit format)
    const locationConsolidate = locationIndex.toString().padStart(2, '0');
    
    // Catalog Profile (Asset Class Type ID + Number consolidate + Location consolidate)
    const catalogProfile = item.assetClassTypeId + numberConsolidate + locationConsolidate;
    
    result.push({
      id: `cp_${Date.now()}_${index}`,
      assetClassTypeId: item.assetClassTypeId,
      locationId: item.locationId,
      locationName: item.locationName,
      variationL1CodeCheck,
      firstNumber,
      numberConsolidate,
      locationIndex,
      locationConsolidate,
      catalogProfile,
      catalogProfileDescription: item.locationName
    });
  });
  
  return result;
};

// Step 2: Object Part Grouping
export const processStep2 = (inputData: InputData[], step1Data: CatalogProfile[]): ObjectPartGroup[] => {
  // Remove duplicates based on all four columns combined
  const uniqueData = inputData.filter((item, index, self) => 
    index === self.findIndex(t => 
      t.assetClassTypeId === item.assetClassTypeId &&
      t.locationId === item.locationId &&
      t.locationName === item.locationName &&
      t.maintainableItemName === item.maintainableItemName
    )
  );
  
  // Sort by Location ID, then by Maintainable Item Name
  uniqueData.sort((a, b) => {
    const locationCompare = a.locationId.localeCompare(b.locationId);
    if (locationCompare !== 0) return locationCompare;
    return a.maintainableItemName.localeCompare(b.maintainableItemName);
  });
  
  const result: ObjectPartGroup[] = [];
  let currentLocationId = '';
  let maintainableItemIndex = 1;
  
  uniqueData.forEach((item, index) => {
    // Reset index when Location ID changes
    if (item.locationId !== currentLocationId) {
      maintainableItemIndex = 1;
      currentLocationId = item.locationId;
    } else {
      // Check if this is a different maintainable item for the same location
      const prevItem = uniqueData[index - 1];
      if (prevItem && prevItem.locationId === item.locationId && 
          prevItem.maintainableItemName !== item.maintainableItemName) {
        maintainableItemIndex++;
      }
    }
    
    // Convert index to alpha format (1->0A, 2->0B, ..., 27->AA)
    const maintainableItemAlpha = indexToAlpha(maintainableItemIndex);
    
    // Lookup Catalog Profile from Step 1
    const catalogProfileData = step1Data.find(cp => cp.locationId === item.locationId);
    const catalogProfile = catalogProfileData?.catalogProfile || '';
    
    // Get last 2 characters from Catalog Profile
    const last2Chars = catalogProfile.slice(-2);
    
    // Object Part Code Group (Asset Class Type ID + last 2 chars + Maintainable Item Alpha)
    const objectPartCodeGroup = item.assetClassTypeId + last2Chars + maintainableItemAlpha;
    
    result.push({
      id: `opg_${Date.now()}_${index}`,
      assetClassTypeId: item.assetClassTypeId,
      locationId: item.locationId,
      locationName: item.locationName,
      maintainableItemName: item.maintainableItemName,
      catalogProfile,
      maintainableItemIndex,
      maintainableItemAlpha,
      objectPartCodeGroup,
      objectPartGroupName: item.maintainableItemName
    });
  });
  
  return result;
};

// Convert index to alpha format
const indexToAlpha = (index: number): string => {
  if (index <= 26) {
    return '0' + String.fromCharCode(64 + index); // 0A, 0B, ..., 0Z
  } else {
    const firstChar = String.fromCharCode(64 + Math.floor((index - 1) / 26));
    const secondChar = String.fromCharCode(64 + ((index - 1) % 26) + 1);
    return firstChar + secondChar; // AA, AB, ...
  }
};

// Step 3: Process Damage Code Library
export const processStep3 = async (
  inputData: InputData[], 
  existingLibrary: DamageCodeLibrary[]
): Promise<{ library: DamageCodeLibrary[], conflicts: QAConflict[] }> => {
  // Extract unique failure mechanisms
  const uniqueMechanisms = [...new Set(inputData.map(item => item.failureMechanism))];
  uniqueMechanisms.sort();
  
  const conflicts: QAConflict[] = [];
  const library: DamageCodeLibrary[] = [...existingLibrary];
  
  // Fuzzy search setup
  const fuse = new Fuse(existingLibrary, {
    keys: ['failureMechanism', 'similarities'],
    threshold: 0.6,
    includeScore: true
  });
  
  for (const mechanism of uniqueMechanisms) {
    // Check if exact match exists
    const exactMatch = library.find(item => 
      item.failureMechanism === mechanism || 
      item.similarities.includes(mechanism)
    );
    
    if (exactMatch) continue;
    
    // Check for fuzzy matches
    const fuzzyMatches = fuse.search(mechanism);
    
    if (fuzzyMatches.length > 0 && fuzzyMatches[0].score! < 0.4) {
      // Create conflict for user resolution
      conflicts.push({
        id: `conflict_damage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'damage',
        originalName: mechanism,
        suggestedMatches: fuzzyMatches.slice(0, 3).map(match => ({
          name: match.item.failureMechanism,
          similarity: 1 - match.score!,
          code: match.item.damageCode
        })),
        resolved: false
      });
    } else {
      // Create new entry
      const indexNumber = library.length + 1;
      const numberCode = formatNumberCode(indexNumber);
      const damageCode = 'D' + numberCode;
      const uniqueSummingNumber = 100000 + indexNumber;
      
      library.push({
        id: `damage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        failureMechanism: mechanism,
        indexNumber,
        numberCode,
        damageCode,
        uniqueSummingNumber,
        similarities: [mechanism]
      });
    }
  }
  
  return { library, conflicts };
};

// Step 4: Process Cause Code Library
export const processStep4 = async (
  inputData: InputData[], 
  existingLibrary: CauseCodeLibrary[]
): Promise<{ library: CauseCodeLibrary[], conflicts: QAConflict[] }> => {
  // Extract unique failure causes
  const uniqueCauses = [...new Set(inputData.map(item => item.failureCause))];
  uniqueCauses.sort();
  
  const conflicts: QAConflict[] = [];
  const library: CauseCodeLibrary[] = [...existingLibrary];
  
  // Fuzzy search setup
  const fuse = new Fuse(existingLibrary, {
    keys: ['failureCause', 'similarities'],
    threshold: 0.6,
    includeScore: true
  });
  
  for (const cause of uniqueCauses) {
    // Check if exact match exists
    const exactMatch = library.find(item => 
      item.failureCause === cause || 
      item.similarities.includes(cause)
    );
    
    if (exactMatch) continue;
    
    // Check for fuzzy matches
    const fuzzyMatches = fuse.search(cause);
    
    if (fuzzyMatches.length > 0 && fuzzyMatches[0].score! < 0.4) {
      // Create conflict for user resolution
      conflicts.push({
        id: `conflict_cause_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'cause',
        originalName: cause,
        suggestedMatches: fuzzyMatches.slice(0, 3).map(match => ({
          name: match.item.failureCause,
          similarity: 1 - match.score!,
          code: match.item.causeCode
        })),
        resolved: false
      });
    } else {
      // Create new entry
      const indexNumber = library.length + 1;
      const numberCode = formatNumberCode(indexNumber);
      const causeCode = 'C' + numberCode;
      const uniqueSummingNumber = 200000 + indexNumber;
      
      library.push({
        id: `cause_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        failureCause: cause,
        indexNumber,
        numberCode,
        causeCode,
        uniqueSummingNumber,
        similarities: [cause]
      });
    }
  }
  
  return { library, conflicts };
};

// Format number code (001, 019, 199, A10 for 1000+)
const formatNumberCode = (index: number): string => {
  if (index <= 9) {
    return '00' + index;
  } else if (index <= 99) {
    return '0' + index;
  } else if (index <= 999) {
    return index.toString();
  } else {
    const letter = String.fromCharCode(64 + Math.floor(index / 1000));
    const number = (index % 1000).toString().padStart(2, '0');
    return letter + number;
  }
};

// Step 5: Failure Set Check
export const processStep5 = (
  inputData: InputData[],
  damageLibrary: DamageCodeLibrary[],
  causeLibrary: CauseCodeLibrary[]
): FailureSetCheck[] => {
  const result: FailureSetCheck[] = [];
  
  inputData.forEach((item, index) => {
    // Find mechanism scoring
    const damageEntry = damageLibrary.find(d => 
      d.failureMechanism === item.failureMechanism ||
      d.similarities.includes(item.failureMechanism)
    );
    const mechanismScoring = damageEntry?.uniqueSummingNumber || 0;
    
    // Find cause scoring
    const causeEntry = causeLibrary.find(c => 
      c.failureCause === item.failureCause ||
      c.similarities.includes(item.failureCause)
    );
    const causeScoring = causeEntry?.uniqueSummingNumber || 0;
    
    // Create combined key
    const locMiCompCombined = item.locationId + item.maintainableItemName + item.componentName;
    
    result.push({
      id: `fsc_${Date.now()}_${index}`,
      locationId: item.locationId,
      locationName: item.locationName,
      maintainableItemName: item.maintainableItemName,
      componentName: item.componentName,
      failureMechanism: item.failureMechanism,
      failureCause: item.failureCause,
      mechanismScoring,
      causeScoring,
      locMiCompCombined,
      mechanismSumCheck: 0, // Will be calculated after grouping
      causeSumCheck: 0 // Will be calculated after grouping
    });
  });
  
  // Calculate sum checks
  const groupedData = new Map<string, FailureSetCheck[]>();
  result.forEach(item => {
    if (!groupedData.has(item.locMiCompCombined)) {
      groupedData.set(item.locMiCompCombined, []);
    }
    groupedData.get(item.locMiCompCombined)!.push(item);
  });
  
  // Update sum checks
  groupedData.forEach((items, key) => {
    const mechanismSum = items.reduce((sum, item) => sum + item.mechanismScoring, 0);
    const causeSum = items.reduce((sum, item) => sum + item.causeScoring, 0);
    
    items.forEach(item => {
      item.mechanismSumCheck = mechanismSum;
      item.causeSumCheck = causeSum;
    });
  });
  
  return result;
};

// Step 6: Component Code Library
export const processStep6 = async (
  step5Data: FailureSetCheck[],
  existingLibrary: ComponentCodeLibrary[]
): Promise<{ library: ComponentCodeLibrary[], conflicts: QAConflict[] }> => {
  // Extract unique component data
  const uniqueComponents = step5Data.filter((item, index, self) => 
    index === self.findIndex(t => 
      t.componentName === item.componentName &&
      t.mechanismSumCheck === item.mechanismSumCheck &&
      t.causeSumCheck === item.causeSumCheck
    )
  );
  
  uniqueComponents.sort((a, b) => a.componentName.localeCompare(b.componentName));
  
  const conflicts: QAConflict[] = [];
  const library: ComponentCodeLibrary[] = [...existingLibrary];
  const existingCodes = library.map(item => item.objectPartCode);
  
  for (const component of uniqueComponents) {
    // Check for duplicates with different sum checks
    const duplicates = uniqueComponents.filter(c => c.componentName === component.componentName);
    const checkDuplicateCompDiffSumCheck = duplicates.length > 1;
    
    // Generate object part code using AI
    const codeResult = await generateComponentCode(component.componentName, existingCodes);
    const objectPartCode = codeResult.code;
    existingCodes.push(objectPartCode);
    
    // Generate group codes
    const damageCodeGroup = objectPartCode + 'C01';
    const causeCodeGroup = objectPartCode + '501';
    
    // Create combined key
    const compSumCheckCombine = component.componentName + component.mechanismSumCheck + component.causeSumCheck;
    
    library.push({
      id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      componentName: component.componentName,
      mechanismSumCheck: component.mechanismSumCheck,
      causeSumCheck: component.causeSumCheck,
      checkDuplicateCompDiffSumCheck,
      objectPartCode,
      damageCodeGroup,
      causeCodeGroup,
      compSumCheckCombine,
      similarities: [component.componentName]
    });
  }
  
  return { library, conflicts };
};

// Step 7: OP&D&C Code Allocations
export const processStep7 = (
  step5Data: FailureSetCheck[],
  damageLibrary: DamageCodeLibrary[],
  causeLibrary: CauseCodeLibrary[],
  componentLibrary: ComponentCodeLibrary[]
): CodeAllocation[] => {
  return step5Data.map((item, index) => {
    // Lookup damage code
    const damageEntry = damageLibrary.find(d => 
      d.failureMechanism === item.failureMechanism ||
      d.similarities.includes(item.failureMechanism)
    );
    const damageCode = damageEntry?.damageCode || '';
    
    // Lookup cause code
    const causeEntry = causeLibrary.find(c => 
      c.failureCause === item.failureCause ||
      c.similarities.includes(item.failureCause)
    );
    const causeCode = causeEntry?.causeCode || '';
    
    // Create combined key for component lookup
    const compSumCheckCombine = item.componentName + item.mechanismSumCheck + item.causeSumCheck;
    
    // Lookup component codes
    const componentEntry = componentLibrary.find(c => c.compSumCheckCombine === compSumCheckCombine);
    const objectPartCode = componentEntry?.objectPartCode || '';
    const damageCodeGroup = componentEntry?.damageCodeGroup || '';
    const causeCodeGroup = componentEntry?.causeCodeGroup || '';
    
    // Create lookup key
    const combiLookupOpCode = item.locationId + item.maintainableItemName + item.componentName;
    
    return {
      id: `ca_${Date.now()}_${index}`,
      locationId: item.locationId,
      locationName: item.locationName,
      maintainableItemName: item.maintainableItemName,
      componentName: item.componentName,
      failureMechanism: item.failureMechanism,
      failureCause: item.failureCause,
      mechanismSumCheck: item.mechanismSumCheck,
      causeSumCheck: item.causeSumCheck,
      damageCode,
      causeCode,
      compSumCheckCombine,
      objectPartCode,
      damageCodeGroup,
      causeCodeGroup,
      combiLookupOpCode
    };
  });
};

// Step 8: B Catalog
export const processStep8 = (
  step7Data: CodeAllocation[],
  step2Data: ObjectPartGroup[]
): BCatalog[] => {
  // Remove duplicates based on all four columns
  const uniqueData = step7Data.filter((item, index, self) => 
    index === self.findIndex(t => 
      t.locationId === item.locationId &&
      t.locationName === item.locationName &&
      t.maintainableItemName === item.maintainableItemName &&
      t.componentName === item.componentName
    )
  );
  
  return uniqueData.map((item, index) => {
    // Lookup Object Part Code Group from Step 2
    const step2Entry = step2Data.find(s2 => s2.maintainableItemName === item.maintainableItemName);
    const objectPartCodeGroup = step2Entry?.objectPartCodeGroup || '';
    
    // Create lookup key
    const combiLookupOpCode = item.locationId + item.maintainableItemName + item.componentName;
    
    // Lookup Object Part Code from Step 7
    const step7Entry = step7Data.find(s7 => s7.combiLookupOpCode === combiLookupOpCode);
    const objectPartCode = step7Entry?.objectPartCode || '';
    
    return {
      id: `bc_${Date.now()}_${index}`,
      locationId: item.locationId,
      locationName: item.locationName,
      maintainableItemName: item.maintainableItemName,
      componentName: item.componentName,
      objectPartCodeGroup,
      combiLookupOpCode,
      objectPartCode,
      codeGroup: objectPartCodeGroup,
      codeGroupDescription: item.maintainableItemName,
      code: objectPartCode,
      codeDescription: item.componentName
    };
  });
};

// Step 9: C Catalog
export const processStep9 = (step7Data: CodeAllocation[]): CCatalog[] => {
  // Remove duplicates based on all columns
  const uniqueData = step7Data.filter((item, index, self) => 
    index === self.findIndex(t => 
      t.locationId === item.locationId &&
      t.locationName === item.locationName &&
      t.maintainableItemName === item.maintainableItemName &&
      t.componentName === item.componentName &&
      t.failureMechanism === item.failureMechanism &&
      t.damageCode === item.damageCode &&
      t.damageCodeGroup === item.damageCodeGroup
    )
  );
  
  return uniqueData.map((item, index) => ({
    id: `cc_${Date.now()}_${index}`,
    locationId: item.locationId,
    locationName: item.locationName,
    maintainableItemName: item.maintainableItemName,
    componentName: item.componentName,
    failureMechanism: item.failureMechanism,
    damageCode: item.damageCode,
    damageCodeGroup: item.damageCodeGroup,
    codeGroup: item.damageCodeGroup,
    codeGroupDescription: item.componentName,
    code: item.damageCode,
    codeDescription: item.failureMechanism
  }));
};

// Step 10: 5 Catalog
export const processStep10 = (step7Data: CodeAllocation[]): FiveCatalog[] => {
  // Remove duplicates based on all columns
  const uniqueData = step7Data.filter((item, index, self) => 
    index === self.findIndex(t => 
      t.locationId === item.locationId &&
      t.locationName === item.locationName &&
      t.maintainableItemName === item.maintainableItemName &&
      t.componentName === item.componentName &&
      t.failureCause === item.failureCause &&
      t.causeCode === item.causeCode &&
      t.causeCodeGroup === item.causeCodeGroup
    )
  );
  
  return uniqueData.map((item, index) => ({
    id: `fc_${Date.now()}_${index}`,
    locationId: item.locationId,
    locationName: item.locationName,
    maintainableItemName: item.maintainableItemName,
    componentName: item.componentName,
    failureCause: item.failureCause,
    causeCode: item.causeCode,
    causeCodeGroup: item.causeCodeGroup,
    codeGroup: item.causeCodeGroup,
    codeGroupDescription: item.componentName,
    code: item.causeCode,
    codeDescription: item.failureCause
  }));
};

// Final Load Sheet View
export const processFinalLoadSheet = (
  step1Data: CatalogProfile[],
  step8Data: BCatalog[],
  step9Data: CCatalog[],
  step10Data: FiveCatalog[]
): SAPCatalogLoadsheet[] => {
  const result: SAPCatalogLoadsheet[] = [];
  
  // Add B Catalog data
  step8Data.forEach((item, index) => {
    const catalogProfile = step1Data.find(s1 => s1.locationId === item.locationId);
    
    result.push({
      id: `sap_b_${Date.now()}_${index}`,
      locationId: item.locationId,
      catalogProfile: catalogProfile?.catalogProfile || '',
      catalogProfileDescription: catalogProfile?.catalogProfileDescription || '',
      catalog: 'B',
      codeGroup: item.codeGroup,
      codeGroupDescription: item.codeGroupDescription,
      code: item.code,
      codeDescription: item.codeDescription,
      catalogSorting: 1,
      namingSorting: item.locationId + item.code + item.codeDescription
    });
  });
  
  // Add C Catalog data
  step9Data.forEach((item, index) => {
    const catalogProfile = step1Data.find(s1 => s1.locationId === item.locationId);
    
    result.push({
      id: `sap_c_${Date.now()}_${index}`,
      locationId: item.locationId,
      catalogProfile: catalogProfile?.catalogProfile || '',
      catalogProfileDescription: catalogProfile?.catalogProfileDescription || '',
      catalog: 'C',
      codeGroup: item.codeGroup,
      codeGroupDescription: item.codeGroupDescription,
      code: item.code,
      codeDescription: item.codeDescription,
      catalogSorting: 2,
      namingSorting: item.locationId + item.codeGroup.substring(0, 4) + item.codeGroupDescription
    });
  });
  
  // Add 5 Catalog data
  step10Data.forEach((item, index) => {
    const catalogProfile = step1Data.find(s1 => s1.locationId === item.locationId);
    
    result.push({
      id: `sap_5_${Date.now()}_${index}`,
      locationId: item.locationId,
      catalogProfile: catalogProfile?.catalogProfile || '',
      catalogProfileDescription: catalogProfile?.catalogProfileDescription || '',
      catalog: '5',
      codeGroup: item.codeGroup,
      codeGroupDescription: item.codeGroupDescription,
      code: item.code,
      codeDescription: item.codeDescription,
      catalogSorting: 3,
      namingSorting: item.locationId + item.codeGroup.substring(0, 4) + item.codeGroupDescription
    });
  });
  
  // Sort the final result
  result.sort((a, b) => {
    const locationCompare = a.locationId.localeCompare(b.locationId);
    if (locationCompare !== 0) return locationCompare;
    
    const namingCompare = a.namingSorting.localeCompare(b.namingSorting);
    if (namingCompare !== 0) return namingCompare;
    
    return a.catalogSorting - b.catalogSorting;
  });
  
  // Remove duplicates
  return result.filter((item, index, self) => 
    index === self.findIndex(t => 
      t.locationId === item.locationId &&
      t.catalogProfile === item.catalogProfile &&
      t.catalogProfileDescription === item.catalogProfileDescription &&
      t.catalog === item.catalog &&
      t.codeGroup === item.codeGroup &&
      t.codeGroupDescription === item.codeGroupDescription &&
      t.code === item.code &&
      t.codeDescription === item.codeDescription
    )
  );
};