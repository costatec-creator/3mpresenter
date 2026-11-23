import { useEffect, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  Copy,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { dataService, formatDatePt } from '../../services/dataService.ts';
import { ConfirmModal, Modal } from '../../components/Modal.tsx';
import type { Program } from '../../types/index.ts';

interface ProgramsPageProps {
  onOpenProgram: (programId: string) => void;
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function ProgramsPage({ onOpenProgram, onNotify }: ProgramsPageProps) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create / Edit Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Duplicate Modal
  const [duplicateTarget, setDuplicateTarget] = useState<Program | null>(null);
  const [dupTitle, setDupTitle] = useState('');
  const [dupDate, setDupDate] = useState('');
  const [dupDescription, setDupDescription] = useState('');

  // Delete Confirm Modal
  const [deleteTarget, setDeleteTarget] = useState<Program | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadPrograms() {
    setLoading(true);
    try {
      const list = await dataService.programs.list();
      setPrograms(list);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao carregar programas.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPrograms();
  }, []);

  function openCreateModal() {
    setEditingProgram(null);
    setTitle('');
    setDate(new Date().toISOString().slice(0, 10));
    setDescription('');
    setFormOpen(true);
  }

  function openEditModal(program: Program) {
    setEditingProgram(program);
    setTitle(program.title ?? '');
    setDate(program.date ?? '');
    setDescription(program.description || '');
    setFormOpen(true);
  }

  function openDuplicateModal(program: Program) {
    setDuplicateTarget(program);
    setDupTitle(`${program.title ?? ''} (Cópia)`);
    setDupDate(new Date().toISOString().slice(0, 10));
    setDupDescription(program.description || '');
  }

  async function handleSaveProgram(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      onNotify('Indique o título do programa.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingProgram) {
        await dataService.programs.update(editingProgram.id, {
          title: title.trim(),
          date,
          description: description.trim(),
        });
        onNotify('Programa actualizado com sucesso.');
        setFormOpen(false);
        await loadPrograms();
      } else {
        const created = await dataService.programs.create({
          title: title.trim(),
          date,
          description: description.trim(),
        });
        onNotify('Programa criado com sucesso.');
        setFormOpen(false);
        onOpenProgram(created.id);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao guardar programa.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicateSubmit(e: FormEvent) {
    e.preventDefault();
    if (!duplicateTarget) return;
    if (!dupTitle.trim()) {
      onNotify('Indique o novo título para o programa duplicado.', 'error');
      return;
    }
    setSaving(true);
    try {
      const duplicated = await dataService.programs.duplicate(duplicateTarget.id, {
        title: dupTitle.trim(),
        date: dupDate,
        description: dupDescription.trim(),
      });
      onNotify('Programa duplicado mantendo todas as actividades.');
      setDuplicateTarget(null);
      onOpenProgram(duplicated.id);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao duplicar programa.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await dataService.programs.delete(deleteTarget.id);
      onNotify('Programa eliminado.');
      setDeleteTarget(null);
      await loadPrograms();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao eliminar programa.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  const filtered = programs.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      p.date.includes(q)
    );
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
            placeholder="Pesquisar programas por título ou data..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F] text-[#0F233C] placeholder:text-[#5F6B7A]/70"
          />
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E] transition-colors shadow-sm whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4 text-[#D4A64A]" />
          <span>Novo Programa</span>
        </button>
      </div>

      {/* Program Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 bg-white rounded-xl border border-[#E5E1D8] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E1D8] p-12 text-center">
          <CalendarDays className="w-10 h-10 text-[#1E3A5F]/40 mx-auto mb-3" />
          <h3 className="font-editorial text-2xl font-semibold text-[#0F233C]">
            {search ? 'Nenhum programa encontrado' : 'Sem programas registados'}
          </h3>
          <p className="text-sm text-[#5F6B7A] mt-1 max-w-md mx-auto">
            {search
              ? 'Altere os termos de pesquisa para ver outros programas.'
              : 'Crie o primeiro programa para organizar a ordem do culto e preparar a projecção.'}
          </p>
          {!search && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E] transition-colors"
            >
              <Plus className="w-4 h-4 text-[#D4A64A]" />
              <span>Novo Programa</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((program) => (
            <article
              key={program.id}
              className="bg-white rounded-xl border border-[#E5E1D8] p-6 flex flex-col justify-between hover:border-[#2D5A8E]/40 hover:shadow-sm transition-all"
            >
              <div>
                <div className="flex items-center gap-2 text-xs text-[#5F6B7A] tabular-nums">
                  <span>{formatDatePt(program.date)}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {program.activity_count ?? 0}{' '}
                    {(program.activity_count ?? 0) === 1 ? 'actividade' : 'actividades'}
                  </span>
                </div>
                <h3 className="font-editorial text-2xl font-semibold text-[#0F233C] mt-1.5 leading-snug">
                  {program.title}
                </h3>
                {program.description && (
                  <p className="text-sm text-[#5F6B7A] mt-2 line-clamp-2 leading-relaxed">
                    {program.description}
                  </p>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-[#E5E1D8] flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onOpenProgram(program.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E] transition-colors whitespace-nowrap"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Ver detalhes</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(program)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#E5E1D8] text-[#0F233C] hover:bg-[#F3F1EA] transition-colors whitespace-nowrap"
                  >
                    <Pencil className="w-3.5 h-3.5 text-[#5F6B7A]" />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openDuplicateModal(program)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#E5E1D8] text-[#0F233C] hover:bg-[#F3F1EA] transition-colors whitespace-nowrap"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#5F6B7A]" />
                    <span>Duplicar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(program)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#E5E1D8] text-red-700 hover:bg-red-50 hover:border-red-200 transition-colors whitespace-nowrap"
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

      {/* Create / Edit Program Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingProgram ? 'Editar Programa' : 'Novo Programa'}
        subtitle={
          editingProgram
            ? 'Actualize os dados principais do programa.'
            : 'Preencha os detalhes para criar um novo programa.'
        }
      >
        <form onSubmit={handleSaveProgram} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Título do Programa <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Culto Divino - Especial Jovem"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Data <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Descrição <span className="text-xs font-normal text-[#5F6B7A]">(opcional)</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notas ou tema especial deste culto..."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F] resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E1D8]">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-sm font-medium text-[#5F6B7A] bg-[#FAF9F5] border border-[#E5E1D8] rounded-lg hover:bg-[#F3F1EA]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#2D5A8E] disabled:opacity-60"
            >
              {saving ? 'A guardar...' : editingProgram ? 'Guardar Alterações' : 'Criar Programa'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Duplicate Program Modal */}
      <Modal
        open={Boolean(duplicateTarget)}
        onClose={() => setDuplicateTarget(null)}
        title="Duplicar Programa"
        subtitle="Todas as actividades da ordem do culto original serão mantidas."
      >
        <form onSubmit={handleDuplicateSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Novo título <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={dupTitle}
              onChange={(e) => setDupTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Data <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              required
              value={dupDate}
              onChange={(e) => setDupDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Descrição <span className="text-xs font-normal text-[#5F6B7A]">(opcional)</span>
            </label>
            <textarea
              rows={3}
              value={dupDescription}
              onChange={(e) => setDupDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F] resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E1D8]">
            <button
              type="button"
              onClick={() => setDuplicateTarget(null)}
              className="px-4 py-2 text-sm font-medium text-[#5F6B7A] bg-[#FAF9F5] border border-[#E5E1D8] rounded-lg hover:bg-[#F3F1EA]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#2D5A8E] disabled:opacity-60"
            >
              {saving ? 'A duplicar...' : 'Duplicar Programa'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title="Eliminar Programa"
        message={
          deleteTarget
            ? `Tem a certeza que deseja eliminar o programa "${deleteTarget.title}" e todas as suas actividades? Esta acção não pode ser desfeita.`
            : ''
        }
      />
    </div>
  );
}
