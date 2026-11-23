# 3MPresenter (v1.0.0)

Sistema institucional simples, rápido e 100% offline para gestão de cultos, programas, anúncios, hinário e projecção em dois ecrãs para igrejas.

## Funcionalidades Principais

- **Projecção em Dois Ecrãs**: Painel de controlo no computador do operador e janela de projecção em ecrã inteiro no projector/TV.
- **Execução Contínua na Ordem do Culto**: Ao navegar pelo programa (`←` / `→` ou cliques), os hinos vinculados abrem directamente dentro da lista da ordem do culto sem precisar de trocar de separador.
- **Hinário & Coletânea Integrados**:
  - **610 hinos** do Hinário Adventista (`Hinário`).
  - **224 músicas** da Coletânea Jovem (`Coletânea`).
  - Colecção **`Outros`** livre para cânticos locais, corinhos e adaptações (incluindo duplicação directa a partir do Hinário ou Coletânea).
- **3 Fundos Independentes**: Cor sólida ou imagem personalizada separada para *Boas-Vindas*, *Actividade do Programa* e *Hinos / Anúncios*.
- **Segurança & Administração**:
  - Catálogos oficiais (`Hinário` e `Coletânea`) protegidos contra edição ou eliminação acidental por operadores.
  - Desbloqueio administrativo por PIN nas **Definições** (PIN inicial padrão: `2026` — altere antes da distribuição oficial).
- **Cópias de Segurança Offline**: Exportação e restauro completo da base de dados local em formato JSON.
- **Guia Completo & Ajuda**: Manual completo automático na primeira abertura e modal de *Ajuda e Sugestões* (WhatsApp, E-mail ou cópia de mensagem offline).

---

## Executar em Desenvolvimento (Modo Web / Local)

Requisitos: **Node.js 20+**

```bash
npm install
npm run dev
```

O sistema abre em `http://localhost:3000`.

---

## Gerar Instalador Windows (`.exe`)

### Opção 1 — Automática via GitHub Releases (Recomendado)

Para gerar e publicar o instalador `3MPresenter-Setup-1.0.0.exe` automaticamente no GitHub:

1. Envie o projecto para o seu repositório GitHub.
2. No GitHub, abra a aba **Actions** -> **set up a workflow yourself** e crie `.github/workflows/build-windows.yml` com o fluxo de build para `windows-latest`.
3. Crie uma Release com a tag `v1.0.0` (ou envie `git tag v1.0.0 && git push origin v1.0.0`).
4. Aguarde alguns minutos em **Actions** no GitHub; o instalador `.exe` será anexado automaticamente à página **Releases**.

### Opção 2 — Compilar Localmente no Windows

```bash
npm install
npm install --no-save electron electron-builder
npm run electron:build
```

O instalador será criado na pasta `release/`.

---

## Antes da Primeira Distribuição (Checklist do Administrador)

1. Aceda a **Definições** -> **Modo Administrador Principal** (PIN inicial `2026`).
2. **Altere o PIN padrão** para um código privado da sua equipa.
3. Configure o **E-mail** e **WhatsApp de Sugestões / Suporte** em **Definições**.
4. (Opcional) Defina o URL de verificação de actualizações (`https://api.github.com/repos/SEU_USUARIO/SEU_REPOSITORIO/releases/latest`).
