// Local storage utilities for data persistence
import { 
  ProcessingSession, 
  DamageCodeLibrary, 
  CauseCodeLibrary, 
  ComponentCodeLibrary,
  AIModelPerformance,
  ComponentCodeTrainingData
} from '../types';

const STORAGE_KEYS = {
  PROCESSING_SESSIONS: 'sap_processing_sessions',
  DAMAGE_CODE_LIBRARY: 'sap_damage_code_library',
  CAUSE_CODE_LIBRARY: 'sap_cause_code_library',
  COMPONENT_CODE_LIBRARY: 'sap_component_code_library',
  AI_MODEL_PERFORMANCE: 'sap_ai_model_performance',
  COMPONENT_TRAINING_DATA: 'sap_component_training_data'
};

// Generic storage functions
export const saveToStorage = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to storage:', error);
  }
};

export const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.error('Error loading from storage:', error);
    return defaultValue;
  }
};

// Processing Sessions
export const saveProcessingSession = (session: ProcessingSession): void => {
  const sessions = loadProcessingSessions();
  const existingIndex = sessions.findIndex(s => s.id === session.id);
  
  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.push(session);
  }
  
  saveToStorage(STORAGE_KEYS.PROCESSING_SESSIONS, sessions);
};

export const loadProcessingSessions = (): ProcessingSession[] => {
  return loadFromStorage(STORAGE_KEYS.PROCESSING_SESSIONS, []);
};

export const getProcessingSession = (id: string): ProcessingSession | null => {
  const sessions = loadProcessingSessions();
  return sessions.find(s => s.id === id) || null;
};

// Damage Code Library
export const saveDamageCodeLibrary = (library: DamageCodeLibrary[]): void => {
  saveToStorage(STORAGE_KEYS.DAMAGE_CODE_LIBRARY, library);
};

export const loadDamageCodeLibrary = (): DamageCodeLibrary[] => {
  return loadFromStorage(STORAGE_KEYS.DAMAGE_CODE_LIBRARY, []);
};

export const addToDamageCodeLibrary = (item: DamageCodeLibrary): void => {
  const library = loadDamageCodeLibrary();
  const existingIndex = library.findIndex(l => l.id === item.id);
  
  if (existingIndex >= 0) {
    library[existingIndex] = item;
  } else {
    library.push(item);
  }
  
  saveDamageCodeLibrary(library);
};

// Cause Code Library
export const saveCauseCodeLibrary = (library: CauseCodeLibrary[]): void => {
  saveToStorage(STORAGE_KEYS.CAUSE_CODE_LIBRARY, library);
};

export const loadCauseCodeLibrary = (): CauseCodeLibrary[] => {
  return loadFromStorage(STORAGE_KEYS.CAUSE_CODE_LIBRARY, []);
};

export const addToCauseCodeLibrary = (item: CauseCodeLibrary): void => {
  const library = loadCauseCodeLibrary();
  const existingIndex = library.findIndex(l => l.id === item.id);
  
  if (existingIndex >= 0) {
    library[existingIndex] = item;
  } else {
    library.push(item);
  }
  
  saveCauseCodeLibrary(library);
};

// Component Code Library
export const saveComponentCodeLibrary = (library: ComponentCodeLibrary[]): void => {
  saveToStorage(STORAGE_KEYS.COMPONENT_CODE_LIBRARY, library);
};

export const loadComponentCodeLibrary = (): ComponentCodeLibrary[] => {
  return loadFromStorage(STORAGE_KEYS.COMPONENT_CODE_LIBRARY, []);
};

export const addToComponentCodeLibrary = (item: ComponentCodeLibrary): void => {
  const library = loadComponentCodeLibrary();
  const existingIndex = library.findIndex(l => l.id === item.id);
  
  if (existingIndex >= 0) {
    library[existingIndex] = item;
  } else {
    library.push(item);
  }
  
  saveComponentCodeLibrary(library);
};

// AI Model Performance
export const saveAIModelPerformance = (performance: AIModelPerformance[]): void => {
  saveToStorage(STORAGE_KEYS.AI_MODEL_PERFORMANCE, performance);
};

export const loadAIModelPerformance = (): AIModelPerformance[] => {
  return loadFromStorage(STORAGE_KEYS.AI_MODEL_PERFORMANCE, []);
};

export const addAIModelPerformance = (item: AIModelPerformance): void => {
  const performance = loadAIModelPerformance();
  performance.push(item);
  saveAIModelPerformance(performance);
};

// Component Training Data
export const saveComponentTrainingData = (data: ComponentCodeTrainingData[]): void => {
  saveToStorage(STORAGE_KEYS.COMPONENT_TRAINING_DATA, data);
};

export const loadComponentTrainingData = (): ComponentCodeTrainingData[] => {
  return loadFromStorage(STORAGE_KEYS.COMPONENT_TRAINING_DATA, []);
};

// Clear all data
export const clearAllData = (): void => {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
};