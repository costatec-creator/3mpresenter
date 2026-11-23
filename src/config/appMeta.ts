export const APP_VERSION = '1.0.0';
export const CATALOG_VERSION = 1;

// Endereço oficial do repositório GitHub para verificação automática de novas versões
export const DEFAULT_UPDATE_MANIFEST_URL =
  'https://api.github.com/repos/costatec-creator/3mpresenter/releases/latest';

export const DEFAULT_FEEDBACK_EMAIL = 'costatec@outlook.pt';
export const DEFAULT_FEEDBACK_WHATSAPP = '+244923353376';

export interface UpdateCheckResult {
  status: 'up-to-date' | 'update-available' | 'unconfigured' | 'offline';
  currentVersion: string;
  latestVersion?: string;
  downloadUrl?: string;
  releaseNotes?: string;
}

function compareSemver(a: string, b: string): number {
  const clean = (v: string) =>
    v
      .trim()
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0);

  const pa = clean(a);
  const pb = clean(b);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

export async function checkForAppUpdate(manifestUrl?: string): Promise<UpdateCheckResult> {
  const url = (manifestUrl || DEFAULT_UPDATE_MANIFEST_URL).trim();
  if (!url) {
    return { status: 'unconfigured', currentVersion: APP_VERSION };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { status: 'offline', currentVersion: APP_VERSION };
    }

    const data = (await res.json()) as Record<string, unknown>;

    // Suporta tanto version.json simples como API oficial do GitHub Releases (/releases/latest)
    const rawVersion =
      typeof data.version === 'string'
        ? data.version
        : typeof data.tag_name === 'string'
          ? data.tag_name
          : '';

    if (!rawVersion) {
      return { status: 'offline', currentVersion: APP_VERSION };
    }

    const latestVersion = rawVersion.replace(/^v/i, '').trim();
    const isNewer = compareSemver(latestVersion, APP_VERSION) > 0;

    if (!isNewer) {
      return {
        status: 'up-to-date',
        currentVersion: APP_VERSION,
        latestVersion,
      };
    }

    let downloadUrl =
      typeof data.downloadUrl === 'string'
        ? data.downloadUrl
        : typeof data.url === 'string'
          ? data.url
          : '';

    if (!downloadUrl && Array.isArray(data.assets)) {
      const exeAsset = data.assets.find(
        (a): a is { name?: string; browser_download_url?: string } =>
          Boolean(a) &&
          typeof a === 'object' &&
          typeof (a as { browser_download_url?: unknown }).browser_download_url === 'string' &&
          String((a as { name?: unknown }).name || '').toLowerCase().endsWith('.exe')
      );
      if (exeAsset?.browser_download_url) {
        downloadUrl = exeAsset.browser_download_url;
      }
    }

    if (!downloadUrl && typeof data.html_url === 'string') {
      downloadUrl = data.html_url;
    }

    const releaseNotes =
      typeof data.notes === 'string'
        ? data.notes
        : typeof data.body === 'string'
          ? data.body
          : '';

    return {
      status: 'update-available',
      currentVersion: APP_VERSION,
      latestVersion,
      downloadUrl,
      releaseNotes,
    };
  } catch {
    return { status: 'offline', currentVersion: APP_VERSION };
  }
}
