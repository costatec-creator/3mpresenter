import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Check,
  DatabaseBackup,
  Download,
  Image as ImageIcon,
  Lock,
  MessageSquarePlus,
  Monitor,
  Palette,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { dataService } from '../../services/dataService.ts';
import { ConfirmModal } from '../../components/Modal.tsx';
import {
  APP_VERSION,
  CATALOG_VERSION,
  checkForAppUpdate,
  type UpdateCheckResult,
} from '../../config/appMeta.ts';
import type { AppSettings, BackgroundType, BackupPayload, DisplayInfo } from '../../types/index.ts';

interface SettingsPageProps {
  settings: AppSettings;
  adminPin?: string | null;
  updateInfo?: UpdateCheckResult | null;
  onAdminUnlock: (pin: string) => void;
  onAdminLock: () => void;
  onUpdateInfoChange: (info: UpdateCheckResult | null) => void;
  onSettingsUpdated: (settings: AppSettings) => void;
  onOpenFeedback?: () => void;
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

function normalizeHexInput(val: string, fallback: string): string {
  const cleaned = val.trim();
  if (!cleaned) return fallback;
  const withHash = cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
  return /^#[0-9A-Fa-f]{6}$/.test(withHash) ? withHash.toUpperCase() : fallback;
}

function resizeImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem seleccionada.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      // Keep small images (< 600KB) or SVGs untouched
      if (file.size < 600 * 1024 || file.type === 'image/svg+xml') {
        resolve(result);
        return;
      }

      const img = new Image();
      img.onerror = () => resolve(result);
      img.onload = () => {
        const maxW = 1920;
        const maxH = 1080;
        let { width, height } = img;
        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

export function SettingsPage({
  settings,
  adminPin,
  updateInfo,
  onAdminUnlock,
  onAdminLock,
  onUpdateInfoChange,
  onSettingsUpdated,
  onOpenFeedback,
  onNotify,
}: SettingsPageProps) {
  const isAdminUnlocked = Boolean(adminPin);
  const [form, setForm] = useState<AppSettings>(settings);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [loadingDisplays, setLoadingDisplays] = useState(true);
  const [saving, setSaving] = useState(false);

  // Admin PIN unlock & change
  const [pinInput, setPinInput] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [changingPin, setChangingPin] = useState(false);

  // Updates check
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // Backup restore confirmation
  const [pendingBackup, setPendingBackup] = useState<BackupPayload | null>(null);
  const [restoring, setRestoring] = useState(false);

  const mainImgInputRef = useRef<HTMLInputElement>(null);
  const actImgInputRef = useRef<HTMLInputElement>(null);
  const hymnImgInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm({
      church_name: settings.church_name ?? '',
      waiting_text: settings.waiting_text ?? '',
      main_bg_type: settings.main_bg_type ?? 'color',
      main_bg_color: settings.main_bg_color ?? '#1E3A5F',
      main_bg_image: settings.main_bg_image ?? '',
      activity_bg_type: settings.activity_bg_type ?? 'color',
      activity_bg_color: settings.activity_bg_color ?? '#13294B',
      activity_bg_image: settings.activity_bg_image ?? '',
      hymn_bg_type: settings.hymn_bg_type ?? 'color',
      hymn_bg_color: settings.hymn_bg_color ?? '#1E3A5F',
      hymn_bg_image: settings.hymn_bg_image ?? '',
      projection_display_id: settings.projection_display_id ?? '',
      projection_display_name: settings.projection_display_name ?? '',
      show_idle_text_on_image: Boolean(settings.show_idle_text_on_image),
      update_manifest_url: settings.update_manifest_url ?? '',
      feedback_email: settings.feedback_email ?? '',
      feedback_whatsapp: settings.feedback_whatsapp ?? '',
    });
  }, [settings]);

  async function loadDisplays() {
    setLoadingDisplays(true);
    try {
      const list = await dataService.displays.list();
      setDisplays(list);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao consultar monitores.', 'error');
    } finally {
      setLoadingDisplays(false);
    }
  }

  useEffect(() => {
    loadDisplays();
  }, []);

  async function handleImageUpload(
    e: ChangeEvent<HTMLInputElement>,
    field: 'main_bg_image' | 'activity_bg_image' | 'hymn_bg_image',
    typeField: 'main_bg_type' | 'activity_bg_type' | 'hymn_bg_type'
  ) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      onNotify('A imagem excede o limite máximo de 15 MB.', 'error');
      return;
    }

    try {
      const dataUrl = await resizeImageFileToDataUrl(file);
      setForm((prev) => ({
        ...prev,
        [field]: dataUrl,
        [typeField]: 'image',
      }));
      onNotify('Imagem carregada. Clique em Guardar Definições para aplicar.', 'info');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao processar imagem.', 'error');
    }
  }

  async function handleSaveSettings() {
    // Resolve any color/image state conflicts before saving
    const sanitized: AppSettings = {
      ...form,
      main_bg_color: normalizeHexInput(form.main_bg_color, '#1E3A5F'),
      activity_bg_color: normalizeHexInput(form.activity_bg_color, '#13294B'),
      hymn_bg_color: normalizeHexInput(form.hymn_bg_color, '#1E3A5F'),
      main_bg_type: form.main_bg_type === 'image' && !form.main_bg_image ? 'color' : form.main_bg_type,
      activity_bg_type:
        form.activity_bg_type === 'image' && !form.activity_bg_image ? 'color' : form.activity_bg_type,
      hymn_bg_type: form.hymn_bg_type === 'image' && !form.hymn_bg_image ? 'color' : form.hymn_bg_type,
    };

    setForm(sanitized);
    setSaving(true);
    try {
      const saved = await dataService.settings.save(sanitized);
      onSettingsUpdated(saved);
      onNotify('Definições guardadas com sucesso.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao guardar definições.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleExportBackup() {
    try {
      const payload = await dataService.backup.exportData();
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `3MPresenter-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onNotify('Cópia de segurança exportada com sucesso.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao exportar cópia de segurança.', 'error');
    }
  }

  function handleBackupFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as BackupPayload;
        if (
          !parsed ||
          parsed.app !== '3MPresenter' ||
          !parsed.data ||
          !Array.isArray(parsed.data.programs)
        ) {
          onNotify('Ficheiro de cópia de segurança inválido.', 'error');
          return;
        }
        setPendingBackup(parsed);
      } catch {
        onNotify('Não foi possível ler o ficheiro JSON seleccionado.', 'error');
      }
    };
    reader.readAsText(file);
  }

  async function handleConfirmRestore() {
    if (!pendingBackup) return;
    setRestoring(true);
    try {
      const res = await dataService.backup.restoreData(pendingBackup);
      const refreshedSettings = await dataService.settings.get();
      onSettingsUpdated(refreshedSettings);
      setForm(refreshedSettings);
      setPendingBackup(null);
      onNotify(res.message || 'Cópia de segurança restaurada com sucesso.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao restaurar dados.', 'error');
    } finally {
      setRestoring(false);
    }
  }

  async function handleUnlockAdmin(e: FormEvent) {
    e.preventDefault();
    if (!pinInput.trim()) return;
    setVerifyingPin(true);
    try {
      const res = await dataService.admin.verifyPin(pinInput.trim());
      if (res.valid) {
        onAdminUnlock(pinInput.trim());
        setPinInput('');
        onNotify('Modo Admin Principal desbloqueado nesta sessão.');
      } else {
        onNotify('Código PIN de administrador incorreto.', 'error');
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao verificar PIN.', 'error');
    } finally {
      setVerifyingPin(false);
    }
  }

  async function handleChangePin(e: FormEvent) {
    e.preventDefault();
    if (!adminPin) return;
    if (newPin.trim().length < 4) {
      onNotify('O novo PIN deve ter pelo menos 4 caracteres.', 'error');
      return;
    }
    if (newPin.trim() !== confirmPin.trim()) {
      onNotify('A confirmação do novo PIN não coincide.', 'error');
      return;
    }
    setChangingPin(true);
    try {
      await dataService.admin.changePin(adminPin, newPin.trim());
      onAdminUnlock(newPin.trim());
      setNewPin('');
      setConfirmPin('');
      onNotify('Código PIN de Admin Principal actualizado com sucesso.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao alterar código PIN.', 'error');
    } finally {
      setChangingPin(false);
    }
  }

  async function handleCheckUpdates() {
    setCheckingUpdate(true);
    try {
      const result = await checkForAppUpdate(form.update_manifest_url);
      onUpdateInfoChange(result);
      if (result.status === 'update-available') {
        onNotify(`Nova versão v${result.latestVersion} disponível para download.`, 'info');
      } else if (result.status === 'up-to-date') {
        onNotify('O 3MPresenter já está na versão mais recente.');
      } else if (result.status === 'unconfigured') {
        onNotify('Nenhum endereço de atualizações configurado ainda.', 'info');
      } else {
        onNotify('Sem ligação à internet ou servidor indisponível. O sistema continua a funcionar offline.', 'info');
      }
    } finally {
      setCheckingUpdate(false);
    }
  }

  function renderBackgroundConfig(
    title: string,
    description: string,
    typeValue: BackgroundType,
    colorValue: string,
    fallbackColor: string,
    imageValue: string,
    previewTitle: string,
    onTypeChange: (t: BackgroundType) => void,
    onColorChange: (c: string) => void,
    onRemoveImage: () => void,
    fileInputRef: React.RefObject<HTMLInputElement | null>,
    onFileChange: (e: ChangeEvent<HTMLInputElement>) => void,
    optionalIdleTextToggle?: {
      checked: boolean;
      onChange: (checked: boolean) => void;
    }
  ) {
    const safeColor = normalizeHexInput(colorValue, fallbackColor);
    const hasImage = typeValue === 'image' && Boolean(imageValue);
    const showPreviewOverlay =
      !hasImage || !optionalIdleTextToggle || optionalIdleTextToggle.checked;

    return (
      <section className="bg-white rounded-xl border border-[#E5E1D8] p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h3 className="font-editorial text-2xl font-semibold text-[#0F233C]">{title}</h3>
            <p className="text-xs text-[#5F6B7A] mt-0.5">{description}</p>
          </div>

          {/* Selector Cor vs Imagem */}
          <div className="inline-flex items-center gap-1 p-1 bg-[#F3F1EA] border border-[#E5E1D8] rounded-lg self-start shrink-0">
            <button
              type="button"
              onClick={() => onTypeChange('color')}
              className={`inline-flex items-center gap-2 px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                typeValue === 'color'
                  ? 'bg-white text-[#0F233C] shadow-sm'
                  : 'text-[#5F6B7A] hover:text-[#0F233C]'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Cor</span>
            </button>
            <button
              type="button"
              onClick={() => onTypeChange('image')}
              className={`inline-flex items-center gap-2 px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                typeValue === 'image'
                  ? 'bg-white text-[#0F233C] shadow-sm'
                  : 'text-[#5F6B7A] hover:text-[#0F233C]'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Imagem</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          <div className="md:col-span-7 space-y-3">
            {typeValue === 'color' ? (
              <div className="flex flex-wrap items-center gap-4">
                <input
                  type="color"
                  value={safeColor}
                  onChange={(e) => onColorChange(e.target.value.toUpperCase())}
                  className="w-12 h-11 rounded-lg border border-[#E5E1D8] cursor-pointer bg-white p-1 shrink-0"
                  aria-label={`Seleccionar cor para ${title}`}
                />
                <div>
                  <label className="block text-xs font-medium text-[#5F6B7A] mb-1">
                    Cor seleccionada (clique no quadrado ao lado)
                  </label>
                  <input
                    type="text"
                    value={colorValue ?? fallbackColor}
                    onChange={(e) => onColorChange(e.target.value)}
                    onBlur={(e) => onColorChange(normalizeHexInput(e.target.value, fallbackColor))}
                    placeholder={fallbackColor}
                    className="w-32 px-3 py-2 text-xs font-mono bg-[#FAF9F5] text-[#5F6B7A] border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  className="hidden"
                />
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-[#E5E1D8] bg-[#FAF9F5] text-[#0F233C] hover:bg-[#F3F1EA]"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#1E3A5F]" />
                    <span>{imageValue ? 'Substituir Imagem' : 'Carregar Imagem Local'}</span>
                  </button>

                  {imageValue && (
                    <button
                      type="button"
                      onClick={onRemoveImage}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remover imagem</span>
                    </button>
                  )}
                </div>

                {!imageValue && (
                  <p className="text-xs text-[#5F6B7A]">
                    Nenhuma imagem carregada. Sem imagem seleccionada, será utilizada a cor de reserva ao guardar.
                  </p>
                )}

                {optionalIdleTextToggle && imageValue && (
                  <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(optionalIdleTextToggle.checked)}
                      onChange={(e) => optionalIdleTextToggle.onChange(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-[#E5E1D8] text-[#1E3A5F] focus:ring-[#1E3A5F]"
                    />
                    <span className="text-xs text-[#0F233C] leading-snug">
                      Mostrar nome da igreja e texto de espera sobre a imagem
                      <span className="block text-[11px] text-[#5F6B7A] mt-0.5">
                        Desactivado por defeito para exibir apenas a fotografia no ecrã de espera.
                      </span>
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Live Mini Background Preview */}
          <div className="md:col-span-5">
            <div
              className="relative aspect-video w-full rounded-lg overflow-hidden border border-[#E5E1D8] flex flex-col items-center justify-center p-3 text-center"
              style={{
                backgroundColor: safeColor,
                backgroundImage: hasImage ? `url(${imageValue})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {showPreviewOverlay && (
                <>
                  <div
                    className={`absolute inset-0 pointer-events-none ${
                      hasImage
                        ? 'bg-gradient-to-b from-black/60 via-black/48 to-black/68'
                        : 'bg-gradient-to-b from-white/[0.04] via-transparent to-black/28'
                    }`}
                  />
                  <div className="relative z-10">
                    <div className="font-editorial text-sm font-semibold text-white">
                      {previewTitle}
                    </div>
                    <div className="text-[11px] text-[#D4A64A] mt-0.5">
                      {hasImage ? 'Imagem activa' : `Cor ${safeColor}`}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Identificação da Igreja */}
      <section className="bg-white rounded-xl border border-[#E5E1D8] p-6 space-y-4">
        <div>
          <h3 className="font-editorial text-2xl font-semibold text-[#0F233C]">
            Identificação da Igreja
          </h3>
          <p className="text-xs text-[#5F6B7A] mt-0.5">
            Informações exibidas no ecrã principal de projecção quando estiver em espera.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Nome da igreja
            </label>
            <input
              type="text"
              value={form.church_name ?? ''}
              onChange={(e) => setForm({ ...form, church_name: e.target.value })}
              placeholder="Igreja Central"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Texto de espera
            </label>
            <input
              type="text"
              value={form.waiting_text ?? ''}
              onChange={(e) => setForm({ ...form, waiting_text: e.target.value })}
              placeholder="Sejam bem-vindos à Casa do Senhor"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>
        </div>
      </section>

      {/* Fundo do Ecrã Principal de Projecção */}
      {renderBackgroundConfig(
        'Fundo do Ecrã Principal de Projecção',
        'Aplicado exclusivamente ao ecrã principal de espera (antes de projectar).',
        form.main_bg_type,
        form.main_bg_color,
        '#1E3A5F',
        form.main_bg_image,
        form.church_name || 'Ecrã Principal',
        (t) => setForm((prev) => ({ ...prev, main_bg_type: t })),
        (c) => setForm((prev) => ({ ...prev, main_bg_color: c })),
        () => setForm((prev) => ({ ...prev, main_bg_image: '', main_bg_type: 'color' })),
        mainImgInputRef,
        (e) => handleImageUpload(e, 'main_bg_image', 'main_bg_type'),
        {
          checked: form.show_idle_text_on_image,
          onChange: (checked) =>
            setForm((prev) => ({ ...prev, show_idle_text_on_image: checked })),
        }
      )}

      {/* Fundo das Actividades */}
      {renderBackgroundConfig(
        'Fundo das Actividades',
        'Configuração independente aplicada aos momentos do programa e ordem do culto.',
        form.activity_bg_type,
        form.activity_bg_color,
        '#13294B',
        form.activity_bg_image,
        'Ordem do Culto',
        (t) => setForm((prev) => ({ ...prev, activity_bg_type: t })),
        (c) => setForm((prev) => ({ ...prev, activity_bg_color: c })),
        () => setForm((prev) => ({ ...prev, activity_bg_image: '', activity_bg_type: 'color' })),
        actImgInputRef,
        (e) => handleImageUpload(e, 'activity_bg_image', 'activity_bg_type')
      )}

      {/* Fundo dos Hinos e Textos */}
      {renderBackgroundConfig(
        'Fundo dos Hinos e Textos',
        'Configuração independente aplicada aos títulos, estrofes de hinos, anúncios e textos livres.',
        form.hymn_bg_type,
        form.hymn_bg_color,
        '#1E3A5F',
        form.hymn_bg_image,
        'Hino Nº 001',
        (t) => setForm((prev) => ({ ...prev, hymn_bg_type: t })),
        (c) => setForm((prev) => ({ ...prev, hymn_bg_color: c })),
        () => setForm((prev) => ({ ...prev, hymn_bg_image: '', hymn_bg_type: 'color' })),
        hymnImgInputRef,
        (e) => handleImageUpload(e, 'hymn_bg_image', 'hymn_bg_type')
      )}

      {/* Monitor de Projecção */}
      <section className="bg-white rounded-xl border border-[#E5E1D8] p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-editorial text-2xl font-semibold text-[#0F233C]">
              Monitor de Projecção
            </h3>
            <p className="text-xs text-[#5F6B7A] mt-0.5">
              Seleccione o monitor físico onde será aberta a janela de projecção em ecrã inteiro.
            </p>
          </div>
          <button
            type="button"
            onClick={loadDisplays}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E5E1D8] text-[#0F233C] hover:bg-[#F3F1EA]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDisplays ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {displays.map((d) => {
            const isSelected =
              form.projection_display_id === d.id ||
              (!form.projection_display_id && d.isPrimary);

            return (
              <button
                key={d.id}
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    projection_display_id: d.id,
                    projection_display_name: d.name,
                  }))
                }
                className={`text-left p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'border-[#1E3A5F] bg-[#1E3A5F]/[0.04]'
                    : 'border-[#E5E1D8] hover:bg-[#FAF9F5]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Monitor
                    className={`w-5 h-5 mt-0.5 shrink-0 ${
                      isSelected ? 'text-[#1E3A5F]' : 'text-[#5F6B7A]'
                    }`}
                  />
                  <div>
                    <div className="text-sm font-semibold text-[#0F233C]">{d.name}</div>
                    <div className="text-xs text-[#5F6B7A] tabular-nums mt-0.5">
                      {d.width} × {d.height} · ID: {d.id}
                    </div>
                    {d.isPrimary && (
                      <div className="text-xs font-medium text-[#1E3A5F] mt-1">
                        Monitor Principal
                      </div>
                    )}
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-[#1E3A5F] shrink-0 mt-1" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Cópia de Segurança */}
      <section className="bg-white rounded-xl border border-[#E5E1D8] p-6 space-y-4">
        <div className="flex items-start gap-3">
          <DatabaseBackup className="w-5 h-5 text-[#1E3A5F] mt-1 shrink-0" />
          <div>
            <h3 className="font-editorial text-2xl font-semibold text-[#0F233C]">
              Cópia de Segurança
            </h3>
            <p className="text-xs text-[#5F6B7A] mt-0.5">
              Exporte todos os programas, actividades, anúncios, hinos, pastas e definições ou restaure a partir de um ficheiro guardado.
            </p>
          </div>
        </div>

        <input
          ref={restoreInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleBackupFileSelect}
          className="hidden"
        />

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleExportBackup}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-[#E5E1D8] bg-[#FAF9F5] text-[#0F233C] hover:bg-[#F3F1EA]"
          >
            <Download className="w-4 h-4 text-[#1E3A5F]" />
            <span>Criar Cópia de Segurança</span>
          </button>

          <button
            type="button"
            onClick={() => restoreInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-[#E5E1D8] bg-white text-[#0F233C] hover:bg-[#F3F1EA]"
          >
            <Upload className="w-4 h-4 text-[#D4A64A]" />
            <span>Restaurar Cópia de Segurança</span>
          </button>
        </div>
      </section>

      {/* Administração do Acervo (Admin Principal) */}
      <section className="bg-white rounded-xl border border-[#E5E1D8] p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {isAdminUnlocked ? (
              <ShieldCheck className="w-5 h-5 text-[#1E3A5F] mt-1 shrink-0" />
            ) : (
              <Lock className="w-5 h-5 text-[#5F6B7A] mt-1 shrink-0" />
            )}
            <div>
              <h3 className="font-editorial text-2xl font-semibold text-[#0F233C]">
                Administração do Acervo (Admin Principal)
              </h3>
              <p className="text-xs text-[#5F6B7A] mt-0.5">
                Apenas para manutenção pelo administrador principal. As igrejas não precisam deste PIN para projectar nem para criar programas ou cânticos em Outros.
              </p>
            </div>
          </div>

          {isAdminUnlocked && (
            <button
              type="button"
              onClick={() => {
                onAdminLock();
                onNotify('Modo Admin Principal bloqueado.', 'info');
              }}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-[#E5E1D8] bg-[#FAF9F5] text-[#0F233C] hover:bg-[#F3F1EA]"
            >
              Bloquear Agora
            </button>
          )}
        </div>

        {!isAdminUnlocked ? (
          <form onSubmit={handleUnlockAdmin} className="flex flex-wrap items-center gap-2.5 pt-1">
            <input
              type="password"
              value={pinInput ?? ''}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Introduza o PIN de Admin Principal..."
              className="w-64 px-3.5 py-2 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
            <button
              type="submit"
              disabled={verifyingPin || !pinInput.trim()}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E] disabled:opacity-50"
            >
              {verifyingPin ? 'A verificar...' : 'Desbloquear Modo Admin'}
            </button>
          </form>
        ) : (
          <div className="space-y-5 pt-2 border-t border-[#E5E1D8]">
            <form onSubmit={handleChangePin} className="space-y-3">
              <div className="text-xs font-semibold text-[#0F233C]">
                Alterar Código PIN de Administrador
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="password"
                  value={newPin ?? ''}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Novo PIN (mín. 4 caracteres)"
                  className="w-52 px-3 py-2 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                />
                <input
                  type="password"
                  value={confirmPin ?? ''}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="Confirmar novo PIN"
                  className="w-52 px-3 py-2 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                />
                <button
                  type="submit"
                  disabled={changingPin || !newPin.trim()}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#E5E1D8] bg-[#FAF9F5] text-[#0F233C] hover:bg-[#F3F1EA] disabled:opacity-50"
                >
                  {changingPin ? 'A alterar...' : 'Atualizar PIN'}
                </button>
              </div>
            </form>

            <div>
              <label className="block text-xs font-semibold text-[#0F233C] mb-1">
                Endereço de Verificação de Atualizações (GitHub Releases API ou JSON)
              </label>
              <input
                type="url"
                value={form.update_manifest_url ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, update_manifest_url: e.target.value }))
                }
                placeholder="Ex: https://api.github.com/repos/utilizador/3mpresenter/releases/latest"
                className="w-full px-3.5 py-2 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
              />
              <p className="text-[11px] text-[#5F6B7A] mt-1">
                Opcional: quando definido (e guardado abaixo), os computadores ligados à internet verificam novas versões automaticamente neste endereço.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F233C] mb-1">
                  E-mail de Apoio e Sugestões
                </label>
                <input
                  type="email"
                  value={form.feedback_email ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, feedback_email: e.target.value }))
                  }
                  placeholder="Ex: suporte@suaigreja.org"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F233C] mb-1">
                  WhatsApp de Apoio e Sugestões (com indicativo, opcional)
                </label>
                <input
                  type="tel"
                  value={form.feedback_whatsapp ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, feedback_whatsapp: e.target.value }))
                  }
                  placeholder="Ex: +244 900 000 000"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Versão do Sistema e Atualizações */}
      <section className="bg-white rounded-xl border border-[#E5E1D8] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-editorial text-2xl font-semibold text-[#0F233C]">
              Versão do Sistema e Atualizações
            </h3>
            <p className="text-xs text-[#5F6B7A] mt-0.5 tabular-nums">
              Versão instalada: <strong className="text-[#0F233C]">v{APP_VERSION}</strong> · Catálogo de Hinos v{CATALOG_VERSION}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            {onOpenFeedback && (
              <button
                type="button"
                onClick={onOpenFeedback}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-[#D4A64A]/70 bg-[#FAF9F5] text-[#0F233C] hover:bg-[#D4A64A]/15"
              >
                <MessageSquarePlus className="w-3.5 h-3.5 text-[#1E3A5F]" />
                <span>Ajuda e Sugestões</span>
              </button>
            )}
            <button
              type="button"
              disabled={checkingUpdate}
              onClick={handleCheckUpdates}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-[#E5E1D8] bg-[#FAF9F5] text-[#0F233C] hover:bg-[#F3F1EA] disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#1E3A5F] ${checkingUpdate ? 'animate-spin' : ''}`} />
              <span>{checkingUpdate ? 'A verificar...' : 'Verificar Atualizações'}</span>
            </button>
          </div>
        </div>

        {updateInfo?.status === 'update-available' && (
          <div className="p-4 rounded-xl border border-[#D4A64A]/60 bg-[#FAF9F5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[#0F233C]">
                Nova versão disponível: v{updateInfo.latestVersion}
              </div>
              {updateInfo.releaseNotes && (
                <p className="text-xs text-[#5F6B7A] mt-0.5">{updateInfo.releaseNotes}</p>
              )}
            </div>
            {updateInfo.downloadUrl && (
              <a
                href={updateInfo.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E] whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-[#D4A64A]" />
                <span>Baixar Atualização</span>
              </a>
            )}
          </div>
        )}

        {updateInfo?.status === 'up-to-date' && (
          <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5">
            O sistema encontra-se na versão mais recente (v{APP_VERSION}).
          </p>
        )}

        {updateInfo?.status === 'offline' && (
          <p className="text-xs text-[#5F6B7A] bg-[#FAF9F5] border border-[#E5E1D8] rounded-lg px-3.5 py-2.5">
            Não foi possível contactar o servidor de atualizações (sem internet). O 3MPresenter funciona normalmente offline.
          </p>
        )}

        {updateInfo?.status === 'unconfigured' && (
          <p className="text-xs text-[#5F6B7A] bg-[#FAF9F5] border border-[#E5E1D8] rounded-lg px-3.5 py-2.5">
            Ainda não existe nenhum endereço de lançamento configurado para atualizações automáticas.
          </p>
        )}
      </section>

      {/* Save Settings Footer Action */}
      <div className="flex items-center justify-end pt-2 pb-6">
        <button
          type="button"
          disabled={saving}
          onClick={handleSaveSettings}
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E] shadow-sm transition-colors disabled:opacity-60"
        >
          <Save className="w-4 h-4 text-[#D4A64A]" />
          <span>{saving ? 'A guardar...' : 'Guardar Definições'}</span>
        </button>
      </div>

      {/* Restore Confirmation Modal */}
      <ConfirmModal
        open={Boolean(pendingBackup)}
        onClose={() => setPendingBackup(null)}
        onConfirm={handleConfirmRestore}
        loading={restoring}
        variant="primary"
        confirmLabel="Restaurar Dados"
        title="Restaurar Cópia de Segurança"
        message={
          pendingBackup
            ? `Tem a certeza que deseja restaurar esta cópia de segurança (${pendingBackup.data.programs.length} programas, ${pendingBackup.data.hymns.length} hinos, ${pendingBackup.data.announcements.length} anúncios)? Os dados actuais serão substituídos.`
            : ''
        }
      />
    </div>
  );
}
