import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Folder as FolderIcon,
  FolderPlus,
  MonitorPlay,
  Music2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { COLLECTION_LABELS, dataService } from '../../services/dataService.ts';
import { ConfirmModal, Modal } from '../../components/Modal.tsx';
import { HymnWizardModal } from './HymnWizardModal.tsx';
import { HymnLyricsModal } from './HymnLyricsModal.tsx';
import type { CollectionType, Folder, Hymn } from '../../types/index.ts';

interface HymnsPageProps {
  adminPin?: string | null;
  onAdminLock: () => void;
  onProjectHymn: (hymnId: string) => void;
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

type CollectionFilter = 'Todas' | CollectionType;

export function HymnsPage({
  adminPin,
  onAdminLock,
  onProjectHymn,
  onNotify,
}: HymnsPageProps) {
  const isAdminUnlocked = Boolean(adminPin);
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>('Todas');
  const [folderFilter, setFolderFilter] = useState<string>('Todas');
  const [search, setSearch] = useState('');

  // Wizard Modal
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingHymn, setEditingHymn] = useState<Hymn | null>(null);

  // Lyrics Modal
  const [viewingHymn, setViewingHymn] = useState<Hymn | null>(null);

  // New Folder Modal
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderCol, setNewFolderCol] = useState<CollectionType>('Outros');

  // Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState<Hymn | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [hList, fList] = await Promise.all([
        dataService.hymns.list(),
        dataService.folders.list(),
      ]);
      setHymns(hList);
      setFolders(fList);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao carregar hinos.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleViewLyrics(hymn: Hymn) {
    try {
      const full = await dataService.hymns.get(hymn.id);
      if (full) setViewingHymn(full);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao carregar letra.', 'error');
    }
  }

  async function handleOpenEdit(hymn: Hymn) {
    try {
      const full = await dataService.hymns.get(hymn.id);
      if (full) {
        setEditingHymn(full);
        setWizardOpen(true);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao carregar hino.', 'error');
    }
  }

  function handleOpenCreate() {
    setEditingHymn(null);
    setWizardOpen(true);
  }

  async function handleCreateFolderStandalone() {
    if (!newFolderName.trim()) {
      onNotify('Indique o nome da pasta.', 'error');
      return;
    }
    try {
      const created = await dataService.folders.create({
        name: newFolderName.trim(),
        collection_type: newFolderCol,
      });
      setFolders((prev) => (prev.some((f) => f.id === created.id) ? prev : [...prev, created]));
      setNewFolderName('');
      setFolderModalOpen(false);
      onNotify(`Pasta "${created.name}" criada.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao criar pasta.', 'error');
    }
  }

  async function handleDuplicateToOutros(hymn: Hymn) {
    try {
      const copy = await dataService.hymns.duplicateToOutros(hymn.id);
      setViewingHymn(null);
      await loadAll();
      setCollectionFilter('Outros');
      setFolderFilter('Todas');
      onNotify(`Cópia "${copy.title}" criada em Outros para personalização.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao duplicar hino.', 'error');
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await dataService.hymns.delete(deleteTarget.id, adminPin || undefined);
      onNotify('Hino eliminado.');
      setDeleteTarget(null);
      await loadAll();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao eliminar hino.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  const visibleFolders = useMemo(
    () =>
      collectionFilter === 'Todas'
        ? folders
        : folders.filter((f) => f.collection_type === collectionFilter),
    [folders, collectionFilter]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return hymns.filter((h) => {
      if (collectionFilter !== 'Todas' && h.collection_type !== collectionFilter) return false;
      if (folderFilter !== 'Todas' && h.folder_id !== folderFilter) return false;
      if (!q) return true;
      return (
        h.number.toLowerCase().includes(q) ||
        h.title.toLowerCase().includes(q) ||
        (h.author || '').toLowerCase().includes(q) ||
        (h.folder_name || '').toLowerCase().includes(q)
      );
    });
  }, [hymns, collectionFilter, folderFilter, search]);

  return (
    <div className="space-y-6">
      {/* Collection Segmented Tabs & Primary Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F3F1EA] border border-[#E5E1D8] rounded-lg">
          {(
            [
              { id: 'Todas', label: 'Todas as Colecções' },
              { id: 'Hinário', label: 'Hinário Adventista' },
              { id: 'Coletânea', label: 'Coletânea Jovem' },
              { id: 'Outros', label: 'Outros' },
            ] as Array<{ id: CollectionFilter; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setCollectionFilter(tab.id);
                setFolderFilter('Todas');
              }}
              className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                collectionFilter === tab.id
                  ? 'bg-white text-[#0F233C] shadow-sm'
                  : 'text-[#5F6B7A] hover:text-[#0F233C]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {isAdminUnlocked && (
            <button
              type="button"
              onClick={() => {
                onAdminLock();
                onNotify('Modo Admin Principal bloqueado novamente.', 'info');
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-lg border border-[#D4A64A] bg-[#D4A64A]/15 text-[#0F233C] hover:bg-[#D4A64A]/25 transition-colors whitespace-nowrap"
              title="Bloquear edição do acervo oficial"
            >
              <ShieldCheck className="w-4 h-4 text-[#1E3A5F]" />
              <span>Admin Activo · Bloquear</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setNewFolderCol(
                isAdminUnlocked
                  ? collectionFilter === 'Todas'
                    ? 'Hinário'
                    : collectionFilter
                  : 'Outros'
              );
              setFolderModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-[#E5E1D8] bg-white text-[#0F233C] hover:bg-[#F3F1EA] transition-colors whitespace-nowrap"
          >
            <FolderPlus className="w-4 h-4 text-[#1E3A5F]" />
            <span>Nova Pasta</span>
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E] transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-[#D4A64A]" />
            <span>Adicionar Hino</span>
          </button>
        </div>
      </div>

      {/* Search & Folder Filter Row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#5F6B7A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por número, título, autor ou pasta..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2">
            <FolderIcon className="w-4 h-4 text-[#5F6B7A] shrink-0" />
            <select
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
              className="px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            >
              <option value="Todas">Todas as pastas</option>
              {visibleFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.collection_type})
                </option>
              ))}
            </select>
          </div>
          {!loading && (
            <span className="text-xs font-medium text-[#5F6B7A] tabular-nums whitespace-nowrap">
              {filtered.length} {filtered.length === 1 ? 'registo' : 'registos'}
            </span>
          )}
        </div>
      </div>

      {/* Hymns List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white rounded-xl border border-[#E5E1D8] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E1D8] p-12 text-center">
          <Music2 className="w-10 h-10 text-[#1E3A5F]/40 mx-auto mb-3" />
          <h3 className="font-editorial text-2xl font-semibold text-[#0F233C]">
            {search || collectionFilter !== 'Todas' || folderFilter !== 'Todas'
              ? 'Nenhum hino encontrado'
              : 'Repositório de hinos vazio'}
          </h3>
          <p className="text-sm text-[#5F6B7A] mt-1 max-w-md mx-auto">
            Adicione hinos e cânticos estruturados por estrofes e coros para utilizar nos programas e na projecção.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E]"
          >
            <Plus className="w-4 h-4 text-[#D4A64A]" />
            <span>Adicionar Hino</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E5E1D8] divide-y divide-[#E5E1D8] overflow-hidden">
          {filtered.map((hymn) => (
            <div
              key={hymn.id}
              className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#FAF9F5]/80 transition-colors"
            >
              <div className="flex items-start md:items-center gap-4 min-w-0">
                <div className="w-16 h-12 px-1.5 rounded-lg bg-[#1E3A5F] text-white flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] uppercase tracking-wider text-[#D4A64A] leading-none">
                    Nº
                  </span>
                  <span
                    className={`font-semibold tabular-nums leading-tight mt-0.5 ${
                      hymn.number.length > 4 ? 'text-xs' : 'text-base'
                    }`}
                  >
                    {hymn.number}
                  </span>
                </div>

                <div className="min-w-0">
                  <h3 className="font-editorial text-xl font-semibold text-[#0F233C] truncate">
                    {hymn.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#5F6B7A] mt-0.5">
                    <span className="font-medium text-[#1E3A5F]">
                      {COLLECTION_LABELS[hymn.collection_type]}
                    </span>
                    {hymn.folder_name && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{hymn.folder_name}</span>
                      </>
                    )}
                    {hymn.author && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{hymn.author}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {hymn.verse_count ?? 0}{' '}
                      {(hymn.verse_count ?? 0) === 1 ? 'estrofe' : 'estrofes'}
                      {(hymn.chorus_count ?? 0) > 0
                        ? ` · ${hymn.chorus_count} ${(hymn.chorus_count ?? 0) === 1 ? 'coro' : 'coros'}`
                        : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <button
                  type="button"
                  onClick={() => handleViewLyrics(hymn)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#FAF9F5] border border-[#E5E1D8] text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white transition-colors whitespace-nowrap"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Ver letra</span>
                </button>
                {hymn.collection_type === 'Outros' || isAdminUnlocked ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(hymn)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#E5E1D8] text-[#0F233C] hover:bg-[#F3F1EA] transition-colors whitespace-nowrap"
                    >
                      <Pencil className="w-3.5 h-3.5 text-[#5F6B7A]" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(hymn)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#E5E1D8] text-red-700 hover:bg-red-50 hover:border-red-200 transition-colors whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onProjectHymn(hymn.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#E5E1D8] text-[#0F233C] hover:bg-[#F3F1EA] transition-colors whitespace-nowrap"
                  >
                    <MonitorPlay className="w-3.5 h-3.5 text-[#D4A64A]" />
                    <span>Projectar</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2-Step Hymn Wizard Modal */}
      <HymnWizardModal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        editingHymn={editingHymn}
        folders={folders}
        adminPin={adminPin}
        onFolderCreated={(folder) =>
          setFolders((prev) => (prev.some((f) => f.id === folder.id) ? prev : [...prev, folder]))
        }
        onSaved={loadAll}
        onNotify={onNotify}
      />

      {/* Lyrics View Modal */}
      <HymnLyricsModal
        hymn={viewingHymn}
        onClose={() => setViewingHymn(null)}
        onProjectHymn={(hymn) => onProjectHymn(hymn.id)}
        onDuplicateToOutros={handleDuplicateToOutros}
      />

      {/* Create Folder Modal */}
      <Modal
        open={folderModalOpen}
        onClose={() => setFolderModalOpen(false)}
        title="Nova Pasta de Hinos"
        subtitle="Organize os cânticos por tema ou momento do culto."
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">Colecção</label>
            <select
              value={newFolderCol}
              disabled={!isAdminUnlocked}
              onChange={(e) => setNewFolderCol(e.target.value as CollectionType)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg disabled:bg-[#FAF9F5] disabled:text-[#5F6B7A]"
            >
              {isAdminUnlocked && (
                <>
                  <option value="Hinário">Hinário Adventista</option>
                  <option value="Coletânea">Coletânea Jovem</option>
                </>
              )}
              <option value="Outros">Outros (Cânticos da Igreja)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Nome da Pasta
            </label>
            <input
              type="text"
              value={newFolderName ?? ''}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Ex: Louvor e Adoração"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E1D8]">
            <button
              type="button"
              onClick={() => setFolderModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-[#5F6B7A] bg-[#FAF9F5] border border-[#E5E1D8] rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateFolderStandalone}
              className="px-5 py-2 text-sm font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#2D5A8E]"
            >
              Criar Pasta
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title="Eliminar Hino"
        message={
          deleteTarget
            ? `Tem a certeza que deseja eliminar o hino "${deleteTarget.number} — ${deleteTarget.title}"?`
            : ''
        }
      />
    </div>
  );
}
