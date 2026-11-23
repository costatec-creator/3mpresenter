import path from 'node:path';
import fs from 'node:fs';
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { LocalSqliteDatabase } from '../../src/database/sqliteCore.js';
import { ensureColetaneaImported, ensureHinarioImported } from '../../src/database/importHinario.js';
import type {
  AppSettings,
  BackupPayload,
  CollectionType,
  DisplayInfo,
  HymnSectionType,
  ProjectionState,
} from '../../src/types/index.js';

let mainWindow: BrowserWindow | null = null;
let projectionWindow: BrowserWindow | null = null;
let db: LocalSqliteDatabase;

let projectionState: ProjectionState = {
  isScreenOpen: false,
  isBlackScreen: false,
  liveSlide: {
    type: 'idle',
    title: '',
    subtitle: '',
    body: '',
  },
  updatedAt: new Date().toISOString(),
};

function getPreloadPath(): string {
  return path.join(__dirname, 'preload.cjs');
}

function getRendererIndexPath(): string {
  return path.join(app.getAppPath(), 'dist', 'index.html');
}

function getAppIconPath(): string | undefined {
  const candidates = [
    path.join(process.resourcesPath ?? '', 'icon.ico'),
    path.join(process.resourcesPath ?? '', 'icon.png'),
    path.join(app.getAppPath(), 'electron', 'assets', 'icon.ico'),
    path.join(app.getAppPath(), 'electron', 'assets', 'icon.png'),
    path.join(app.getAppPath(), 'dist', 'favicon.png'),
  ];
  return candidates.find((p) => p && fs.existsSync(p));
}

function getDisplaysList(): DisplayInfo[] {
  const primary = screen.getPrimaryDisplay();
  const displays = screen.getAllDisplays();
  return displays.map((d, index) => ({
    id: String(d.id),
    name: d.label || `Monitor ${index + 1}`,
    width: d.size.width,
    height: d.size.height,
    isPrimary: d.id === primary.id,
    scaleFactor: d.scaleFactor,
  }));
}

function broadcastProjectionState(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('projection:state-changed', projectionState);
  }
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.webContents.send('projection:state-changed', projectionState);
  }
}

function broadcastSettingsChanged(settings: AppSettings): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings:changed', settings);
  }
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.webContents.send('settings:changed', settings);
  }
}

function createMainWindow(): void {
  const iconPath = getAppIconPath();
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1080,
    minHeight: 700,
    title: '3MPresenter — Painel de Controlo',
    icon: iconPath,
    backgroundColor: '#FAF9F5',
    autoHideMenuBar: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(getRendererIndexPath());
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (projectionWindow && !projectionWindow.isDestroyed()) {
      projectionWindow.close();
    }
  });
}

function openProjectionWindow(): void {
  const settings = db.getSettings();
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();

  let targetDisplay = displays.find((d) => String(d.id) === settings.projection_display_id);
  if (!targetDisplay) {
    targetDisplay = displays.find((d) => d.id !== primary.id) || primary;
  }

  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.setBounds(targetDisplay.bounds);
    projectionWindow.setFullScreen(true);
    projectionWindow.show();
    projectionWindow.focus();
    projectionState = {
      ...projectionState,
      isScreenOpen: true,
      updatedAt: new Date().toISOString(),
    };
    broadcastProjectionState();
    return;
  }

  const iconPath = getAppIconPath();
  projectionWindow = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    width: targetDisplay.bounds.width,
    height: targetDisplay.bounds.height,
    fullscreen: true,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    title: '3MPresenter — Ecrã de Projecção',
    icon: iconPath,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  projectionWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') {
      event.preventDefault();
      closeProjectionWindow();
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    projectionWindow.loadURL(`${devUrl}?screen=projection`);
  } else {
    projectionWindow.loadFile(getRendererIndexPath(), {
      search: 'screen=projection',
    });
  }

  projectionWindow.once('ready-to-show', () => {
    if (projectionWindow && !projectionWindow.isDestroyed()) {
      projectionWindow.setFullScreen(true);
      projectionWindow.show();
      projectionWindow.focus();
      projectionWindow.webContents.send('projection:state-changed', projectionState);
      projectionWindow.webContents.send('settings:changed', db.getSettings());
    }
  });

  projectionWindow.on('closed', () => {
    projectionWindow = null;
    projectionState = {
      ...projectionState,
      isScreenOpen: false,
      updatedAt: new Date().toISOString(),
    };
    broadcastProjectionState();
  });

  projectionState = {
    ...projectionState,
    isScreenOpen: true,
    updatedAt: new Date().toISOString(),
  };
  broadcastProjectionState();
}

function closeProjectionWindow(): void {
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.close();
    projectionWindow = null;
  }
  projectionState = {
    ...projectionState,
    isScreenOpen: false,
    updatedAt: new Date().toISOString(),
  };
  broadcastProjectionState();
}

function registerIpcHandlers(): void {
  // Programs
  ipcMain.handle('programs:list', () => db.listPrograms());
  ipcMain.handle('programs:get', (_e, id: string) => db.getProgram(String(id)));
  ipcMain.handle('programs:create', (_e, input: { title: string; date: string; description?: string }) =>
    db.createProgram(input)
  );
  ipcMain.handle('programs:update', (_e, id: string, input: { title: string; date: string; description?: string }) =>
    db.updateProgram(String(id), input)
  );
  ipcMain.handle(
    'programs:duplicate',
    (_e, id: string, input: { title: string; date: string; description?: string }) =>
      db.duplicateProgram(String(id), input)
  );
  ipcMain.handle('programs:delete', (_e, id: string) => db.deleteProgram(String(id)));

  // Activities
  ipcMain.handle(
    'activities:create',
    (_e, programId: string, input: { name: string; activist: string; role?: string; hymn_id?: string | null }) =>
      db.createActivity(String(programId), input)
  );
  ipcMain.handle(
    'activities:update',
    (_e, id: string, input: { name: string; activist: string; role?: string; hymn_id?: string | null }) =>
      db.updateActivity(String(id), input)
  );
  ipcMain.handle('activities:delete', (_e, id: string) => db.deleteActivity(String(id)));
  ipcMain.handle('activities:reorder', (_e, programId: string, orderedIds: string[]) =>
    db.reorderActivities(String(programId), orderedIds)
  );

  // Announcements
  ipcMain.handle('announcements:list', () => db.listAnnouncements());
  ipcMain.handle('announcements:create', (_e, input: { title: string; content: string }) =>
    db.createAnnouncement(input)
  );
  ipcMain.handle('announcements:update', (_e, id: string, input: { title: string; content: string }) =>
    db.updateAnnouncement(String(id), input)
  );
  ipcMain.handle('announcements:delete', (_e, id: string) => db.deleteAnnouncement(String(id)));

  // Folders
  ipcMain.handle('folders:list', (_e, collectionType?: CollectionType) => db.listFolders(collectionType));
  ipcMain.handle('folders:create', (_e, input: { name: string; collection_type: CollectionType }) =>
    db.createFolder(input)
  );
  ipcMain.handle('folders:delete', (_e, id: string) => db.deleteFolder(String(id)));

  // Hymns
  ipcMain.handle('hymns:list', () => db.listHymns());
  ipcMain.handle('hymns:get', (_e, id: string) => db.getHymn(String(id)));
  ipcMain.handle(
    'hymns:create',
    (
      _e,
      input: {
        number: string;
        collection_type: CollectionType;
        title: string;
        author?: string;
        folder_id?: string | null;
        folder_name?: string;
        sections: Array<{ section_type: HymnSectionType; content: string }>;
        adminPin?: string;
      }
    ) => db.createHymn(input)
  );
  ipcMain.handle(
    'hymns:update',
    (
      _e,
      id: string,
      input: {
        number: string;
        collection_type: CollectionType;
        title: string;
        author?: string;
        folder_id?: string | null;
        folder_name?: string;
        sections: Array<{ section_type: HymnSectionType; content: string }>;
        adminPin?: string;
      }
    ) => db.updateHymn(String(id), input)
  );
  ipcMain.handle('hymns:duplicate-outros', (_e, id: string) => db.duplicateHymnToOutros(String(id)));
  ipcMain.handle('hymns:delete', (_e, id: string, adminPin?: string) => db.deleteHymn(String(id), adminPin));

  // Admin PIN
  ipcMain.handle('admin:verify-pin', (_e, pin: string) => ({ valid: db.verifyAdminPin(String(pin ?? '')) }));
  ipcMain.handle('admin:change-pin', (_e, currentPin: string, newPin: string) => {
    db.changeAdminPin(String(currentPin ?? ''), String(newPin ?? ''));
    return { ok: true };
  });

  // Settings
  ipcMain.handle('settings:get', () => db.getSettings());
  ipcMain.handle('settings:save', (_e, partial: Partial<AppSettings>) => {
    const updated = db.saveSettings(partial);
    broadcastSettingsChanged(updated);
    return updated;
  });

  // Displays
  ipcMain.handle('displays:list', () => getDisplaysList());

  // Backup
  ipcMain.handle('backup:export', () => db.exportBackup());
  ipcMain.handle('backup:restore', (_e, payload: BackupPayload) => {
    db.restoreBackup(payload);
    broadcastSettingsChanged(db.getSettings());
    return { ok: true, message: 'Cópia de segurança restaurada com sucesso.' };
  });

  // Projection
  ipcMain.handle('projection:get-state', () => projectionState);
  ipcMain.handle('projection:set-state', (_e, patch: Partial<ProjectionState>) => {
    projectionState = {
      ...projectionState,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    broadcastProjectionState();
    return projectionState;
  });
  ipcMain.handle('projection:open-screen', () => {
    openProjectionWindow();
    return projectionState;
  });
  ipcMain.handle('projection:close-screen', () => {
    closeProjectionWindow();
    return projectionState;
  });
}

app.setAppUserModelId('com.3mpresenter.app');

app.whenReady().then(async () => {
  const userDataDir = app.getPath('userData');
  const dbFile = path.join(userDataDir, '3mpresenter.db');
  const wasmCandidates = [
    path.join(process.resourcesPath ?? '', 'sql-wasm.wasm'),
    path.join(app.getAppPath(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
  ];
  const wasmPath = wasmCandidates.find((p) => p && fs.existsSync(p));

  db = await LocalSqliteDatabase.create(dbFile, wasmPath);

  const candidateAssetDirs = [
    path.join(app.getAppPath(), 'dist', 'assets', 'aistudio'),
    path.join(app.getAppPath(), 'public', 'assets', 'aistudio'),
    path.join(process.resourcesPath ?? '', 'assets', 'aistudio'),
  ];
  ensureHinarioImported(db, candidateAssetDirs);
  ensureColetaneaImported(db, candidateAssetDirs);

  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
