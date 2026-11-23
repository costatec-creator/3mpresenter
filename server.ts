import path from 'node:path';
import fs from 'node:fs';
import express, { type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { LocalSqliteDatabase } from './src/database/sqliteCore.ts';
import { ensureColetaneaImported, ensureHinarioImported } from './src/database/importHinario.ts';
import type { ProjectionState } from './src/types/index.ts';

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = path.resolve(process.cwd(), 'data', '3mpresenter.db');

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

const sseClients = new Set<Response>();

function broadcastEvent(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

async function startServer(): Promise<void> {
  const db = await LocalSqliteDatabase.create(DB_PATH);
  const candidateAssetDirs = [
    path.resolve(process.cwd(), 'public', 'assets', 'aistudio'),
    path.resolve(process.cwd(), 'dist', 'assets', 'aistudio'),
  ];
  const importResult = ensureHinarioImported(db, candidateAssetDirs);
  if (importResult && importResult.inserted > 0) {
    console.log(
      `3MPresenter: ${importResult.inserted} hinos importados de ${importResult.totalFiles} ficheiros.`
    );
  }
  const coletaneaResult = ensureColetaneaImported(db, candidateAssetDirs);
  if (coletaneaResult && coletaneaResult.inserted > 0) {
    console.log(
      `3MPresenter: ${coletaneaResult.inserted} cânticos da Coletânea Jovem importados de ${coletaneaResult.totalFiles} ficheiros.`
    );
  }
  const app = express();

  app.use(express.json({ limit: '25mb' }));

  // Health
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, app: '3MPresenter' });
  });

  // SSE stream for real-time projection & settings sync
  app.get('/api/projection/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.add(res);
    res.write(`event: projection\ndata: ${JSON.stringify(projectionState)}\n\n`);
    res.write(`event: settings\ndata: ${JSON.stringify(db.getSettings())}\n\n`);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // Projection State
  app.get('/api/projection', (_req: Request, res: Response) => {
    res.json(projectionState);
  });

  app.post('/api/projection', (req: Request, res: Response) => {
    const patch = req.body as Partial<ProjectionState>;
    projectionState = {
      ...projectionState,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    broadcastEvent('projection', projectionState);
    res.json(projectionState);
  });

  // Programs
  app.get('/api/programs', (_req: Request, res: Response) => {
    res.json(db.listPrograms());
  });

  app.get('/api/programs/:id', (req: Request, res: Response) => {
    const prog = db.getProgram(String(req.params.id));
    if (!prog) {
      res.status(404).json({ error: 'Programa não encontrado.' });
      return;
    }
    res.json(prog);
  });

  app.post('/api/programs', (req: Request, res: Response) => {
    try {
      const { title, date, description } = req.body;
      if (!title || !String(title).trim()) {
        res.status(400).json({ error: 'O título do programa é obrigatório.' });
        return;
      }
      const created = db.createProgram({ title, date, description });
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao criar programa.' });
    }
  });

  app.put('/api/programs/:id', (req: Request, res: Response) => {
    try {
      const { title, date, description } = req.body;
      if (!title || !String(title).trim()) {
        res.status(400).json({ error: 'O título do programa é obrigatório.' });
        return;
      }
      const updated = db.updateProgram(String(req.params.id), { title, date, description });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao actualizar programa.' });
    }
  });

  app.post('/api/programs/:id/duplicate', (req: Request, res: Response) => {
    try {
      const { title, date, description } = req.body;
      if (!title || !String(title).trim()) {
        res.status(400).json({ error: 'O novo título do programa é obrigatório.' });
        return;
      }
      const duplicated = db.duplicateProgram(String(req.params.id), { title, date, description });
      res.status(201).json(duplicated);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao duplicar programa.' });
    }
  });

  app.delete('/api/programs/:id', (req: Request, res: Response) => {
    db.deleteProgram(String(req.params.id));
    res.json({ ok: true });
  });

  // Activities
  app.post('/api/programs/:programId/activities', (req: Request, res: Response) => {
    try {
      const { name, activist, role, hymn_id } = req.body;
      if (!name || !String(name).trim() || !activist || !String(activist).trim()) {
        res.status(400).json({ error: 'O nome da actividade e do activista são obrigatórios.' });
        return;
      }
      const created = db.createActivity(String(req.params.programId), { name, activist, role, hymn_id });
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao adicionar actividade.' });
    }
  });

  app.put('/api/activities/:id', (req: Request, res: Response) => {
    try {
      const { name, activist, role, hymn_id } = req.body;
      if (!name || !String(name).trim() || !activist || !String(activist).trim()) {
        res.status(400).json({ error: 'O nome da actividade e do activista são obrigatórios.' });
        return;
      }
      const updated = db.updateActivity(String(req.params.id), { name, activist, role, hymn_id });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao actualizar actividade.' });
    }
  });

  app.delete('/api/activities/:id', (req: Request, res: Response) => {
    db.deleteActivity(String(req.params.id));
    res.json({ ok: true });
  });

  app.post('/api/programs/:programId/activities/reorder', (req: Request, res: Response) => {
    try {
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) {
        res.status(400).json({ error: 'Lista de ordem inválida.' });
        return;
      }
      const list = db.reorderActivities(String(req.params.programId), orderedIds);
      res.json(list);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao reordenar actividades.' });
    }
  });

  // Announcements
  app.get('/api/announcements', (_req: Request, res: Response) => {
    res.json(db.listAnnouncements());
  });

  app.post('/api/announcements', (req: Request, res: Response) => {
    try {
      const { title, content } = req.body;
      if (!title || !String(title).trim() || !content || !String(content).trim()) {
        res.status(400).json({ error: 'O título e o conteúdo do anúncio são obrigatórios.' });
        return;
      }
      const created = db.createAnnouncement({ title, content });
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao criar anúncio.' });
    }
  });

  app.put('/api/announcements/:id', (req: Request, res: Response) => {
    try {
      const { title, content } = req.body;
      if (!title || !String(title).trim() || !content || !String(content).trim()) {
        res.status(400).json({ error: 'O título e o conteúdo do anúncio são obrigatórios.' });
        return;
      }
      const updated = db.updateAnnouncement(String(req.params.id), { title, content });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao actualizar anúncio.' });
    }
  });

  app.delete('/api/announcements/:id', (req: Request, res: Response) => {
    db.deleteAnnouncement(String(req.params.id));
    res.json({ ok: true });
  });

  // Folders
  app.get('/api/folders', (req: Request, res: Response) => {
    const collectionType = req.query.collectionType as 'Hinário' | 'Coletânea' | 'Outros' | undefined;
    res.json(db.listFolders(collectionType));
  });

  app.post('/api/folders', (req: Request, res: Response) => {
    try {
      const { name, collection_type } = req.body;
      if (!name || !String(name).trim() || !collection_type) {
        res.status(400).json({ error: 'Nome da pasta e colecção são obrigatórios.' });
        return;
      }
      const folder = db.createFolder({ name, collection_type });
      res.status(201).json(folder);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao criar pasta.' });
    }
  });

  app.delete('/api/folders/:id', (req: Request, res: Response) => {
    db.deleteFolder(String(req.params.id));
    res.json({ ok: true });
  });

  // Hymns
  app.get('/api/hymns', (_req: Request, res: Response) => {
    res.json(db.listHymns());
  });

  app.get('/api/hymns/:id', (req: Request, res: Response) => {
    const hymn = db.getHymn(String(req.params.id));
    if (!hymn) {
      res.status(404).json({ error: 'Hino não encontrado.' });
      return;
    }
    res.json(hymn);
  });

  app.post('/api/hymns', (req: Request, res: Response) => {
    try {
      const { number, collection_type, title, author, folder_id, folder_name, sections, adminPin } = req.body;
      const pin = typeof adminPin === 'string' ? adminPin : (req.header('x-admin-pin') ?? undefined);
      if (!number || !String(number).trim() || !title || !String(title).trim()) {
        res.status(400).json({ error: 'O número e o título do hino são obrigatórios.' });
        return;
      }
      if (!Array.isArray(sections) || sections.length === 0) {
        res.status(400).json({ error: 'Adicione pelo menos uma estrofe ou coro.' });
        return;
      }
      const created = db.createHymn({
        number,
        collection_type,
        title,
        author,
        folder_id,
        folder_name,
        sections,
        adminPin: pin,
      });
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao guardar hino.' });
    }
  });

  app.put('/api/hymns/:id', (req: Request, res: Response) => {
    try {
      const { number, collection_type, title, author, folder_id, folder_name, sections, adminPin } = req.body;
      const pin = typeof adminPin === 'string' ? adminPin : (req.header('x-admin-pin') ?? undefined);
      if (!number || !String(number).trim() || !title || !String(title).trim()) {
        res.status(400).json({ error: 'O número e o título do hino são obrigatórios.' });
        return;
      }
      if (!Array.isArray(sections) || sections.length === 0) {
        res.status(400).json({ error: 'Adicione pelo menos uma estrofe ou coro.' });
        return;
      }
      const updated = db.updateHymn(String(req.params.id), {
        number,
        collection_type,
        title,
        author,
        folder_id,
        folder_name,
        sections,
        adminPin: pin,
      });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao actualizar hino.' });
    }
  });

  app.post('/api/hymns/:id/duplicate-outros', (req: Request, res: Response) => {
    try {
      const duplicated = db.duplicateHymnToOutros(String(req.params.id));
      res.status(201).json(duplicated);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao duplicar hino.' });
    }
  });

  app.delete('/api/hymns/:id', (req: Request, res: Response) => {
    try {
      const pin =
        (typeof req.body?.adminPin === 'string' ? req.body.adminPin : undefined) ??
        req.header('x-admin-pin') ??
        undefined;
      db.deleteHymn(String(req.params.id), pin);
      res.json({ ok: true });
    } catch (err) {
      res.status(403).json({ error: err instanceof Error ? err.message : 'Erro ao eliminar hino.' });
    }
  });

  // Admin PIN
  app.post('/api/admin/verify-pin', (req: Request, res: Response) => {
    const { pin } = req.body as { pin?: string };
    res.json({ valid: db.verifyAdminPin(String(pin ?? '')) });
  });

  app.post('/api/admin/change-pin', (req: Request, res: Response) => {
    try {
      const { currentPin, newPin } = req.body as { currentPin?: string; newPin?: string };
      db.changeAdminPin(String(currentPin ?? ''), String(newPin ?? ''));
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao alterar PIN.' });
    }
  });

  // Settings
  app.get('/api/settings', (_req: Request, res: Response) => {
    res.json(db.getSettings());
  });

  app.put('/api/settings', (req: Request, res: Response) => {
    try {
      const updated = db.saveSettings(req.body);
      broadcastEvent('settings', updated);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao guardar definições.' });
    }
  });

  // Backup
  app.get('/api/backup/export', (_req: Request, res: Response) => {
    res.json(db.exportBackup());
  });

  app.post('/api/backup/restore', (req: Request, res: Response) => {
    try {
      db.restoreBackup(req.body);
      broadcastEvent('settings', db.getSettings());
      res.json({ ok: true, message: 'Cópia de segurança restaurada com sucesso.' });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Erro ao restaurar cópia de segurança.',
      });
    }
  });

  // Vite dev middleware or static dist
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`3MPresenter server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start 3MPresenter server:', err);
  process.exit(1);
});
