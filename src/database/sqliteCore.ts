import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import type {
  Activity,
  Announcement,
  AppSettings,
  BackupPayload,
  CollectionType,
  Folder,
  Hymn,
  HymnSection,
  HymnSectionType,
  Program,
  ProgramWithActivities,
} from '../types/index.ts';

const DEFAULT_ADMIN_PIN = '2997';

const DEFAULT_SETTINGS: AppSettings = {
  church_name: 'Igreja Central',
  waiting_text: 'Sejam bem-vindos à Casa do Senhor',
  main_bg_type: 'color',
  main_bg_color: '#1E3A5F',
  main_bg_image: '',
  activity_bg_type: 'color',
  activity_bg_color: '#13294B',
  activity_bg_image: '',
  hymn_bg_type: 'color',
  hymn_bg_color: '#1E3A5F',
  hymn_bg_image: '',
  projection_display_id: '',
  projection_display_name: '',
  show_idle_text_on_image: false,
  update_manifest_url: 'https://api.github.com/repos/costatec-creator/3mpresenter/releases/latest',
  feedback_email: 'costatec@outlook.pt',
  feedback_whatsapp: '+244923353376',
  welcome_guide_seen: false,
};

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextSaturdayIso(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (6 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function queryAll<T>(db: Database, sql: string, params: SqlValue[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

function queryOne<T>(db: Database, sql: string, params: SqlValue[] = []): T | null {
  const rows = queryAll<T>(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export class LocalSqliteDatabase {
  private db: Database;
  private dbPath: string;

  private constructor(db: Database, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
  }

  static async create(dbPath: string, wasmPath?: string): Promise<LocalSqliteDatabase> {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const sqlConfig = wasmPath
      ? ({
          locateFile: () => wasmPath,
        } as unknown as Parameters<typeof initSqlJs>[0])
      : undefined;
    const SQL = await initSqlJs(sqlConfig);

    let db: Database;
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    const instance = new LocalSqliteDatabase(db, dbPath);
    instance.initSchema();
    instance.seedIfFirstRun();
    instance.persist();
    return instance;
  }

  private persist(): void {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  private initSchema(): void {
    this.db.run('PRAGMA foreign_keys = ON;');

    this.db.run(`
      CREATE TABLE IF NOT EXISTS programs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        program_id TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        name TEXT NOT NULL,
        activist TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT '',
        hymn_id TEXT DEFAULT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        collection_type TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS hymns (
        id TEXT PRIMARY KEY,
        number TEXT NOT NULL,
        collection_type TEXT NOT NULL,
        title TEXT NOT NULL,
        author TEXT NOT NULL DEFAULT '',
        folder_id TEXT DEFAULT NULL,
        folder_name TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS hymn_sections (
        id TEXT PRIMARY KEY,
        hymn_id TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        section_type TEXT NOT NULL,
        section_number INTEGER NOT NULL,
        content TEXT NOT NULL,
        FOREIGN KEY (hymn_id) REFERENCES hymns(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    this.db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_pin', ?)`, [DEFAULT_ADMIN_PIN]);
    this.db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('catalog_version', '1')`);
  }

  private seedIfFirstRun(): void {
    const initialized = queryOne<{ value: string }>(
      this.db,
      `SELECT value FROM settings WHERE key = 'db_initialized'`
    );
    if (initialized) {
      return;
    }

    const now = nowIso();
    const sat = nextSaturdayIso();

    this.db.run('BEGIN TRANSACTION;');
    try {
      // Default Settings
      const entries = Object.entries(DEFAULT_SETTINGS);
      for (const [key, value] of entries) {
        this.db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, String(value)]);
      }
      this.db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('db_initialized', '1')`);

      // Default Folders
      const folderAdoracaoId = newId();
      const folderJovemId = newId();
      const folderEspeciaisId = newId();

      this.db.run(
        `INSERT INTO folders (id, name, collection_type, created_at) VALUES (?, ?, ?, ?)`,
        [folderAdoracaoId, 'Culto Divino', 'Hinário', now]
      );
      this.db.run(
        `INSERT INTO folders (id, name, collection_type, created_at) VALUES (?, ?, ?, ?)`,
        [folderJovemId, 'Louvor Jovem', 'Coletânea', now]
      );
      this.db.run(
        `INSERT INTO folders (id, name, collection_type, created_at) VALUES (?, ?, ?, ?)`,
        [folderEspeciaisId, 'Cânticos Congregacionais', 'Outros', now]
      );

      // Hymns
      const hymn32Id = newId();
      this.db.run(
        `INSERT INTO hymns (id, number, collection_type, title, author, folder_id, folder_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [hymn32Id, '32', 'Hinário', 'O Grande Amor de Deus', 'Frederick M. Lehman', folderAdoracaoId, 'Culto Divino', now, now]
      );

      const hymn32Sections: Array<{ type: HymnSectionType; num: number; content: string }> = [
        {
          type: 'Estrofe',
          num: 1,
          content:
            'O grande amor de meu Jesus\nPor mim, na cruz, se revelou;\nAli sofreu cruel pavor,\nE minha alma resgatou.',
        },
        {
          type: 'Coro',
          num: 1,
          content:
            'Oh, quão profundo e santo amor\nMostrou Jesus na cruz por mim!\nPor esse dom tão divinal,\nLouvor lhe rendo sem ter fim.',
        },
        {
          type: 'Estrofe',
          num: 2,
          content:
            'Jamais poderei explicar\nO quanto Cristo me amou;\nDo céu deixou o esplendor\nE minha culpa carregou.',
        },
      ];

      hymn32Sections.forEach((sec, idx) => {
        this.db.run(
          `INSERT INTO hymn_sections (id, hymn_id, order_index, section_type, section_number, content)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [newId(), hymn32Id, idx, sec.type, sec.num, sec.content]
        );
      });

      const hymn1Id = newId();
      this.db.run(
        `INSERT INTO hymns (id, number, collection_type, title, author, folder_id, folder_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [hymn1Id, '1', 'Hinário', 'Ó Deus de Amor', 'Hinário Adventista', folderAdoracaoId, 'Culto Divino', now, now]
      );

      const hymn1Sections: Array<{ type: HymnSectionType; num: number; content: string }> = [
        {
          type: 'Estrofe',
          num: 1,
          content:
            'Ó Deus de amor, ó Rei dos céus,\nEterno Pai, bom Criador,\nRendemos hoje os louvores nossos\nAo Teu poder, ao Teu amor.',
        },
        {
          type: 'Estrofe',
          num: 2,
          content:
            'Na Tua casa, em comunhão,\nUnidos vimos Te adorar;\nConcede paz ao coração\nE vem connosco aqui ficar.',
        },
      ];

      hymn1Sections.forEach((sec, idx) => {
        this.db.run(
          `INSERT INTO hymn_sections (id, hymn_id, order_index, section_type, section_number, content)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [newId(), hymn1Id, idx, sec.type, sec.num, sec.content]
        );
      });

      const hymnJovemId = newId();
      this.db.run(
        `INSERT INTO hymns (id, number, collection_type, title, author, folder_id, folder_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [hymnJovemId, '14', 'Coletânea', 'Brilha Jesus', 'Graham Kendrick', folderJovemId, 'Louvor Jovem', now, now]
      );

      const hymnJovemSections: Array<{ type: HymnSectionType; num: number; content: string }> = [
        {
          type: 'Estrofe',
          num: 1,
          content:
            'Vejo a luz do Senhor a brilhar\nNo meio das trevas do mundo atual;\nJesus é a luz que ilumina o andar,\nVerdade eterna, presença real.',
        },
        {
          type: 'Coro',
          num: 1,
          content:
            'Brilha, Jesus, enche este lugar com Tua glória;\nArde em nós o fogo do Espírito de Deus.\nFlui, Senhor, inunda as nações com graça e vida;\nEnvia a Tua palavra e haja luz!',
        },
      ];

      hymnJovemSections.forEach((sec, idx) => {
        this.db.run(
          `INSERT INTO hymn_sections (id, hymn_id, order_index, section_type, section_number, content)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [newId(), hymnJovemId, idx, sec.type, sec.num, sec.content]
        );
      });

      // Sample Program
      const progId = newId();
      this.db.run(
        `INSERT INTO programs (id, title, date, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          progId,
          'Culto Divino - Especial Jovem',
          sat,
          'Culto solene de sábado com participação do ministério jovem.',
          now,
          now,
        ]
      );

      const sampleActivities = [
        { name: 'Oração de abertura', activist: 'Diác. Carlos Mendes', role: 'Diácono', hymnId: null },
        { name: 'Hino 32 - O Grande Amor de Deus', activist: 'Congregação', role: 'Direcção de Louvor', hymnId: hymn32Id },
        { name: 'Leitura bíblica', activist: 'Ana Beatriz Silva', role: 'Directora Jovem', hymnId: null },
        { name: 'Mensagem musical', activist: 'Quarteto Esperança', role: 'Ministério da Música', hymnId: null },
        { name: 'Sermão', activist: 'Pr. Manuel Ferreira', role: 'Pastor Distrital', hymnId: null },
      ];

      sampleActivities.forEach((act, idx) => {
        this.db.run(
          `INSERT INTO activities (id, program_id, order_index, name, activist, role, hymn_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [newId(), progId, idx, act.name, act.activist, act.role, act.hymnId, now]
        );
      });

      // Sample Announcements
      this.db.run(
        `INSERT INTO announcements (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
        [
          newId(),
          'Reunião Jovem - Sábado à tarde',
          'Convidamos todos os jovens e amigos para a reunião especial às 16h30 no salão principal, seguida de estudo bíblico e confraternização.',
          now,
          now,
        ]
      );
      this.db.run(
        `INSERT INTO announcements (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
        [
          newId(),
          'Ensaio do Coro da Igreja',
          'O ensaio semanal realiza-se na quarta-feira às 19h30. Agradecemos a pontualidade de todos os membros.',
          now,
          now,
        ]
      );

      this.db.run('COMMIT;');
    } catch (err) {
      this.db.run('ROLLBACK;');
      throw err;
    }
  }

  // ---------------- PROGRAMS ----------------
  listPrograms(): Program[] {
    return queryAll<Program>(
      this.db,
      `SELECT p.*, COUNT(a.id) AS activity_count
       FROM programs p
       LEFT JOIN activities a ON a.program_id = p.id
       GROUP BY p.id
       ORDER BY p.date DESC, p.created_at DESC`
    );
  }

  getProgram(id: string): ProgramWithActivities | null {
    const prog = queryOne<Program>(this.db, `SELECT * FROM programs WHERE id = ?`, [id]);
    if (!prog) return null;
    const activities = queryAll<Activity>(
      this.db,
      `SELECT * FROM activities WHERE program_id = ? ORDER BY order_index ASC`,
      [id]
    );
    return { ...prog, activities };
  }

  createProgram(input: { title: string; date: string; description?: string }): Program {
    const id = newId();
    const now = nowIso();
    const title = input.title.trim();
    const date = input.date || todayIso();
    const description = (input.description ?? '').trim();

    this.db.run(
      `INSERT INTO programs (id, title, date, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, title, date, description, now, now]
    );
    this.persist();
    return { id, title, date, description, created_at: now, updated_at: now, activity_count: 0 };
  }

  updateProgram(id: string, input: { title: string; date: string; description?: string }): Program {
    const existing = queryOne<Program>(this.db, `SELECT * FROM programs WHERE id = ?`, [id]);
    if (!existing) throw new Error('Programa não encontrado.');

    const now = nowIso();
    const title = input.title.trim();
    const date = input.date || existing.date;
    const description = (input.description ?? '').trim();

    this.db.run(
      `UPDATE programs SET title = ?, date = ?, description = ?, updated_at = ? WHERE id = ?`,
      [title, date, description, now, id]
    );
    this.persist();
    return { ...existing, title, date, description, updated_at: now };
  }

  duplicateProgram(id: string, input: { title: string; date: string; description?: string }): Program {
    const source = this.getProgram(id);
    if (!source) throw new Error('Programa original não encontrado.');

    const newProgId = newId();
    const now = nowIso();
    const title = input.title.trim();
    const date = input.date || source.date;
    const description = input.description !== undefined ? input.description.trim() : source.description;

    this.db.run('BEGIN TRANSACTION;');
    try {
      this.db.run(
        `INSERT INTO programs (id, title, date, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [newProgId, title, date, description, now, now]
      );

      for (const act of source.activities) {
        this.db.run(
          `INSERT INTO activities (id, program_id, order_index, name, activist, role, hymn_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [newId(), newProgId, act.order_index, act.name, act.activist, act.role ?? '', act.hymn_id ?? null, now]
        );
      }

      this.db.run('COMMIT;');
    } catch (err) {
      this.db.run('ROLLBACK;');
      throw err;
    }

    this.persist();
    return {
      id: newProgId,
      title,
      date,
      description,
      created_at: now,
      updated_at: now,
      activity_count: source.activities.length,
    };
  }

  deleteProgram(id: string): void {
    this.db.run(`DELETE FROM activities WHERE program_id = ?`, [id]);
    this.db.run(`DELETE FROM programs WHERE id = ?`, [id]);
    this.persist();
  }

  // ---------------- ACTIVITIES ----------------
  createActivity(
    programId: string,
    input: { name: string; activist: string; role?: string; hymn_id?: string | null }
  ): Activity {
    const prog = queryOne<Program>(this.db, `SELECT id FROM programs WHERE id = ?`, [programId]);
    if (!prog) throw new Error('Programa não encontrado.');

    const maxRow = queryOne<{ max_order: number | null }>(
      this.db,
      `SELECT MAX(order_index) AS max_order FROM activities WHERE program_id = ?`,
      [programId]
    );
    const nextOrder = maxRow && maxRow.max_order !== null ? Number(maxRow.max_order) + 1 : 0;

    const id = newId();
    const now = nowIso();
    const name = input.name.trim();
    const activist = input.activist.trim();
    const role = (input.role ?? '').trim();
    const hymnId = input.hymn_id ?? null;

    this.db.run(
      `INSERT INTO activities (id, program_id, order_index, name, activist, role, hymn_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, programId, nextOrder, name, activist, role, hymnId, now]
    );
    this.db.run(`UPDATE programs SET updated_at = ? WHERE id = ?`, [now, programId]);
    this.persist();

    return { id, program_id: programId, order_index: nextOrder, name, activist, role, hymn_id: hymnId, created_at: now };
  }

  updateActivity(
    id: string,
    input: { name: string; activist: string; role?: string; hymn_id?: string | null }
  ): Activity {
    const existing = queryOne<Activity>(this.db, `SELECT * FROM activities WHERE id = ?`, [id]);
    if (!existing) throw new Error('Actividade não encontrada.');

    const name = input.name.trim();
    const activist = input.activist.trim();
    const role = (input.role ?? '').trim();
    const hymnId = input.hymn_id !== undefined ? input.hymn_id : existing.hymn_id;

    this.db.run(
      `UPDATE activities SET name = ?, activist = ?, role = ?, hymn_id = ? WHERE id = ?`,
      [name, activist, role, hymnId, id]
    );
    this.db.run(`UPDATE programs SET updated_at = ? WHERE id = ?`, [nowIso(), existing.program_id]);
    this.persist();

    return { ...existing, name, activist, role, hymn_id: hymnId };
  }

  deleteActivity(id: string): void {
    const existing = queryOne<Activity>(this.db, `SELECT * FROM activities WHERE id = ?`, [id]);
    if (!existing) return;

    this.db.run('BEGIN TRANSACTION;');
    try {
      this.db.run(`DELETE FROM activities WHERE id = ?`, [id]);
      const remaining = queryAll<Activity>(
        this.db,
        `SELECT id FROM activities WHERE program_id = ? ORDER BY order_index ASC`,
        [existing.program_id]
      );
      remaining.forEach((act, idx) => {
        this.db.run(`UPDATE activities SET order_index = ? WHERE id = ?`, [idx, act.id]);
      });
      this.db.run(`UPDATE programs SET updated_at = ? WHERE id = ?`, [nowIso(), existing.program_id]);
      this.db.run('COMMIT;');
    } catch (err) {
      this.db.run('ROLLBACK;');
      throw err;
    }
    this.persist();
  }

  reorderActivities(programId: string, orderedIds: string[]): Activity[] {
    this.db.run('BEGIN TRANSACTION;');
    try {
      orderedIds.forEach((actId, idx) => {
        this.db.run(`UPDATE activities SET order_index = ? WHERE id = ? AND program_id = ?`, [
          idx,
          actId,
          programId,
        ]);
      });
      this.db.run(`UPDATE programs SET updated_at = ? WHERE id = ?`, [nowIso(), programId]);
      this.db.run('COMMIT;');
    } catch (err) {
      this.db.run('ROLLBACK;');
      throw err;
    }
    this.persist();
    return queryAll<Activity>(
      this.db,
      `SELECT * FROM activities WHERE program_id = ? ORDER BY order_index ASC`,
      [programId]
    );
  }

  // ---------------- ANNOUNCEMENTS ----------------
  listAnnouncements(): Announcement[] {
    return queryAll<Announcement>(this.db, `SELECT * FROM announcements ORDER BY created_at DESC`);
  }

  createAnnouncement(input: { title: string; content: string }): Announcement {
    const id = newId();
    const now = nowIso();
    const title = input.title.trim();
    const content = input.content.trim();

    this.db.run(
      `INSERT INTO announcements (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [id, title, content, now, now]
    );
    this.persist();
    return { id, title, content, created_at: now, updated_at: now };
  }

  updateAnnouncement(id: string, input: { title: string; content: string }): Announcement {
    const existing = queryOne<Announcement>(this.db, `SELECT * FROM announcements WHERE id = ?`, [id]);
    if (!existing) throw new Error('Anúncio não encontrado.');

    const now = nowIso();
    const title = input.title.trim();
    const content = input.content.trim();

    this.db.run(`UPDATE announcements SET title = ?, content = ?, updated_at = ? WHERE id = ?`, [
      title,
      content,
      now,
      id,
    ]);
    this.persist();
    return { ...existing, title, content, updated_at: now };
  }

  deleteAnnouncement(id: string): void {
    this.db.run(`DELETE FROM announcements WHERE id = ?`, [id]);
    this.persist();
  }

  // ---------------- FOLDERS ----------------
  listFolders(collectionType?: CollectionType): Folder[] {
    if (collectionType) {
      return queryAll<Folder>(
        this.db,
        `SELECT * FROM folders WHERE collection_type = ? ORDER BY name ASC`,
        [collectionType]
      );
    }
    return queryAll<Folder>(this.db, `SELECT * FROM folders ORDER BY collection_type ASC, name ASC`);
  }

  createFolder(input: { name: string; collection_type: CollectionType }): Folder {
    const name = input.name.trim();
    const existing = queryOne<Folder>(
      this.db,
      `SELECT * FROM folders WHERE LOWER(name) = LOWER(?) AND collection_type = ?`,
      [name, input.collection_type]
    );
    if (existing) return existing;

    const id = newId();
    const now = nowIso();
    this.db.run(`INSERT INTO folders (id, name, collection_type, created_at) VALUES (?, ?, ?, ?)`, [
      id,
      name,
      input.collection_type,
      now,
    ]);
    this.persist();
    return { id, name, collection_type: input.collection_type, created_at: now };
  }

  deleteFolder(id: string): void {
    this.db.run(`UPDATE hymns SET folder_id = NULL, folder_name = '' WHERE folder_id = ?`, [id]);
    this.db.run(`DELETE FROM folders WHERE id = ?`, [id]);
    this.persist();
  }

  // ---------------- HYMNS ----------------
  listHymns(): Hymn[] {
    const hymns = queryAll<Hymn>(
      this.db,
      `SELECT h.*,
        (SELECT COUNT(*) FROM hymn_sections s WHERE s.hymn_id = h.id AND s.section_type = 'Estrofe') AS verse_count,
        (SELECT COUNT(*) FROM hymn_sections s WHERE s.hymn_id = h.id AND s.section_type = 'Coro') AS chorus_count
       FROM hymns h
       ORDER BY CAST(h.number AS INTEGER) ASC, h.number ASC, h.title ASC`
    );
    return hymns;
  }

  getHymn(id: string): Hymn | null {
    const hymn = queryOne<Hymn>(this.db, `SELECT * FROM hymns WHERE id = ?`, [id]);
    if (!hymn) return null;
    const sections = queryAll<HymnSection>(
      this.db,
      `SELECT * FROM hymn_sections WHERE hymn_id = ? ORDER BY order_index ASC`,
      [id]
    );
    const verseCount = sections.filter((s) => s.section_type === 'Estrofe').length;
    const chorusCount = sections.filter((s) => s.section_type === 'Coro').length;
    return {
      ...hymn,
      verse_count: verseCount,
      chorus_count: chorusCount,
      sections,
    };
  }

  private computeSectionNumbers(
    sections: Array<{ section_type: HymnSectionType; content: string }>
  ): Array<{ order_index: number; section_type: HymnSectionType; section_number: number; content: string }> {
    let verseIdx = 0;
    let chorusIdx = 0;
    return sections.map((sec, idx) => {
      if (sec.section_type === 'Estrofe') {
        verseIdx += 1;
      } else {
        chorusIdx += 1;
      }
      return {
        order_index: idx,
        section_type: sec.section_type,
        section_number: sec.section_type === 'Estrofe' ? verseIdx : chorusIdx,
        content: sec.content.trim(),
      };
    });
  }

  verifyAdminPin(pin: string): boolean {
    const stored = this.getMetaFlag('admin_pin') || DEFAULT_ADMIN_PIN;
    return String(pin ?? '').trim() === stored;
  }

  changeAdminPin(currentPin: string, newPin: string): void {
    if (!this.verifyAdminPin(currentPin)) {
      throw new Error('Código PIN atual incorreto.');
    }
    const cleaned = String(newPin ?? '').trim();
    if (cleaned.length < 4) {
      throw new Error('O novo código PIN deve ter pelo menos 4 caracteres.');
    }
    this.setMetaFlag('admin_pin', cleaned);
  }

  private assertOfficialHymnAccess(collectionType: CollectionType, adminPin?: string): void {
    if (collectionType === 'Outros') return;
    if (!adminPin || !this.verifyAdminPin(adminPin)) {
      throw new Error(
        'O Hinário Adventista e a Coletânea Jovem estão protegidos. Desbloqueie o Modo Admin Principal para alterar.'
      );
    }
  }

  createHymn(input: {
    number: string;
    collection_type: CollectionType;
    title: string;
    author?: string;
    folder_id?: string | null;
    folder_name?: string;
    sections: Array<{ section_type: HymnSectionType; content: string }>;
    adminPin?: string;
  }): Hymn {
    this.assertOfficialHymnAccess(input.collection_type, input.adminPin);
    const id = newId();
    const now = nowIso();
    const number = input.number.trim();
    const title = input.title.trim();
    const author = (input.author ?? '').trim();

    let folderId = input.folder_id ?? null;
    let folderName = (input.folder_name ?? '').trim();
    if (folderId) {
      const folder = queryOne<Folder>(this.db, `SELECT * FROM folders WHERE id = ?`, [folderId]);
      if (folder) folderName = folder.name;
    }

    const numberedSections = this.computeSectionNumbers(input.sections);

    this.db.run('BEGIN TRANSACTION;');
    try {
      this.db.run(
        `INSERT INTO hymns (id, number, collection_type, title, author, folder_id, folder_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, number, input.collection_type, title, author, folderId, folderName, now, now]
      );

      for (const sec of numberedSections) {
        this.db.run(
          `INSERT INTO hymn_sections (id, hymn_id, order_index, section_type, section_number, content)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [newId(), id, sec.order_index, sec.section_type, sec.section_number, sec.content]
        );
      }

      this.db.run('COMMIT;');
    } catch (err) {
      this.db.run('ROLLBACK;');
      throw err;
    }

    this.persist();
    return this.getHymn(id)!;
  }

  updateHymn(
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
  ): Hymn {
    const existing = queryOne<Hymn>(this.db, `SELECT * FROM hymns WHERE id = ?`, [id]);
    if (!existing) throw new Error('Hino não encontrado.');

    if (existing.collection_type !== 'Outros' || input.collection_type !== 'Outros') {
      this.assertOfficialHymnAccess(
        existing.collection_type !== 'Outros' ? existing.collection_type : input.collection_type,
        input.adminPin
      );
    }

    const now = nowIso();
    const number = input.number.trim();
    const title = input.title.trim();
    const author = (input.author ?? '').trim();

    let folderId = input.folder_id ?? null;
    let folderName = (input.folder_name ?? '').trim();
    if (folderId) {
      const folder = queryOne<Folder>(this.db, `SELECT * FROM folders WHERE id = ?`, [folderId]);
      if (folder) folderName = folder.name;
    }

    const numberedSections = this.computeSectionNumbers(input.sections);

    this.db.run('BEGIN TRANSACTION;');
    try {
      this.db.run(
        `UPDATE hymns SET number = ?, collection_type = ?, title = ?, author = ?, folder_id = ?, folder_name = ?, updated_at = ?
         WHERE id = ?`,
        [number, input.collection_type, title, author, folderId, folderName, now, id]
      );

      this.db.run(`DELETE FROM hymn_sections WHERE hymn_id = ?`, [id]);

      for (const sec of numberedSections) {
        this.db.run(
          `INSERT INTO hymn_sections (id, hymn_id, order_index, section_type, section_number, content)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [newId(), id, sec.order_index, sec.section_type, sec.section_number, sec.content]
        );
      }

      this.db.run('COMMIT;');
    } catch (err) {
      this.db.run('ROLLBACK;');
      throw err;
    }

    this.persist();
    return this.getHymn(id)!;
  }

  duplicateHymnToOutros(id: string): Hymn {
    const source = this.getHymn(id);
    if (!source) throw new Error('Hino não encontrado.');
    const folder = this.createFolder({
      name: 'Personalizados',
      collection_type: 'Outros',
    });
    return this.createHymn({
      number: source.number,
      collection_type: 'Outros',
      title: `${source.title} (Cópia)`,
      author: source.author,
      folder_id: folder.id,
      folder_name: folder.name,
      sections: (source.sections || []).map((s) => ({
        section_type: s.section_type,
        content: s.content,
      })),
    });
  }

  deleteHymn(id: string, adminPin?: string): void {
    const existing = queryOne<Hymn>(this.db, `SELECT * FROM hymns WHERE id = ?`, [id]);
    if (!existing) return;
    this.assertOfficialHymnAccess(existing.collection_type, adminPin);

    this.db.run(`DELETE FROM hymn_sections WHERE hymn_id = ?`, [id]);
    this.db.run(`DELETE FROM hymns WHERE id = ?`, [id]);
    this.persist();
  }

  getMetaFlag(key: string): string | null {
    const row = queryOne<{ value: string }>(this.db, `SELECT value FROM settings WHERE key = ?`, [key]);
    return row ? row.value : null;
  }

  setMetaFlag(key: string, value: string): void {
    this.db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, value]);
    this.persist();
  }

  importHymnsBatch(
    items: Array<{
      number: string;
      collection_type: CollectionType;
      title: string;
      author?: string;
      folder_id?: string | null;
      folder_name?: string;
      sections: Array<{ section_type: HymnSectionType; content: string }>;
    }>,
    options?: { replaceCollection?: CollectionType; markFlag?: string }
  ): { inserted: number; skipped: number } {
    const now = nowIso();
    let inserted = 0;
    let skipped = 0;

    this.db.run('BEGIN TRANSACTION;');
    try {
      if (options?.replaceCollection) {
        this.db.run(
          `DELETE FROM hymn_sections WHERE hymn_id IN (SELECT id FROM hymns WHERE collection_type = ?)`,
          [options.replaceCollection]
        );
        this.db.run(`DELETE FROM hymns WHERE collection_type = ?`, [options.replaceCollection]);
      }

      for (const item of items) {
        const number = item.number.trim();
        const title = item.title.trim();
        if (!number || !title || item.sections.length === 0) {
          skipped += 1;
          continue;
        }

        const existing = queryOne<{ id: string }>(
          this.db,
          `SELECT id FROM hymns WHERE number = ? AND collection_type = ?`,
          [number, item.collection_type]
        );
        if (existing) {
          skipped += 1;
          continue;
        }

        const id = newId();
        const author = (item.author ?? '').trim();
        const folderId = item.folder_id ?? null;
        const folderName = (item.folder_name ?? '').trim();
        const numberedSections = this.computeSectionNumbers(item.sections);

        this.db.run(
          `INSERT INTO hymns (id, number, collection_type, title, author, folder_id, folder_name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, number, item.collection_type, title, author, folderId, folderName, now, now]
        );

        for (const sec of numberedSections) {
          this.db.run(
            `INSERT INTO hymn_sections (id, hymn_id, order_index, section_type, section_number, content)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [newId(), id, sec.order_index, sec.section_type, sec.section_number, sec.content]
          );
        }

        inserted += 1;
      }

      // Relink any activity whose hymn_id points to a deleted hymn if we can match by number (e.g. "Hino 32 ...")
      const orphanedActivities = queryAll<Activity>(
        this.db,
        `SELECT a.* FROM activities a
         WHERE a.hymn_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM hymns h WHERE h.id = a.hymn_id)`
      );
      for (const act of orphanedActivities) {
        const m = act.name.match(/\bHino\s+(\d+)\b/i);
        if (m) {
          const targetHymn = queryOne<{ id: string }>(
            this.db,
            `SELECT id FROM hymns WHERE number = ? AND collection_type = 'Hinário' LIMIT 1`,
            [String(Number.parseInt(m[1], 10))]
          );
          if (targetHymn) {
            this.db.run(`UPDATE activities SET hymn_id = ? WHERE id = ?`, [targetHymn.id, act.id]);
            continue;
          }
        }
        this.db.run(`UPDATE activities SET hymn_id = NULL WHERE id = ?`, [act.id]);
      }

      if (options?.markFlag && inserted > 0) {
        this.db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, '1')`, [options.markFlag]);
      }

      this.db.run('COMMIT;');
    } catch (err) {
      this.db.run('ROLLBACK;');
      throw err;
    }

    this.persist();
    return { inserted, skipped };
  }

  // ---------------- SETTINGS ----------------
  getSettings(): AppSettings {
    const rows = queryAll<{ key: string; value: string }>(this.db, `SELECT key, value FROM settings`);
    const map: Record<string, string> = {};
    for (const r of rows) {
      map[r.key] = r.value;
    }
    return {
      church_name: map.church_name ?? DEFAULT_SETTINGS.church_name,
      waiting_text: map.waiting_text ?? DEFAULT_SETTINGS.waiting_text,
      main_bg_type: (map.main_bg_type as AppSettings['main_bg_type']) || DEFAULT_SETTINGS.main_bg_type,
      main_bg_color: map.main_bg_color ?? DEFAULT_SETTINGS.main_bg_color,
      main_bg_image: map.main_bg_image ?? DEFAULT_SETTINGS.main_bg_image,
      activity_bg_type: (map.activity_bg_type as AppSettings['activity_bg_type']) || DEFAULT_SETTINGS.activity_bg_type,
      activity_bg_color: map.activity_bg_color ?? DEFAULT_SETTINGS.activity_bg_color,
      activity_bg_image: map.activity_bg_image ?? DEFAULT_SETTINGS.activity_bg_image,
      hymn_bg_type: (map.hymn_bg_type as AppSettings['hymn_bg_type']) || DEFAULT_SETTINGS.hymn_bg_type,
      hymn_bg_color: map.hymn_bg_color ?? DEFAULT_SETTINGS.hymn_bg_color,
      hymn_bg_image: map.hymn_bg_image ?? DEFAULT_SETTINGS.hymn_bg_image,
      projection_display_id: map.projection_display_id ?? DEFAULT_SETTINGS.projection_display_id,
      projection_display_name: map.projection_display_name ?? DEFAULT_SETTINGS.projection_display_name,
      show_idle_text_on_image: map.show_idle_text_on_image === 'true',
      update_manifest_url:
        (map.update_manifest_url || '').trim() || DEFAULT_SETTINGS.update_manifest_url,
      feedback_email: (map.feedback_email || '').trim() || DEFAULT_SETTINGS.feedback_email,
      feedback_whatsapp: (map.feedback_whatsapp || '').trim() || DEFAULT_SETTINGS.feedback_whatsapp,
      welcome_guide_seen: map.welcome_guide_seen === 'true',
    };
  }

  saveSettings(partial: Partial<AppSettings>): AppSettings {
    const allowedKeys: Array<keyof AppSettings> = [
      'church_name',
      'waiting_text',
      'main_bg_type',
      'main_bg_color',
      'main_bg_image',
      'activity_bg_type',
      'activity_bg_color',
      'activity_bg_image',
      'hymn_bg_type',
      'hymn_bg_color',
      'hymn_bg_image',
      'projection_display_id',
      'projection_display_name',
      'show_idle_text_on_image',
      'update_manifest_url',
      'feedback_email',
      'feedback_whatsapp',
      'welcome_guide_seen',
    ];

    this.db.run('BEGIN TRANSACTION;');
    try {
      for (const key of allowedKeys) {
        if (partial[key] !== undefined) {
          this.db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [
            key,
            String(partial[key]),
          ]);
        }
      }
      this.db.run('COMMIT;');
    } catch (err) {
      this.db.run('ROLLBACK;');
      throw err;
    }
    this.persist();
    return this.getSettings();
  }

  // ---------------- BACKUP & RESTORE ----------------
  exportBackup(): BackupPayload {
    const settingsRows = queryAll<{ key: string; value: string }>(this.db, `SELECT key, value FROM settings`);
    const settingsMap: Record<string, string> = {};
    for (const row of settingsRows) {
      settingsMap[row.key] = row.value;
    }

    return {
      version: 1,
      app: '3MPresenter',
      exportedAt: nowIso(),
      data: {
        programs: queryAll<Program>(this.db, `SELECT * FROM programs`),
        activities: queryAll<Activity>(this.db, `SELECT * FROM activities`),
        announcements: queryAll<Announcement>(this.db, `SELECT * FROM announcements`),
        folders: queryAll<Folder>(this.db, `SELECT * FROM folders`),
        hymns: queryAll<Hymn>(this.db, `SELECT * FROM hymns`),
        hymn_sections: queryAll<HymnSection>(this.db, `SELECT * FROM hymn_sections`),
        settings: settingsMap,
      },
    };
  }

  restoreBackup(payload: BackupPayload): void {
    if (
      !payload ||
      payload.app !== '3MPresenter' ||
      !payload.data ||
      !Array.isArray(payload.data.programs) ||
      !Array.isArray(payload.data.activities) ||
      !Array.isArray(payload.data.announcements) ||
      !Array.isArray(payload.data.folders) ||
      !Array.isArray(payload.data.hymns) ||
      !Array.isArray(payload.data.hymn_sections)
    ) {
      throw new Error('O ficheiro seleccionado não é uma cópia de segurança válida do 3MPresenter.');
    }

    this.db.run('BEGIN TRANSACTION;');
    try {
      this.db.run(`DELETE FROM hymn_sections`);
      this.db.run(`DELETE FROM hymns`);
      this.db.run(`DELETE FROM folders`);
      this.db.run(`DELETE FROM announcements`);
      this.db.run(`DELETE FROM activities`);
      this.db.run(`DELETE FROM programs`);
      this.db.run(`DELETE FROM settings`);

      for (const p of payload.data.programs) {
        this.db.run(
          `INSERT INTO programs (id, title, date, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
          [p.id, p.title, p.date, p.description ?? '', p.created_at, p.updated_at]
        );
      }

      for (const a of payload.data.activities) {
        this.db.run(
          `INSERT INTO activities (id, program_id, order_index, name, activist, role, hymn_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [a.id, a.program_id, a.order_index, a.name, a.activist, a.role ?? '', a.hymn_id ?? null, a.created_at]
        );
      }

      for (const ann of payload.data.announcements) {
        this.db.run(
          `INSERT INTO announcements (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
          [ann.id, ann.title, ann.content, ann.created_at, ann.updated_at]
        );
      }

      for (const f of payload.data.folders) {
        this.db.run(`INSERT INTO folders (id, name, collection_type, created_at) VALUES (?, ?, ?, ?)`, [
          f.id,
          f.name,
          f.collection_type,
          f.created_at,
        ]);
      }

      for (const h of payload.data.hymns) {
        this.db.run(
          `INSERT INTO hymns (id, number, collection_type, title, author, folder_id, folder_name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            h.id,
            h.number,
            h.collection_type,
            h.title,
            h.author ?? '',
            h.folder_id ?? null,
            h.folder_name ?? '',
            h.created_at,
            h.updated_at,
          ]
        );
      }

      for (const s of payload.data.hymn_sections) {
        this.db.run(
          `INSERT INTO hymn_sections (id, hymn_id, order_index, section_type, section_number, content)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [s.id, s.hymn_id ?? '', s.order_index, s.section_type, s.section_number, s.content]
        );
      }

      if (payload.data.settings && typeof payload.data.settings === 'object') {
        for (const [key, val] of Object.entries(payload.data.settings)) {
          this.db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, String(val)]);
        }
      }
      this.db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('db_initialized', '1')`);

      this.db.run('COMMIT;');
    } catch (err) {
      this.db.run('ROLLBACK;');
      throw err;
    }

    this.persist();
  }
}
