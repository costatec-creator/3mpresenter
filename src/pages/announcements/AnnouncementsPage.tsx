import { useEffect, useState, type FormEvent } from 'react';
import { Megaphone, MonitorPlay, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { dataService, formatDateTimePt } from '../../services/dataService.ts';
import { ConfirmModal, Modal } from '../../components/Modal.tsx';
import type { Announcement } from '../../types/index.ts';

interface AnnouncementsPageProps {
  onProjectAnnouncement: (announcementId: string) => void;
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function AnnouncementsPage({ onProjectAnnouncement, onNotify }: AnnouncementsPageProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal Create / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Confirm Delete
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadAnnouncements() {
    setLoading(true);
    try {
      const list = await dataService.announcements.list();
      setAnnouncements(list);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao carregar anúncios.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnnouncements();
  }, []);

  function openCreate() {
    setEditing(null);
    setTitle('');
    setContent('');
    setModalOpen(true);
  }

  function openEdit(item: Announcement) {
    setEditing(item);
    setTitle(item.title ?? '');
    setContent(item.content ?? '');
    setModalOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      onNotify('Preencha o título e o conteúdo do anúncio.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await dataService.announcements.update(editing.id, {
          title: title.trim(),
          content: content.trim(),
        });
        onNotify('Anúncio actualizado com sucesso.');
      } else {
        await dataService.announcements.create({
          title: title.trim(),
          content: content.trim(),
        });
        onNotify('Anúncio registado com sucesso.');
      }
      setModalOpen(false);
      await loadAnnouncements();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao guardar anúncio.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await dataService.announcements.delete(deleteTarget.id);
      onNotify('Anúncio eliminado.');
      setDeleteTarget(null);
      await loadAnnouncements();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao eliminar anúncio.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  const filtered = announcements.filter((a) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#5F6B7A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar anúncios..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
          />
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E] transition-colors shadow-sm whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4 text-[#D4A64A]" />
          <span>Novo Anúncio</span>
        </button>
      </div>

      {/* Announcements List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-white rounded-xl border border-[#E5E1D8] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E1D8] p-12 text-center">
          <Megaphone className="w-10 h-10 text-[#1E3A5F]/40 mx-auto mb-3" />
          <h3 className="font-editorial text-2xl font-semibold text-[#0F233C]">
            {search ? 'Nenhum anúncio encontrado' : 'Sem anúncios registados'}
          </h3>
          <p className="text-sm text-[#5F6B7A] mt-1 max-w-md mx-auto">
            {search
              ? 'Tente outro termo de pesquisa.'
              : 'Registe os avisos da igreja para os manter acessíveis e projectá-los para a congregação.'}
          </p>
          {!search && (
            <button
              type="button"
              onClick={openCreate}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E]"
            >
              <Plus className="w-4 h-4 text-[#D4A64A]" />
              <span>Novo Anúncio</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="bg-white rounded-xl border border-[#E5E1D8] p-6 flex flex-col justify-between hover:border-[#2D5A8E]/40 hover:shadow-sm transition-all"
            >
              <div>
                <div className="text-xs text-[#5F6B7A] tabular-nums">
                  Registado em {formatDateTimePt(item.created_at)}
                </div>
                <h3 className="font-editorial text-2xl font-semibold text-[#0F233C] mt-1.5 leading-snug">
                  {item.title}
                </h3>
                <p className="text-sm text-[#0F233C]/85 mt-3 whitespace-pre-line leading-relaxed">
                  {item.content}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E5E1D8] flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onProjectAnnouncement(item.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E] transition-colors"
                >
                  <MonitorPlay className="w-3.5 h-3.5 text-[#D4A64A]" />
                  <span>Projectar</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-[#E5E1D8] text-[#0F233C] hover:bg-[#F3F1EA] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-[#5F6B7A]" />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-[#E5E1D8] text-red-700 hover:bg-red-50 hover:border-red-200 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* New / Edit Announcement Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Anúncio' : 'Novo Anúncio'}
        subtitle="Registe um aviso para a congregação."
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Título do Anúncio <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reunião Jovem - Sábado à tarde"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Conteúdo / Detalhes <span className="text-red-600">*</span>
            </label>
            <textarea
              rows={5}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreva todos os detalhes importantes do anúncio..."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F] resize-y"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E1D8]">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-[#5F6B7A] bg-[#FAF9F5] border border-[#E5E1D8] rounded-lg hover:bg-[#F3F1EA]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#2D5A8E] disabled:opacity-60"
            >
              {saving ? 'A guardar...' : 'Guardar Anúncio'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title="Eliminar Anúncio"
        message={
          deleteTarget
            ? `Tem a certeza que deseja eliminar o anúncio "${deleteTarget.title}"?`
            : ''
        }
      />
    </div>
  );
}
