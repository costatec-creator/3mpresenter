import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppSettings,
  BackupPayload,
  CollectionType,
  ElectronAPI,
  HymnSectionType,
  ProjectionState,
} from '../../src/types/index.js';

const api: ElectronAPI = {
  isElectron: true,
  programs: {
    list: () => ipcRenderer.invoke('programs:list'),
    get: (id: string) => ipcRenderer.invoke('programs:get', id),
    create: (input) => ipcRenderer.invoke('programs:create', input),
    update: (id, input) => ipcRenderer.invoke('programs:update', id, input),
    duplicate: (id, input) => ipcRenderer.invoke('programs:duplicate', id, input),
    delete: (id) => ipcRenderer.invoke('programs:delete', id),
  },
  activities: {
    create: (programId, input) => ipcRenderer.invoke('activities:create', programId, input),
    update: (id, input) => ipcRenderer.invoke('activities:update', id, input),
    delete: (id) => ipcRenderer.invoke('activities:delete', id),
    reorder: (programId, orderedIds) => ipcRenderer.invoke('activities:reorder', programId, orderedIds),
  },
  announcements: {
    list: () => ipcRenderer.invoke('announcements:list'),
    create: (input) => ipcRenderer.invoke('announcements:create', input),
    update: (id, input) => ipcRenderer.invoke('announcements:update', id, input),
    delete: (id) => ipcRenderer.invoke('announcements:delete', id),
  },
  folders: {
    list: (collectionType?: CollectionType) => ipcRenderer.invoke('folders:list', collectionType),
    create: (input) => ipcRenderer.invoke('folders:create', input),
    delete: (id) => ipcRenderer.invoke('folders:delete', id),
  },
  hymns: {
    list: () => ipcRenderer.invoke('hymns:list'),
    get: (id) => ipcRenderer.invoke('hymns:get', id),
    create: (input: {
      number: string;
      collection_type: CollectionType;
      title: string;
      author?: string;
      folder_id?: string | null;
      folder_name?: string;
      sections: Array<{ section_type: HymnSectionType; content: string }>;
      adminPin?: string;
    }) => ipcRenderer.invoke('hymns:create', input),
    update: (id, input) => ipcRenderer.invoke('hymns:update', id, input),
    duplicateToOutros: (id: string) => ipcRenderer.invoke('hymns:duplicate-outros', id),
    delete: (id: string, adminPin?: string) => ipcRenderer.invoke('hymns:delete', id, adminPin),
  },
  admin: {
    verifyPin: (pin: string) => ipcRenderer.invoke('admin:verify-pin', pin),
    changePin: (currentPin: string, newPin: string) =>
      ipcRenderer.invoke('admin:change-pin', currentPin, newPin),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings) => ipcRenderer.invoke('settings:save', settings),
  },
  displays: {
    list: () => ipcRenderer.invoke('displays:list'),
  },
  backup: {
    exportData: () => ipcRenderer.invoke('backup:export'),
    restoreData: (payload: BackupPayload) => ipcRenderer.invoke('backup:restore', payload),
  },
  projection: {
    getState: () => ipcRenderer.invoke('projection:get-state'),
    setState: (state: Partial<ProjectionState>) => ipcRenderer.invoke('projection:set-state', state),
    openScreen: () => ipcRenderer.invoke('projection:open-screen'),
    closeScreen: () => ipcRenderer.invoke('projection:close-screen'),
    onStateChanged: (callback: (state: ProjectionState) => void) => {
      const listener = (_event: unknown, state: ProjectionState) => callback(state);
      ipcRenderer.on('projection:state-changed', listener);
      return () => ipcRenderer.removeListener('projection:state-changed', listener);
    },
    onSettingsChanged: (callback: (settings: AppSettings) => void) => {
      const listener = (_event: unknown, settings: AppSettings) => callback(settings);
      ipcRenderer.on('settings:changed', listener);
      return () => ipcRenderer.removeListener('settings:changed', listener);
    },
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
