import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, FolderPlus, Plus, Trash2 } from 'lucide-react';
import { dataService } from '../../services/dataService.ts';
import { Modal } from '../../components/Modal.tsx';
import type { CollectionType, Folder, Hymn, HymnSectionType } from '../../types/index.ts';

interface DraftSection {
  tempId: string;
  section_type: HymnSectionType;
  content: string;
}

interface HymnWizardModalProps {
  open: boolean;
  onClose: () => void;
  editingHymn: Hymn | null;
  folders: Folder[];
  adminPin?: string | null;
  onFolderCreated: (folder: Folder) => void;
  onSaved: () => void;
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function HymnWizardModal({
  open,
  onClose,
  editingHymn,
  folders,
  adminPin,
  onFolderCreated,
  onSaved,
  onNotify,
}: HymnWizardModalProps) {
  const isAdminUnlocked = Boolean(adminPin);
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 fields
  const [number, setNumber] = useState('');
  const [collectionType, setCollectionType] = useState<CollectionType>(isAdminUnlocked ? 'Hinário' : 'Outros');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [folderId, setFolderId] = useState<string>('');

  // Inline new folder creation
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [savingFolder, setSavingFolder] = useState(false);

  // Step 2 sections
  const [sections, setSections] = useState<DraftSection[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setCreatingFolder(false);
    setNewFolderName('');

    if (editingHymn) {
      setNumber(editingHymn.number ?? '');
      setCollectionType(editingHymn.collection_type || 'Hinário');
      setTitle(editingHymn.title ?? '');
      setAuthor(editingHymn.author || '');
      setFolderId(editingHymn.folder_id || '');
      const existingSections = (editingHymn.sections || []).map((s, idx) => ({
        tempId: `${s.id || idx}-${Math.random().toString(36).slice(2, 6)}`,
        section_type: s.section_type || 'Estrofe',
        content: s.content ?? '',
      }));
      setSections(
        existingSections.length > 0
          ? existingSections
          : [{ tempId: 'sec-1', section_type: 'Estrofe', content: '' }]
      );
    } else {
      setNumber('');
      setCollectionType(isAdminUnlocked ? 'Hinário' : 'Outros');
      setTitle('');
      setAuthor('');
      setFolderId('');
      setSections([{ tempId: 'sec-1', section_type: 'Estrofe', content: '' }]);
    }
  }, [open, editingHymn, isAdminUnlocked]);

  const availableFolders = folders.filter((f) => f.collection_type === collectionType);

  async function handleCreateFolder() {
    if (!newFolderName.trim()) {
      onNotify('Indique o nome da nova pasta.', 'error');
      return;
    }
    setSavingFolder(true);
    try {
      const created = await dataService.folders.create({
        name: newFolderName.trim(),
        collection_type: collectionType,
      });
      onFolderCreated(created);
      setFolderId(created.id);
      setNewFolderName('');
      setCreatingFolder(false);
      onNotify(`Pasta "${created.name}" criada.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao criar pasta.', 'error');
    } finally {
      setSavingFolder(false);
    }
  }

  function handleNextStep() {
    if (!number.trim()) {
      onNotify('Indique o número do hino ou cântico.', 'error');
      return;
    }
    if (!title.trim()) {
      onNotify('Indique o título do hino ou cântico.', 'error');
      return;
    }
    setStep(2);
  }

  function addSection(type: HymnSectionType) {
    setSections((prev) => [
      ...prev,
      {
        tempId: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        section_type: type,
        content: '',
      },
    ]);
  }

  function updateSectionContent(tempId: string, content: string) {
    setSections((prev) => prev.map((s) => (s.tempId === tempId ? { ...s, content } : s)));
  }

  function updateSectionType(tempId: string, section_type: HymnSectionType) {
    setSections((prev) => prev.map((s) => (s.tempId === tempId ? { ...s, section_type } : s)));
  }

  function moveSection(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const copy = [...sections];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    setSections(copy);
  }

  function removeSection(tempId: string) {
    setSections((prev) => prev.filter((s) => s.tempId !== tempId));
  }

  async function handleSubmitHymn() {
    const nonEmpty = sections.filter((s) => s.content.trim().length > 0);
    if (nonEmpty.length === 0) {
      onNotify('Adicione pelo menos uma estrofe ou coro com letra.', 'error');
      return;
    }

    const selectedFolder = folders.find((f) => f.id === folderId);
    setSaving(true);
    try {
      const payload = {
        number: number.trim(),
        collection_type: isAdminUnlocked ? collectionType : 'Outros',
        title: title.trim(),
        author: author.trim(),
        folder_id: folderId || null,
        folder_name: selectedFolder ? selectedFolder.name : '',
        sections: nonEmpty.map((s) => ({
          section_type: s.section_type,
          content: s.content.trim(),
        })),
        adminPin: adminPin || undefined,
      };

      if (editingHymn) {
        await dataService.hymns.update(editingHymn.id, payload);
        onNotify('Hino actualizado com sucesso.');
      } else {
        await dataService.hymns.create(payload);
        onNotify('Hino guardado no repositório.');
      }
      onSaved();
      onClose();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao guardar hino.', 'error');
    } finally {
      setSaving(false);
    }
  }

  // Compute readable labels for each section in Step 2
  let estrofeCounter = 0;
  let coroCounter = 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingHymn ? 'Editar Hino' : 'Adicionar Hino'}
      subtitle={
        step === 1
          ? 'Passo 1 de 2 — Detalhes do hino'
          : 'Passo 2 de 2 — Adicionar estrofes e coro'
      }
      maxWidthClass="max-w-2xl"
    >
      {/* Stepper Indicator */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#E5E1D8]">
        <button
          type="button"
          onClick={() => setStep(1)}
          className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            step === 1
              ? 'bg-[#1E3A5F] text-white'
              : 'bg-[#FAF9F5] text-[#5F6B7A] border border-[#E5E1D8]'
          }`}
        >
          <span className="tabular-nums">1.</span>
          <span>Detalhes do hino</span>
        </button>
        <div className="h-px flex-1 bg-[#E5E1D8]" />
        <button
          type="button"
          onClick={() => {
            if (number.trim() && title.trim()) setStep(2);
          }}
          className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            step === 2
              ? 'bg-[#1E3A5F] text-white'
              : 'bg-[#FAF9F5] text-[#5F6B7A] border border-[#E5E1D8]'
          }`}
        >
          <span className="tabular-nums">2.</span>
          <span>Estrofes e coro</span>
        </button>
      </div>

      {step === 1 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
                Número <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Ex: 32"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F] tabular-nums"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
                Tipo / Colecção <span className="text-red-600">*</span>
              </label>
              <select
                value={collectionType}
                disabled={!isAdminUnlocked}
                onChange={(e) => {
                  const val = e.target.value as CollectionType;
                  setCollectionType(val);
                  setFolderId('');
                }}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F] disabled:bg-[#FAF9F5] disabled:text-[#5F6B7A]"
              >
                {isAdminUnlocked && (
                  <>
                    <option value="Hinário">Hinário (Hinário Adventista)</option>
                    <option value="Coletânea">Coletânea (Coletânea Jovem)</option>
                  </>
                )}
                <option value="Outros">Outros (Cânticos da Igreja)</option>
              </select>
              {!isAdminUnlocked && (
                <p className="text-[11px] text-[#5F6B7A] mt-1">
                  O Hinário e a Coletânea estão protegidos. Novos cânticos são guardados em Outros.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Título <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: O Grande Amor de Deus"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Autor <span className="text-xs font-normal text-[#5F6B7A]">(opcional)</span>
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Ex: Frederick M. Lehman"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-[#0F233C]">
                Pasta <span className="text-xs font-normal text-[#5F6B7A]">(opcional)</span>
              </label>
              <button
                type="button"
                onClick={() => setCreatingFolder((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A5F] hover:text-[#2D5A8E]"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>{creatingFolder ? 'Fechar' : 'Nova pasta'}</span>
              </button>
            </div>

            {creatingFolder && (
              <div className="mb-2.5 flex items-center gap-2 p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E5E1D8]">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder={`Nome da pasta em ${collectionType}...`}
                  className="flex-1 px-3 py-1.5 text-sm bg-white border border-[#E5E1D8] rounded-md focus:outline-none focus:border-[#1E3A5F]"
                />
                <button
                  type="button"
                  disabled={savingFolder}
                  onClick={handleCreateFolder}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-[#1E3A5F] text-white hover:bg-[#2D5A8E] whitespace-nowrap"
                >
                  {savingFolder ? 'A criar...' : 'Criar Pasta'}
                </button>
              </div>
            )}

            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            >
              <option value="">Sem pasta específica</option>
              {availableFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E1D8]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#5F6B7A] bg-[#FAF9F5] border border-[#E5E1D8] rounded-lg hover:bg-[#F3F1EA]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleNextStep}
              className="px-5 py-2 text-sm font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#2D5A8E]"
            >
              Próximo
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FAF9F5] p-3 rounded-lg border border-[#E5E1D8]">
            <span className="text-xs font-medium text-[#5F6B7A]">
              Hino {number} — <strong className="text-[#0F233C]">{title}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => addSection('Estrofe')}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-[#E5E1D8] text-[#0F233C] hover:bg-[#F3F1EA]"
              >
                <Plus className="w-3.5 h-3.5 text-[#1E3A5F]" />
                <span>Adicionar Estrofe</span>
              </button>
              <button
                type="button"
                onClick={() => addSection('Coro')}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-[#D4A64A]/60 text-[#0F233C] hover:bg-[#D4A64A]/10"
              >
                <Plus className="w-3.5 h-3.5 text-[#D4A64A]" />
                <span>Adicionar Coro</span>
              </button>
            </div>
          </div>

          <div className="space-y-4 max-h-[46vh] overflow-y-auto pr-1">
            {sections.map((sec, idx) => {
              if (sec.section_type === 'Estrofe') {
                estrofeCounter += 1;
              } else {
                coroCounter += 1;
              }
              const secLabel =
                sec.section_type === 'Estrofe'
                  ? `Estrofe ${estrofeCounter}`
                  : coroCounter > 1
                    ? `Coro ${coroCounter}`
                    : 'Coro';

              return (
                <div
                  key={sec.tempId}
                  className="p-4 rounded-xl border border-[#E5E1D8] bg-[#FAF9F5]/60 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-semibold text-[#1E3A5F] tabular-nums">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <select
                        value={sec.section_type}
                        onChange={(e) =>
                          updateSectionType(sec.tempId, e.target.value as HymnSectionType)
                        }
                        className="px-2.5 py-1 text-xs font-medium bg-white border border-[#E5E1D8] rounded-md text-[#0F233C]"
                      >
                        <option value="Estrofe">Estrofe</option>
                        <option value="Coro">Coro</option>
                      </select>
                      <span className="text-xs font-medium text-[#5F6B7A]">{secLabel}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveSection(idx, -1)}
                        className="p-1.5 rounded-md border border-[#E5E1D8] bg-white text-[#5F6B7A] hover:text-[#0F233C] disabled:opacity-35"
                        title="Mover para cima"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === sections.length - 1}
                        onClick={() => moveSection(idx, 1)}
                        className="p-1.5 rounded-md border border-[#E5E1D8] bg-white text-[#5F6B7A] hover:text-[#0F233C] disabled:opacity-35"
                        title="Mover para baixo"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={sections.length <= 1}
                        onClick={() => removeSection(sec.tempId)}
                        className="p-1.5 rounded-md border border-[#E5E1D8] bg-white text-red-700 hover:bg-red-50 disabled:opacity-35"
                        title="Remover secção"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={4}
                    value={sec.content}
                    onChange={(e) => updateSectionContent(sec.tempId, e.target.value)}
                    placeholder={`Escreva a letra da secção (${secLabel})...`}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F] resize-y leading-relaxed"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#E5E1D8]">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 text-sm font-medium text-[#0F233C] bg-[#FAF9F5] border border-[#E5E1D8] rounded-lg hover:bg-[#F3F1EA]"
            >
              Anterior
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[#5F6B7A] hover:text-[#0F233C]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSubmitHymn}
                className="px-5 py-2 text-sm font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#2D5A8E] disabled:opacity-60"
              >
                {saving ? 'A guardar...' : 'Guardar Hino'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
