
import { PipelineItem, HistoryItem, AlertItem } from "../types";

const KEYS = {
  HISTORY: 'scout_history_v1',
  PIPELINE: 'scout_pipeline_v1',
  ALERTS: 'scout_alerts_v1',
  CHECKPOINT_PREFIX: 'scout_checkpoint_',
  GLOBAL_CACHE: 'scout_global_cache_'
};

// --- CACHE GENÉRICO COM EXPIRAÇÃO (PADRÃO: 24 HORAS) ---
export const setGlobalCache = (key: string, data: any) => {
  const entry = {
    timestamp: Date.now(),
    data: data
  };
  localStorage.setItem(`${KEYS.GLOBAL_CACHE}${key}`, JSON.stringify(entry));
};

export const getGlobalCache = (key: string, ttlMs: number = 86400000) => { // 86.400.000ms = 24h
  const raw = localStorage.getItem(`${KEYS.GLOBAL_CACHE}${key}`);
  if (!raw) return null;
  
  try {
    const entry = JSON.parse(raw);
    const age = Date.now() - entry.timestamp;
    
    if (age > ttlMs) {
      localStorage.removeItem(`${KEYS.GLOBAL_CACHE}${key}`);
      return null;
    }
    return entry.data;
  } catch (e) {
    return null;
  }
};

// --- DOSSIER CHECKPOINTS (RESUME CAPABILITY) ---
export interface DossierCheckpoint {
  companyName: string;
  plan: Array<{ title: string; objective: string }>;
  completedSections: Record<number, string>; // Index -> Markdown Content
  accumulatedCost: number;
  lastUpdated: string;
}

export const saveDossierCheckpoint = (companyName: string, data: DossierCheckpoint) => {
  const safeName = companyName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  localStorage.setItem(`${KEYS.CHECKPOINT_PREFIX}${safeName}`, JSON.stringify(data));
};

export const getDossierCheckpoint = (companyName: string): DossierCheckpoint | null => {
  const safeName = companyName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const found = localStorage.getItem(`${KEYS.CHECKPOINT_PREFIX}${safeName}`);
  return found ? JSON.parse(found) : null;
};

export const clearDossierCheckpoint = (companyName: string) => {
  const safeName = companyName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  localStorage.removeItem(`${KEYS.CHECKPOINT_PREFIX}${safeName}`);
};

// --- HISTORY ---
export const getHistory = (): HistoryItem[] => {
  try {
    return JSON.parse(localStorage.getItem(KEYS.HISTORY) || '[]');
  } catch { return []; }
};

export const addToHistory = (item: HistoryItem) => {
  const history = getHistory();
  const newHistory = [item, ...history].slice(0, 50); // Max 50 items
  localStorage.setItem(KEYS.HISTORY, JSON.stringify(newHistory));
};

export const clearHistory = () => localStorage.removeItem(KEYS.HISTORY);

// --- PIPELINE (KANBAN) ---
export const getPipeline = (): PipelineItem[] => {
  try {
    return JSON.parse(localStorage.getItem(KEYS.PIPELINE) || '[]');
  } catch { return []; }
};

export const savePipeline = (items: PipelineItem[]) => {
  localStorage.setItem(KEYS.PIPELINE, JSON.stringify(items));
};

export const updatePipelineStage = (id: string, stage: PipelineItem['stage']) => {
  const items = getPipeline();
  const updated = items.map(i => i.id === id ? { ...i, stage, lastUpdated: new Date().toISOString() } : i);
  savePipeline(updated);
};

// --- ALERTS ---
export const getAlerts = (): AlertItem[] => {
  try {
    return JSON.parse(localStorage.getItem(KEYS.ALERTS) || '[]');
  } catch { return []; }
};

export const addAlert = (alert: AlertItem) => {
  const alerts = getAlerts();
  localStorage.setItem(KEYS.ALERTS, JSON.stringify([...alerts, alert]));
};

// --- IMPORT / EXPORT ---
export const exportData = () => {
  const data = {
    history: getHistory(),
    pipeline: getPipeline(),
    alerts: getAlerts(),
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `senior_scout_backup_${new Date().toISOString().slice(0,10)}.json`;
  link.click();
};

export const importData = (jsonString: string) => {
  try {
    const data = JSON.parse(jsonString);
    if (data.history) localStorage.setItem(KEYS.HISTORY, JSON.stringify(data.history));
    if (data.pipeline) localStorage.setItem(KEYS.PIPELINE, JSON.stringify(data.pipeline));
    if (data.alerts) localStorage.setItem(KEYS.ALERTS, JSON.stringify(data.alerts));
    return true;
  } catch (e) {
    console.error("Import error", e);
    return false;
  }
};
