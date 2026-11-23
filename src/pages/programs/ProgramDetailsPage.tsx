import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  MonitorPlay,
  Music2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { dataService, formatDatePt } from '../../services/dataService.ts';
import { ConfirmModal, Modal } from '../../components/Modal.tsx';
import type { Activity, Hymn, ProgramWithActivities } from '../../types/index.ts';

interface ProgramDetailsPageProps {
  programId: string;
  onBack: () => void;
  onOpenProjection: (programId: string) => void;
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function ProgramDetailsPage({
  programId,
  onBack,
  onOpenProjection,
  onNotify,
}: ProgramDetailsPageProps) {
  const [program, setProgram] = useState<ProgramWithActivities | null>(null);
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Program Modal
  const [editProgOpen, setEditProgOpen] = useState(false);
  const [progTitle, setProgTitle] = useState('');
  const [progDate, setProgDate] = useState('');
  const [progDesc, setProgDesc] = useState('');
  const [savingProg, setSavingProg] = useState(false);

  // Add / Edit Activity Modal
  const [actModalOpen, setActModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [actName, setActName] = useState('');
  const [actActivist, setActActivist] = useState('');
  const [actRole, setActRole] = useState('');
  const [actHymnId, setActHymnId] = useState<string>('');
  const [actHymnSearch, setActHymnSearch] = useState<string>('');
  const [savingAct, setSavingAct] = useState(false);

  // Delete Activity Confirm
  const [deleteActTarget, setDeleteActTarget] = useState<Activity | null>(null);
  const [deletingAct, setDeletingAct] = useState(false);

  async function loadDetails() {
    setLoading(true);
    try {
      const [progData, hymnsList] = await Promise.all([
        dataService.programs.get(programId),
        dataService.hymns.list(),
      ]);
      setProgram(progData);
      setHymns(hymnsList);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao carregar programa.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetails();
  }, [programId]);

  function openEditProgram() {
    if (!program) return;
    setProgTitle(program.title ?? '');
    setProgDate(program.date ?? '');
    setProgDesc(program.description || '');
    setEditProgOpen(true);
  }

  async function handleUpdateProgram(e: FormEvent) {
    e.preventDefault();
    if (!program || !progTitle.trim()) return;
    setSavingProg(true);
    try {
      await dataService.programs.update(program.id, {
        title: progTitle.trim(),
        date: progDate,
        description: progDesc.trim(),
      });
      onNotify('Detalhes do programa actualizados.');
      setEditProgOpen(false);
      await loadDetails();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao actualizar programa.', 'error');
    } finally {
      setSavingProg(false);
    }
  }

  function openAddActivity() {
    setEditingActivity(null);
    setActName('');
    setActActivist('');
    setActRole('');
    setActHymnId('');
    setActHymnSearch('');
    setActModalOpen(true);
  }

  function openEditActivity(act: Activity) {
    setEditingActivity(act);
    setActName(act.name ?? '');
    setActActivist(act.activist ?? '');
    setActRole(act.role || '');
    setActHymnId(act.hymn_id || '');
    setActHymnSearch('');
    setActModalOpen(true);
  }

  function handleHymnSelect(hymnId: string) {
    setActHymnId(hymnId);
    setActHymnSearch('');
    if (hymnId && !actName.trim()) {
      const found = hymns.find((h) => h.id === hymnId);
      if (found) {
        setActName(
          found.collection_type === 'Coletânea'
            ? `${found.number} - ${found.title}`
            : `Hino ${found.number} - ${found.title}`
        );
      }
    }
  }

  const selectedHymnObj = useMemo(
    () => (actHymnId ? hymns.find((h) => h.id === actHymnId) ?? null : null),
    [hymns, actHymnId]
  );

  const filteredHymnOptions = useMemo(() => {
    const raw = actHymnSearch.trim();
    if (!raw) return hymns.slice(0, 12);
    const normalize = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const q = normalize(raw);
    const isNum = /^\d+$/.test(raw);
    const qNum = isNum ? Number.parseInt(raw, 10) : NaN;
    const matches = hymns.filter((h) => {
      if (isNum && /^\d+$/.test(h.number.trim()) && Number.parseInt(h.number.trim(), 10) === qNum) {
        return true;
      }
      return (
        h.number.toLowerCase().includes(q) ||
        normalize(h.title).includes(q) ||
        normalize(h.collection_type).includes(q)
      );
    });
    matches.sort((a, b) => {
      const aExact = isNum && Number.parseInt(a.number.trim(), 10) === qNum ? 0 : 1;
      const bExact = isNum && Number.parseInt(b.number.trim(), 10) === qNum ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return a.number.localeCompare(b.number);
    });
    return matches.slice(0, 20);
  }, [hymns, actHymnSearch]);

  async function handleSaveActivity(e: FormEvent) {
    e.preventDefault();
    if (!program) return;
    if (!actName.trim() || !actActivist.trim()) {
      onNotify('Indique o nome da actividade e do activista.', 'error');
      return;
    }
    setSavingAct(true);
    try {
      if (editingActivity) {
        await dataService.activities.update(editingActivity.id, {
          name: actName.trim(),
          activist: actActivist.trim(),
          role: actRole.trim(),
          hymn_id: actHymnId || null,
        });
        onNotify('Actividade actualizada.');
      } else {
        await dataService.activities.create(program.id, {
          name: actName.trim(),
          activist: actActivist.trim(),
          role: actRole.trim(),
          hymn_id: actHymnId || null,
        });
        onNotify('Actividade adicionada à ordem do culto.');
      }
      setActModalOpen(false);
      await loadDetails();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao guardar actividade.', 'error');
    } finally {
      setSavingAct(false);
    }
  }

  async function handleMoveActivity(index: number, direction: -1 | 1) {
    if (!program) return;
    const list = [...program.activities];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const [moved] = list.splice(index, 1);
    list.splice(targetIndex, 0, moved);

    // Optimistic update then persist
    setProgram({ ...program, activities: list });
    try {
      const updated = await dataService.activities.reorder(
        program.id,
        list.map((a) => a.id)
      );
      setProgram({ ...program, activities: updated });
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao reordenar.', 'error');
      await loadDetails();
    }
  }

  async function handleDeleteActivityConfirm() {
    if (!deleteActTarget) return;
    setDeletingAct(true);
    try {
      await dataService.activities.delete(deleteActTarget.id);
      onNotify('Actividade removida.');
      setDeleteActTarget(null);
      await loadDetails();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao eliminar actividade.', 'error');
    } finally {
      setDeletingAct(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-white rounded-xl border border-[#E5E1D8] animate-pulse" />
        <div className="h-64 bg-white rounded-xl border border-[#E5E1D8] animate-pulse" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E1D8] p-10 text-center">
        <p className="text-base font-medium text-[#0F233C]">Programa não encontrado.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#1E3A5F] text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar aos Programas
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb Action */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#5F6B7A] hover:text-[#0F233C] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Programas</span>
        </button>
      </div>

      {/* Program Summary Card */}
      <section className="bg-white rounded-xl border border-[#E5E1D8] p-6 sm:p-7 flex flex-col lg:flex-row lg:items-start justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="text-xs font-medium text-[#5F6B7A] tabular-nums">
            {formatDatePt(program.date)} · {program.activities.length}{' '}
            {program.activities.length === 1 ? 'actividade' : 'actividades'}
          </div>
          <h2 className="font-editorial text-3xl font-semibold text-[#0F233C] leading-tight">
            {program.title}
          </h2>
          {program.description && (
            <p className="text-sm text-[#5F6B7A] leading-relaxed">{program.description}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={openEditProgram}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-[#E5E1D8] bg-[#FAF9F5] text-[#0F233C] hover:bg-[#F3F1EA] transition-colors whitespace-nowrap"
          >
            <Pencil className="w-4 h-4 text-[#5F6B7A]" />
            <span>Editar Programa</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenProjection(program.id)}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E] transition-colors shadow-sm whitespace-nowrap"
          >
            <MonitorPlay className="w-4 h-4 text-[#D4A64A]" />
            <span>Controlo de Projecção</span>
          </button>
        </div>
      </section>

      {/* Ordem do Culto */}
      <section className="bg-white rounded-xl border border-[#E5E1D8] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E1D8] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FAF9F5]/60">
          <div>
            <h3 className="font-editorial text-2xl font-semibold text-[#0F233C]">
              Ordem do Culto
            </h3>
            <p className="text-xs text-[#5F6B7A]">
              Organize a sequência das actividades. A ordem é guardada automaticamente.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddActivity}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 text-[#D4A64A]" />
            <span>Adicionar Actividade</span>
          </button>
        </div>

        {program.activities.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-base font-medium text-[#0F233C]">
              Este programa ainda não tem actividades na ordem do culto.
            </p>
            <p className="text-sm text-[#5F6B7A] mt-1">
              Adicione oração de abertura, hinos, leitura bíblica, mensagem musical ou sermão.
            </p>
            <button
              type="button"
              onClick={openAddActivity}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E]"
            >
              <Plus className="w-4 h-4 text-[#D4A64A]" />
              <span>Adicionar Primeira Actividade</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E1D8]">
            {program.activities.map((act, idx) => (
              <div
                key={act.id}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAF9F5]/70 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-4 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[#FAF9F5] border border-[#E5E1D8] flex items-center justify-center text-sm font-semibold text-[#1E3A5F] tabular-nums shrink-0">
                    {String(idx + 1).padStart(2, '0')}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-semibold text-[#0F233C] truncate">
                        {act.name}
                      </h4>
                      {act.hymn_id && (
                        <Music2
                          className="w-3.5 h-3.5 text-[#D4A64A] shrink-0"
                          aria-label="Hino associado"
                        />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#5F6B7A] mt-0.5">
                      <span className="font-medium text-[#0F233C]/80">{act.activist}</span>
                      {act.role && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{act.role}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMoveActivity(idx, -1)}
                    className="p-2 rounded-lg border border-[#E5E1D8] text-[#5F6B7A] hover:text-[#0F233C] hover:bg-[#F3F1EA] disabled:opacity-35 disabled:pointer-events-none transition-colors"
                    title="Mover para cima"
                    aria-label="Mover actividade para cima"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === program.activities.length - 1}
                    onClick={() => handleMoveActivity(idx, 1)}
                    className="p-2 rounded-lg border border-[#E5E1D8] text-[#5F6B7A] hover:text-[#0F233C] hover:bg-[#F3F1EA] disabled:opacity-35 disabled:pointer-events-none transition-colors"
                    title="Mover para baixo"
                    aria-label="Mover actividade para baixo"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditActivity(act)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border border-[#E5E1D8] text-[#0F233C] hover:bg-[#F3F1EA] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-[#5F6B7A]" />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteActTarget(act)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border border-[#E5E1D8] text-red-700 hover:bg-red-50 hover:border-red-200 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Edit Program Modal */}
      <Modal
        open={editProgOpen}
        onClose={() => setEditProgOpen(false)}
        title="Editar Programa"
      >
        <form onSubmit={handleUpdateProgram} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Título do Programa <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={progTitle}
              onChange={(e) => setProgTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">Data</label>
            <input
              type="date"
              required
              value={progDate}
              onChange={(e) => setProgDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Descrição <span className="text-xs font-normal text-[#5F6B7A]">(opcional)</span>
            </label>
            <textarea
              rows={3}
              value={progDesc}
              onChange={(e) => setProgDesc(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F] resize-none"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E1D8]">
            <button
              type="button"
              onClick={() => setEditProgOpen(false)}
              className="px-4 py-2 text-sm font-medium text-[#5F6B7A] bg-[#FAF9F5] border border-[#E5E1D8] rounded-lg hover:bg-[#F3F1EA]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingProg}
              className="px-5 py-2 text-sm font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#2D5A8E]"
            >
              {savingProg ? 'A guardar...' : 'Guardar Alterações'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Activity Modal */}
      <Modal
        open={actModalOpen}
        onClose={() => setActModalOpen(false)}
        title={editingActivity ? 'Editar Actividade' : 'Adicionar Actividade'}
        subtitle="Defina o momento da ordem do culto e o respectivo responsável."
      >
        <form onSubmit={handleSaveActivity} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Nome da Actividade <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={actName}
              onChange={(e) => setActName(e.target.value)}
              placeholder="Ex: Oração de abertura, Leitura bíblica, Sermão..."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Associar Hino do Repositório{' '}
              <span className="text-xs font-normal text-[#5F6B7A]">(opcional)</span>
            </label>
            {selectedHymnObj ? (
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#FAF9F5] border border-[#1E3A5F]/30 rounded-lg">
                <div className="min-w-0 flex items-center gap-2">
                  <Music2 className="w-4 h-4 text-[#D4A64A] shrink-0" />
                  <span className="text-sm font-medium text-[#0F233C] truncate">
                    {selectedHymnObj.collection_type === 'Coletânea'
                      ? `${selectedHymnObj.number} — ${selectedHymnObj.title} (Coletânea Jovem)`
                      : `Hino ${selectedHymnObj.number} — ${selectedHymnObj.title} (${selectedHymnObj.collection_type})`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActHymnId('')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-[#E5E1D8] bg-white text-[#5F6B7A] hover:text-red-700 hover:border-red-200 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Remover</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#5F6B7A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={actHymnSearch ?? ''}
                    onChange={(e) => setActHymnSearch(e.target.value)}
                    placeholder="Escreva o número ou nome do hino (ex: 32, 2013-02, Amor)..."
                    className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                  />
                </div>
                {actHymnSearch.trim().length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-[#E5E1D8] divide-y divide-[#E5E1D8] bg-white">
                    {filteredHymnOptions.length === 0 ? (
                      <div className="px-3 py-2.5 text-xs text-[#5F6B7A]">
                        Nenhum hino encontrado para &ldquo;{actHymnSearch.trim()}&rdquo;.
                      </div>
                    ) : (
                      filteredHymnOptions.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => handleHymnSelect(h.id)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-[#FAF9F5] flex items-center justify-between gap-2"
                        >
                          <span className="font-medium text-[#0F233C] truncate">
                            <span className="font-semibold text-[#1E3A5F] tabular-nums">
                              {h.number}
                            </span>{' '}
                            — {h.title}
                          </span>
                          <span className="text-[11px] text-[#5F6B7A] shrink-0">
                            {h.collection_type}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Nome do Activista <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={actActivist}
              onChange={(e) => setActActivist(e.target.value)}
              placeholder="Ex: Pr. Manuel Ferreira, Congregação..."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Cargo <span className="text-xs font-normal text-[#5F6B7A]">(opcional)</span>
            </label>
            <input
              type="text"
              value={actRole}
              onChange={(e) => setActRole(e.target.value)}
              placeholder="Ex: Ancião, Diácono, Director de Louvor..."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E1D8]">
            <button
              type="button"
              onClick={() => setActModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-[#5F6B7A] bg-[#FAF9F5] border border-[#E5E1D8] rounded-lg hover:bg-[#F3F1EA]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingAct}
              className="px-5 py-2 text-sm font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#2D5A8E]"
            >
              {savingAct
                ? 'A guardar...'
                : editingActivity
                  ? 'Guardar Alterações'
                  : 'Adicionar Actividade'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Activity Confirm */}
      <ConfirmModal
        open={Boolean(deleteActTarget)}
        onClose={() => setDeleteActTarget(null)}
        onConfirm={handleDeleteActivityConfirm}
        loading={deletingAct}
        title="Eliminar Actividade"
        message={
          deleteActTarget
            ? `Deseja remover "${deleteActTarget.name}" da ordem do culto?`
            : ''
        }
      />
    </div>
  );
}
