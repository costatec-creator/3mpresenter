import fs from 'node:fs';
import path from 'node:path';
import type { CollectionType, HymnSectionType } from '../types/index.ts';
import type { LocalSqliteDatabase } from './sqliteCore.ts';
import { getEmbeddedHymnsCatalog } from './hymnsCatalog.ts';

export interface ParsedHymnInput {
  number: string;
  collection_type: CollectionType;
  title: string;
  author?: string;
  folder_id?: string | null;
  folder_name?: string;
  sections: Array<{ section_type: HymnSectionType; content: string }>;
}

const CHORD_LINE_REGEX =
  /^([A-G][#b]?(m|maj|min|dim|aug|sus)?\d*(\/[A-G][#b]?)?\s+){2,}[A-G][#b]?(m|maj|min|dim|aug|sus)?\d*(\/[A-G][#b]?)?$/;

function uBoundary(pattern: string): RegExp {
  return new RegExp(`(?<!\\p{L})${pattern}(?!\\p{L})`, 'gu');
}

// Exact tab-separated distinct words that must keep a space when stripping syllable-split tabs
const TAB_WORD_BOUNDARIES: Array<[RegExp, string]> = [
  [uBoundary('de\\tmanhã'), 'de manhã'],
  [uBoundary('quando\\to'), 'quando o'],
  [uBoundary('em\\tTi'), 'em Ti'],
  [uBoundary('a\\testrada'), 'a estrada'],
  [uBoundary('Sem\\ttemer'), 'Sem temer'],
  [uBoundary('irás\\tme'), 'irás me'],
  [uBoundary('o\\tarrebo\\tl'), 'o arrebol'],
  [uBoundary('o\\tarrebol'), 'o arrebol'],
  [uBoundary('me\\tcond\\tuzir'), 'me conduzir'],
  [uBoundary('voltar\\tJesus'), 'voltar Jesus'],
  [uBoundary('ó\\tDeus'), 'ó Deus'],
  [uBoundary('o\\tlar'), 'o lar'],
  [uBoundary('com\\tmãos'), 'com mãos'],
];

// Unambiguous OCR / sheet-music syllable splits verified across HA001-HA610
const SAFE_SYLLABLE_FIXES: Array<[RegExp, string]> = [
  // Multi-word / hyphen / spaced single-letter splits
  [uBoundary('des viar- nos'), 'desviar-nos'],
  [uBoundary('li vraste- me'), 'livraste-me'],
  [uBoundary('li vras te- me'), 'livraste-me'],
  [uBoundary('Louvamos- Te'), 'Louvamos-Te'],
  [uBoundary('ado rai-O'), 'adorai-O'],
  [uBoundary('lou vai- O'), 'louvai-O'],
  [uBoundary('sem-p ar'), 'sem-par'],
  [uBoundary('sem- par'), 'sem-par'],
  [uBoundary('no sso Deu s'), 'nosso Deus'],
  [uBoundary('ta mbé m'), 'também'],
  [uBoundary('ete rna l'), 'eternal'],
  [uBoundary('S enhor'), 'Senhor'],
  [uBoundary('a l ma'), 'alma'],
  [uBoundary('a sa s'), 'asas'],
  [uBoundary('c on duz'), 'conduz'],
  [uBoundary('fa la r'), 'falar'],
  [uBoundary('fa lar'), 'falar'],
  [uBoundary('lou var'), 'louvar'],
  [uBoundary('a mo r'), 'amor'],
  [uBoundary('am or'), 'amor'],
  [uBoundary('nos f alaram'), 'nos falaram'],
  [uBoundary('demanhã'), 'de manhã'],
  [uBoundary('óDeus'), 'ó Deus'],
  [uBoundary('Acrer'), 'A crer'],

  // Unambiguous split words
  [uBoundary('a dorar'), 'adorar'],
  [uBoundary('a dor ai'), 'adorai'],
  [uBoundary('a do rai'), 'adorai'],
  [uBoundary('ado rai'), 'adorai'],
  [uBoundary('ado ramos'), 'adoramos'],
  [uBoundary('ado rar'), 'adorar'],
  [uBoundary('adora ção'), 'adoração'],
  [uBoundary('rend ei'), 'rendei'],
  [uBoundary('ren demos'), 'rendemos'],
  [uBoundary('louv or'), 'louvor'],
  [uBoundary('lou vor'), 'louvor'],
  [uBoundary('lou vores'), 'louvores'],
  [uBoundary('lou vo res'), 'louvores'],
  [uBoundary('Lou vor'), 'Louvor'],
  [uBoundary('lou va'), 'louva'],
  [uBoundary('Lou va'), 'Louva'],
  [uBoundary('lou vai'), 'louvai'],
  [uBoundary('Lou va do'), 'Louvado'],
  [uBoundary('Louva do'), 'Louvado'],
  [uBoundary('louva rei'), 'louvarei'],
  [uBoundary('Senh or'), 'Senhor'],
  [uBoundary('Se nhor'), 'Senhor'],
  [uBoundary('Sen hor'), 'Senhor'],
  [uBoundary('pode roso'), 'poderoso'],
  [uBoundary('Vence dor'), 'Vencedor'],
  [uBoundary('Cria dor'), 'Criador'],
  [uBoundary('Cri a dor'), 'Criador'],
  [uBoundary('Salva dor'), 'Salvador'],
  [uBoundary('Re den tor'), 'Redentor'],
  [uBoundary('Reden tor'), 'Redentor'],
  [uBoundary('Re dentor'), 'Redentor'],
  [uBoundary('reden tor'), 'redentor'],
  [uBoundary('Benfei tor'), 'Benfeitor'],
  [uBoundary('Con sola dor'), 'Consolador'],
  [uBoundary('Doa dor'), 'Doador'],
  [uBoundary('perf eição'), 'perfeição'],
  [uBoundary('perf eiç ão'), 'perfeição'],
  [uBoundary('co ração'), 'coração'],
  [uBoundary('co ra ção'), 'coração'],
  [uBoundary('cora ção'), 'coração'],
  [uBoundary('sal vação'), 'salvação'],
  [uBoundary('sal va ção'), 'salvação'],
  [uBoundary('ora ção'), 'oração'],
  [uBoundary('reden ção'), 'redenção'],
  [uBoundary('re denção'), 'redenção'],
  [uBoundary('re den ção'), 'redenção'],
  [uBoundary('can ção'), 'canção'],
  [uBoundary('cria ção'), 'criação'],
  [uBoundary('Con so la ção'), 'Consolação'],
  [uBoundary('pai xão'), 'paixão'],
  [uBoundary('ampli dão'), 'amplidão'],
  [uBoundary('per dão'), 'perdão'],
  [uBoundary('finda rão'), 'findarão'],
  [uBoundary('Jes us'), 'Jesus'],
  [uBoundary('Je sus'), 'Jesus'],
  [uBoundary('ferv or'), 'fervor'],
  [uBoundary('fer vor'), 'fervor'],
  [uBoundary('ro cha'), 'rocha'],
  [uBoundary('ver dade'), 'verdade'],
  [uBoundary('ver da de'), 'verdade'],
  [uBoundary('Am ém'), 'Amém'],
  [uBoundary('A mém'), 'Amém'],
  [uBoundary('bele za'), 'beleza'],
  [uBoundary('be lezas'), 'belezas'],
  [uBoundary('natu rais'), 'naturais'],
  [uBoundary('santi dade'), 'santidade'],
  [uBoundary('po der'), 'poder'],
  [uBoundary('po derem'), 'poderem'],
  [uBoundary('grande za'), 'grandeza'],
  [uBoundary('gran deza'), 'grandeza'],
  [uBoundary('prin cípio'), 'princípio'],
  [uBoundary('ca rida de'), 'caridade'],
  [uBoundary('pie doso'), 'piedoso'],
  [uBoundary('tar dio'), 'tardio'],
  [uBoundary('fu ror'), 'furor'],
  [uBoundary('bonda de'), 'bondade'],
  [uBoundary('bon dade'), 'bondade'],
  [uBoundary('bon doso'), 'bondoso'],
  [uBoundary('bon do so'), 'bondoso'],
  [uBoundary('san to'), 'santo'],
  [uBoundary('sa grados'), 'sagrados'],
  [uBoundary('a mor'), 'amor'],
  [uBoundary('Ter ra'), 'Terra'],
  [uBoundary('encer ra'), 'encerra'],
  [uBoundary('e terno'), 'eterno'],
  [uBoundary('e ter no'), 'eterno'],
  [uBoundary('Eter no'), 'Eterno'],
  [uBoundary('E terno'), 'Eterno'],
  [uBoundary('e terna'), 'eterna'],
  [uBoundary('e ternamente'), 'eternamente'],
  [uBoundary('E terna mente'), 'Eternamente'],
  [uBoundary('sem pi ter no'), 'sempiterno'],
  [uBoundary('mon te'), 'monte'],
  [uBoundary('Che gai-vos'), 'Chegai-vos'],
  [uBoundary('Tra zei'), 'Trazei'],
  [uBoundary('humilde mente'), 'humildemente'],
  [uBoundary('vos so'), 'vosso'],
  [uBoundary('sus tenta'), 'sustenta'],
  [uBoundary('sus tém'), 'sustém'],
  [uBoundary('gló ria'), 'glória'],
  [uBoundary('as cendam'), 'ascendam'],
  [uBoundary('En trai'), 'Entrai'],
  [uBoundary('bus cai'), 'buscai'],
  [uBoundary('Bus cando'), 'Buscando'],
  [uBoundary('en con tra reis'), 'encontrareis'],
  [uBoundary('sem pre'), 'sempre'],
  [uBoundary('pecado res'), 'pecadores'],
  [uBoundary('peca dores'), 'pecadores'],
  [uBoundary('pe cado'), 'pecado'],
  [uBoundary('firma mento'), 'firmamento'],
  [uBoundary('re midos'), 'remidos'],
  [uBoundary('Cris to'), 'Cristo'],
  [uBoundary('sacri fício'), 'sacrifício'],
  [uBoundary('vis to'), 'visto'],
  [uBoundary('re vela'), 'revela'],
  [uBoundary('inson dável'), 'insondável'],
  [uBoundary('in son dável'), 'insondável'],
  [uBoundary('di vi no'), 'divino'],
  [uBoundary('Es pírito'), 'Espírito'],
  [uBoundary('Es píri to'), 'Espírito'],
  [uBoundary('mun do'), 'mundo'],
  [uBoundary('su blime'), 'sublime'],
  [uBoundary('pere grino'), 'peregrino'],
  [uBoundary('con duz'), 'conduz'],
  [uBoundary('con du zes'), 'conduzes'],
  [uBoundary('pro du zes'), 'produzes'],
  [uBoundary('manan cial'), 'manancial'],
  [uBoundary('am para'), 'ampara'],
  [uBoundary('am pa ra'), 'ampara'],
  [uBoundary('im pere'), 'impere'],
  [uBoundary('a qui'), 'aqui'],
  [uBoundary('A qui'), 'Aqui'],
  [uBoundary('u nindo'), 'unindo'],
  [uBoundary('en cantos'), 'encantos'],
  [uBoundary('imor tais'), 'imortais'],
  [uBoundary('a migos'), 'amigos'],
  [uBoundary('ir mãos'), 'irmãos'],
  [uBoundary('fa vor'), 'favor'],
  [uBoundary('tam bém'), 'também'],
  [uBoundary('mor reu'), 'morreu'],
  [uBoundary('mor rer'), 'morrer'],
  [uBoundary('Se jas'), 'Sejas'],
  [uBoundary('na tu ra'), 'natura'],
  [uBoundary('ze lo'), 'zelo'],
  [uBoundary('ter nu ra'), 'ternura'],
  [uBoundary('Cá li do'), 'Cálido'],
  [uBoundary('per du ra'), 'perdura'],
  [uBoundary('U ni ver so'), 'Universo'],
  [uBoundary('Tu as'), 'Tuas'],
  [uBoundary('Tu a'), 'Tua'],
  [uBoundary('con for to'), 'conforto'],
  [uBoundary('con forto'), 'conforto'],
  [uBoundary('Ha ja'), 'Haja'],
  [uBoundary('pe lo'), 'pelo'],
  [uBoundary('Prí nci pe'), 'Príncipe'],
  [uBoundary('lu zes'), 'luzes'],
  [uBoundary('cui da do'), 'cuidado'],
  [uBoundary('pa ter no'), 'paterno'],
  [uBoundary('so bre'), 'sobre'],
  [uBoundary('er gues'), 'ergues'],
  [uBoundary('rei no'), 'reino'],
  [uBoundary('su per no'), 'superno'],
  [uBoundary('se ja'), 'seja'],
  [uBoundary('so mente'), 'somente'],
  [uBoundary('cri anças'), 'crianças'],
  [uBoundary('incli na mos'), 'inclinamos'],
  [uBoundary('trans cen den tais'), 'transcendentais'],
  [uBoundary('e coa'), 'ecoa'],
  [uBoundary('mor tais'), 'mortais'],
  [uBoundary('Pas tor'), 'Pastor'],
  [uBoundary('fi el'), 'fiel'],
  [uBoundary('vin douro'), 'vindouro'],
  [uBoundary('Isra el'), 'Israel'],
  [uBoundary('can tamos'), 'cantamos'],
  [uBoundary('pre sente'), 'presente'],
  [uBoundary('encar nado'), 'encarnado'],
  [uBoundary('pu rificar'), 'purificar'],
  [uBoundary('san tifi car'), 'santificar'],
  [uBoundary('su premo'), 'supremo'],
  [uBoundary('for mou'), 'formou'],
  [uBoundary('da rá'), 'dará'],
  [uBoundary('vi rá'), 'virá'],
  [uBoundary('reina rá'), 'reinará'],
  [uBoundary('dei xei'), 'deixei'],
  [uBoundary('pra zer'), 'prazer'],
  [uBoundary('en tão'), 'então'],
  [uBoundary('se rei'), 'serei'],
  [uBoundary('a té'), 'até'],
  [uBoundary('a lém'), 'além'],
  [uBoundary('exal tai'), 'exaltai'],
  [uBoundary('fi éis'), 'fiéis'],
  [uBoundary('tor nar'), 'tornar'],
  [uBoundary('a trás'), 'atrás'],
  [uBoundary('acla mai'), 'aclamai'],
  [uBoundary('Ale luia'), 'Aleluia'],
  [uBoundary('Alelui a'), 'Aleluia'],
  [uBoundary('A le luia'), 'Aleluia'],
  [uBoundary('Ale lui a'), 'Aleluia'],
  [uBoundary('To da'), 'Toda'],
  [uBoundary('Implo ramos'), 'Imploramos'],
  [uBoundary('en cher'), 'encher'],
  [uBoundary('ce leste'), 'celeste'],
  [uBoundary('espe rança'), 'esperança'],
  [uBoundary('transbor da'), 'transborda'],
  [uBoundary('tris teza'), 'tristeza'],
  [uBoundary('te mor'), 'temor'],
  [uBoundary('hi nos'), 'hinos'],
  [uBoundary('cam pinas'), 'campinas'],
  [uBoundary('fon tes'), 'fontes'],
  [uBoundary('cria turas'), 'criaturas'],
  [uBoundary('ele vai'), 'elevai'],
  [uBoundary('dou rado'), 'dourado'],
  [uBoundary('reful gir'), 'refulgir'],
  [uBoundary('relu zir'), 'reluzir'],
  [uBoundary('hon rai'), 'honrai'],
  [uBoundary('er guei-vos'), 'erguei-vos'],
  [uBoundary('A brindo-lhe'), 'Abrindo-lhe'],
  [uBoundary('as sim'), 'assim'],
  [uBoundary('Com prou-nos'), 'Comprou-nos'],

  // Unambiguous OCR / spelling / accent typos across HA001-HA610
  [uBoundary('Espírito de Fluz'), 'Espírito de luz'],
  [uBoundary('Tua obras anunciam'), 'Tuas obras anunciam'],
  [uBoundary('O Terra e Céu'), 'Ó Terra e Céu'],
  [uBoundary('livras-te'), 'livraste'],
  [uBoundary('em oraçao'), 'em oração'],
  [uBoundary('Bem cedo, á Pai'), 'Bem cedo, ó Pai'],
  [uBoundary('Cantai, á cristandade'), 'Cantai, ó cristandade'],
  [uBoundary('do Cé a luz'), 'do Céu a luz'],
  [uBoundary('0 raças, tribos e naçôes'), 'Ó raças, tribos e nações'],
  [uBoundary('Jesus, o senhor'), 'Jesus, o Senhor'],
  [uBoundary('principes fortes'), 'príncipes fortes'],
  [uBoundary('Oue me permitas'), 'Que me permitas'],
  [uBoundary('Vós, naçôes'), 'Vós, nações'],
  [uBoundary('Principe da nossa paz'), 'Príncipe da nossa paz'],
  [uBoundary('Desta redençao'), 'Desta redenção'],
  [uBoundary('Á glória, salvos'), 'À glória, salvos'],
  [uBoundary('Deus exçelso'), 'Deus excelso'],
  [uBoundary('Alelula'), 'Aleluia'],
  [uBoundary('meu jesus'), 'meu Jesus'],
  [uBoundary("co'amoi"), "co'amor"],
  [uBoundary('Ô querido filho'), 'Ó querido filho'],
  [uBoundary('e da-me em profusão'), 'e dá-me em profusão'],
  [uBoundary('Jesus, senhor amado'), 'Jesus, Senhor amado'],
  [uBoundary('noSenhor'), 'no Senhor'],
  [uBoundary('aleleuia'), 'aleluia'],
  [uBoundary('Juíz ão de'), 'Juiz hão de'],
  [uBoundary('fulgor ão de'), 'fulgor hão de'],
  [uBoundary('É do Espíto de Deus'), 'É do Espírito de Deus'],
  [uBoundary('bénçãos'), 'bênçãos'],
  [uBoundary('e affição'), 'e aflição'],
  [uBoundary('Õ, vem, pecador'), 'Ó, vem, pecador'],
  [uBoundary('Á luz do Salvador'), 'À luz do Salvador'],
  [uBoundary('Num olhar al Salvador'), 'Num olhar ao Salvador'],
  [uBoundary('ao protrar-me ali'), 'ao prostrar-me ali'],
  [uBoundary('sou al Céu levado'), 'sou ao Céu levado'],
  [uBoundary('Eu canto un hino'), 'Eu canto um hino'],
  [uBoundary('Cada nubem escura'), 'Cada nuvem escura'],
  [uBoundary('não sovre nenhum mal'), 'não sofre nenhum mal'],
  [uBoundary('al leme está'), 'ao leme está'],
  [uBoundary('Al Senhor obedecer'), 'Ao Senhor obedecer'],
  [uBoundary('fitos Ter no Salvador'), 'fitos ter no Salvador'],
  [uBoundary('tu deves guardas'), 'tu deves guardar'],
  [uBoundary('Ó Bbendito Salvador'), 'Ó Bendito Salvador'],
  [uBoundary('Revelas-te Teu amor'), 'Revelaste Teu amor'],
  [uBoundary('Ao Teu bando e doce amor'), 'Ao Teu brando e doce amor'],
  [uBoundary('ambição: Ter e sentir'), 'ambição: ter e sentir'],
  [uBoundary('Eis o meu deseja'), 'Eis o meu desejo'],
  [uBoundary('dá-me Tua pa'), 'dá-me Tua paz'],
  [uBoundary('Contandoo'), 'Contando'],
  [uBoundary('ajoelhas-te'), 'ajoelhaste'],
  [uBoundary('Teu Amigo que ser'), 'Teu Amigo quer ser'],
  [uBoundary('Mas ho! que será'), 'Mas oh! que será'],
  [uBoundary('Sua lições estudar'), 'Suas lições estudar'],
  [uBoundary('Meu temores vou depor'), 'Meus temores vou depor'],
  [uBoundary('empunha hoje a biblia'), 'empunha hoje a Bíblia'],
  [uBoundary('palavra do senhor'), 'palavra do Senhor'],
  [uBoundary('que cristo logo'), 'que Cristo logo'],
  [uBoundary('Pelo que cristo fez'), 'Pelo que Cristo fez'],
  [uBoundary('Eu e voce vamos lá'), 'Eu e você vamos lá'],
  [uBoundary('Nos vamos para o Céu'), 'Nós vamos para o Céu'],
  [uBoundary('Joias somos nos'), 'Joias somos nós'],
  [uBoundary('colunas de palacios'), 'colunas de palácios'],
  [uBoundary('triste ma achava'), 'triste me achava'],
  [uBoundary('Quero Ter ao seguir'), 'Quero ter ao seguir'],
  [uBoundary('Á obra santa lancemos mão'), 'À obra santa lancemos mão'],
  [uBoundary("D'aguas vivas"), "D'águas vivas"],
  [uBoundary('Sintoa presença'), 'Sinto a presença'],
];

function cleanLine(line: string): string {
  let out = line;
  for (const [pattern, replacement] of TAB_WORD_BOUNDARIES) {
    out = out.replace(pattern, replacement);
  }
  out = out
    .replace(/\t/g, '')
    .replace(/ {2,}/g, ' ')
    .replace(/ç (?=[a-záéíóúâêôãõ])/gi, 'ç')
    .replace(/ ([.,;:!?])/g, '$1')
    .replace(/([,;])(\p{L})/gu, '$1 $2')
    .trim()
    .replace(/^COR0(?=\s*[:.]?\s|$)/i, 'CORO')
    .replace(/^0 (?=[a-zA-ZÀ-ÿ])(?!raças\b)/u, 'O ')
    .replace(/^(\d+\s*[.\-)]\s*)0 (?=[a-zA-ZÀ-ÿ])(?!raças\b)/u, '$1O ')
    .replace(/\bcomo 0 choraram\b/g, 'como O choraram')
    .replace(/\bque 0 crucificou\b/g, 'que O crucificou')
    .replace(/^(\d+\s*[.\-)]\s*)?0,(?=\s*[a-zA-ZÀ-ÿ])/, (_m, p1: string | undefined) => `${p1 ?? ''}Ó,`)
    .replace(/\s*~\s*$/, '')
    .replace(/\.\?(?=\s|$)/g, '.')
    .replace(/!;(?=\s|$)/g, '!')
    .replace(/"([^"]+)»/g, '"$1"');

  for (const [pattern, replacement] of SAFE_SYLLABLE_FIXES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function decodeHymnBuffer(rawBuffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(rawBuffer);
  } catch {
    return new TextDecoder('windows-1252').decode(rawBuffer);
  }
}

export function parseHinarioFile(filename: string, rawBuffer: Buffer): ParsedHymnInput | null {
  const numMatch = filename.match(/^HA(\d+)_/i);
  if (!numMatch) return null;
  const number = String(Number.parseInt(numMatch[1], 10));

  const decoded = decodeHymnBuffer(rawBuffer);
  const rawLines = decoded
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(cleanLine);

  const titleIdx = rawLines.findIndex((l) => l.length > 0);
  if (titleIdx === -1) return null;

  const title = rawLines[titleIdx];
  let bodyLines = rawLines.slice(titleIdx + 1);

  // Check for "Hinário Adventista #..." metadata header block
  const haIdx = bodyLines.slice(0, 12).findIndex((l) => /^Hin[aá]rio\s+Adventista\s+#\d+/i.test(l));
  let author = '';
  if (haIdx !== -1) {
    const metaLines = bodyLines.slice(0, haIdx).filter((l) => l.length > 0);
    const authorLine = metaLines.find((l) =>
      /\(\s*[\dl]\d{3}\s*-|Melodia\s+Tradicional/i.test(l)
    );
    if (authorLine) {
      author = authorLine.replace(/\)(?=[A-ZÁÉÍÓÚ])/g, ') / ').replace(/\(l(\d{3})/g, '(1$1');
    }
    bodyLines = bodyLines.slice(haIdx + 1);
  }

  // Filter stray punctuation/chords/performance notes
  bodyLines = bodyLines.filter((l) => {
    if (l === ':') return false;
    if (CHORD_LINE_REGEX.test(l)) return false;
    if (/^Nota:\s*Repete\s+o\s+C[ôo]ro\.?$/i.test(l)) return false;
    return true;
  });

  while (bodyLines.length > 0 && bodyLines[0] === '') bodyLines.shift();
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] === '') bodyLines.pop();

  // Remove standalone English subtitle line if immediately preceding Portuguese lyrics (e.g. HA579)
  if (bodyLines.length > 1 && bodyLines[0] === 'I Love You, Lord') {
    bodyLines.shift();
  }

  const hasExplicitMarkers = bodyLines.some((l) =>
    /^(?:\d+\s*[.\-)]|(?:CORO|C[ÔO]RO|REFR[ÃA]O)\b\s*[:.]?)/i.test(l)
  );

  const sections: Array<{ section_type: HymnSectionType; content: string }> = [];

  if (hasExplicitMarkers) {
    let current: { type: HymnSectionType; lines: string[] } | null = null;

    const flushCurrent = () => {
      if (!current) return;
      const content = current.lines
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      if (content) {
        sections.push({ section_type: current.type, content });
      }
      current = null;
    };

    for (const line of bodyLines) {
      if (!line) {
        continue;
      }

      const coroMatch = line.match(/^(?:CORO|C[ÔO]RO|REFR[ÃA]O)\b\s*[:.]?\s*(.*)$/i);
      if (coroMatch) {
        flushCurrent();
        current = { type: 'Coro', lines: [] };
        if (coroMatch[1].trim()) {
          current.lines.push(coroMatch[1].trim());
        }
        continue;
      }

      const verseMatch = line.match(/^(\d+)\s*[.\-)]\s*(.*)$/);
      if (verseMatch) {
        flushCurrent();
        current = { type: 'Estrofe', lines: [] };
        if (verseMatch[2].trim()) {
          current.lines.push(verseMatch[2].trim());
        }
        continue;
      }

      if (!current) {
        current = { type: 'Estrofe', lines: [] };
      }
      current.lines.push(line);
    }

    flushCurrent();
  } else {
    const blocks = bodyLines
      .join('\n')
      .split(/\n\s*\n+/)
      .map((b) => b.trim())
      .filter(Boolean);

    for (const block of blocks) {
      sections.push({ section_type: 'Estrofe', content: block });
    }
  }

  if (sections.length === 0) return null;

  return {
    number,
    collection_type: 'Hinário',
    title,
    author,
    folder_id: null,
    folder_name: '',
    sections,
  };
}

const COLETANEA_FILE_REGEX = /^(\d{4})[-.](\d{2})\._.*\.txt$/i;

const COLETANEA_TITLE_FIXES: Record<string, string> = {
  'Quando Eu Olho Pra Voce': 'Quando Eu Olho Pra Você',
  'Nossa Inpiração': 'Nossa Inspiração',
  'Enquanto eu viver.': 'Enquanto eu viver',
};

function cleanColetaneaLine(line: string): string {
  return line
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/(\p{L})--(\p{L})/gu, '$1$2')
    .replace(/\bS´ta\b/g, 'Está')
    .replace(/(\p{L})´(\p{L})/gu, "$1'$2")
    .trim();
}

function splitLongSingleBlock(lines: string[]): string[] {
  if (lines.length <= 10) {
    return [lines.join('\n')];
  }
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += 4) {
    const slice = lines.slice(i, i + 4);
    if (slice.length === 1 && chunks.length > 0) {
      chunks[chunks.length - 1] = `${chunks[chunks.length - 1]}\n${slice[0]}`;
    } else {
      chunks.push(slice.join('\n'));
    }
  }
  return chunks;
}

export function parseColetaneaFile(
  filename: string,
  rawBuffer: Buffer,
  folder?: { id: string; name: string }
): ParsedHymnInput | null {
  const fileMatch = filename.match(COLETANEA_FILE_REGEX);
  if (!fileMatch) return null;

  const year = fileMatch[1];
  const track = fileMatch[2];
  const number = `${year}-${track}`;

  const decoded = decodeHymnBuffer(rawBuffer);
  const rawLines = decoded
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(cleanColetaneaLine);

  const titleIdx = rawLines.findIndex((l) => l.length > 0);
  if (titleIdx === -1) return null;

  const rawTitle = rawLines[titleIdx];
  const title = COLETANEA_TITLE_FIXES[rawTitle] ?? rawTitle;

  const rest = rawLines.slice(titleIdx + 1);
  const firstBlankIdx = rest.findIndex((l) => l === '');

  let headerLines: string[] = [];
  let bodyLines: string[] = [];
  if (firstBlankIdx !== -1) {
    headerLines = rest.slice(0, firstBlankIdx).filter(Boolean);
    bodyLines = rest.slice(firstBlankIdx + 1);
  } else {
    bodyLines = rest;
  }

  let author = '';
  const compLine = headerLines.find((l) => /^Composi[çc][ãa]o\s*:/i.test(l));
  if (compLine) {
    author = compLine.replace(/^Composi[çc][ãa]o\s*:\s*/i, '').replace(/\.$/, '').trim();
  } else {
    const letraLine = headerLines.find((l) => /^Letra(?:\s+e\s+M[úu]sica)?\s*:/i.test(l));
    if (letraLine) {
      author = letraLine.trim();
    } else if (headerLines.length > 0) {
      author = headerLines[0];
    } else {
      author = 'Ministério Jovem';
    }
  }

  while (bodyLines.length > 0 && bodyLines[0] === '') bodyLines.shift();
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] === '') bodyLines.pop();

  const rawBlocks = bodyLines
    .join('\n')
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const blocks =
    rawBlocks.length === 1
      ? splitLongSingleBlock(
          rawBlocks[0]
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
        )
      : rawBlocks;

  const sections: Array<{ section_type: HymnSectionType; content: string }> = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    const firstLine = lines[0];
    const coroMatch = firstLine.match(
      /^(?:CORO|C[ÔO]RO|REFR[ÃA]O)(?:\s*\(?\s*\d+\s*x\s*\)?)?\s*[:.]?(?:\s*\(?\s*\d+\s*x\s*\)?)?\s*(.*)$/i
    );

    if (coroMatch) {
      const restOfFirst = coroMatch[1].trim();
      const contentLines = restOfFirst ? [restOfFirst, ...lines.slice(1)] : lines.slice(1);
      const content = contentLines.join('\n').trim();
      if (content) {
        sections.push({ section_type: 'Coro', content });
      }
      continue;
    }

    sections.push({
      section_type: 'Estrofe',
      content: lines.join('\n').trim(),
    });
  }

  if (sections.length === 0) return null;

  return {
    number,
    collection_type: 'Coletânea',
    title,
    author,
    folder_id: folder?.id ?? null,
    folder_name: folder?.name ?? '',
    sections,
  };
}

export function importHinarioFromDirectory(
  db: LocalSqliteDatabase,
  dirPath: string,
  options?: { replaceCollection?: CollectionType; markFlag?: string }
): { totalFiles: number; inserted: number; skipped: number } {
  if (!fs.existsSync(dirPath)) {
    return { totalFiles: 0, inserted: 0, skipped: 0 };
  }

  const files = fs
    .readdirSync(dirPath)
    .filter((f) => /^HA\d+_.*\.txt$/i.test(f))
    .sort();

  const items: ParsedHymnInput[] = [];
  for (const file of files) {
    const buf = fs.readFileSync(path.join(dirPath, file));
    const parsed = parseHinarioFile(file, buf);
    if (parsed) {
      items.push(parsed);
    }
  }

  const res = db.importHymnsBatch(items, options);
  return {
    totalFiles: files.length,
    inserted: res.inserted,
    skipped: res.skipped,
  };
}

export function importColetaneaFromDirectory(
  db: LocalSqliteDatabase,
  dirPath: string,
  options?: { replaceCollection?: CollectionType; markFlag?: string }
): { totalFiles: number; inserted: number; skipped: number } {
  if (!fs.existsSync(dirPath)) {
    return { totalFiles: 0, inserted: 0, skipped: 0 };
  }

  const files = fs
    .readdirSync(dirPath)
    .filter((f) => COLETANEA_FILE_REGEX.test(f))
    .sort();

  const yearFolderMap = new Map<string, { id: string; name: string }>();
  const items: ParsedHymnInput[] = [];

  for (const file of files) {
    const match = file.match(COLETANEA_FILE_REGEX);
    if (!match) continue;
    const year = match[1];

    let folder = yearFolderMap.get(year);
    if (!folder) {
      const created = db.createFolder({
        name: `Coletânea ${year}`,
        collection_type: 'Coletânea',
      });
      folder = { id: created.id, name: created.name };
      yearFolderMap.set(year, folder);
    }

    const buf = fs.readFileSync(path.join(dirPath, file));
    const parsed = parseColetaneaFile(file, buf, folder);
    if (parsed) {
      items.push(parsed);
    }
  }

  const res = db.importHymnsBatch(items, options);
  return {
    totalFiles: files.length,
    inserted: res.inserted,
    skipped: res.skipped,
  };
}

export function ensureHinarioImported(
  db: LocalSqliteDatabase,
  candidateDirs: string[]
): { totalFiles: number; inserted: number; skipped: number } | null {
  const alreadyImported = db.getMetaFlag('hinario_imported') === '1';
  const synced610 = db.getMetaFlag('hinario_610_synced') === '1';
  const hinarioCount = db.listHymns().filter((h) => h.collection_type === 'Hinário').length;
  if (alreadyImported && synced610 && hinarioCount > 0) {
    return null;
  }

  const targetDir = candidateDirs.find((dir) => {
    if (!fs.existsSync(dir)) return false;
    return fs.readdirSync(dir).some((f) => /^HA\d+_.*\.txt$/i.test(f));
  });

  if (targetDir) {
    if (hinarioCount <= 10) {
      const res = importHinarioFromDirectory(db, targetDir, {
        replaceCollection: 'Hinário',
        markFlag: 'hinario_imported',
      });
      if (res.inserted > 0) {
        db.setMetaFlag('hinario_610_synced', '1');
      }
      return res;
    }

    if (!alreadyImported) {
      db.setMetaFlag('hinario_imported', '1');
    }

    if (!synced610) {
      const res = importHinarioFromDirectory(db, targetDir, {
        markFlag: 'hinario_610_synced',
      });
      db.setMetaFlag('hinario_610_synced', '1');
      return res;
    }

    return null;
  }

  const embedded = getEmbeddedHymnsCatalog().hinario;
  if (embedded.length === 0) {
    return null;
  }

  if (hinarioCount <= 10) {
    const res = db.importHymnsBatch(embedded, {
      replaceCollection: 'Hinário',
      markFlag: 'hinario_imported',
    });
    if (res.inserted > 0) {
      db.setMetaFlag('hinario_610_synced', '1');
    }
    return { totalFiles: embedded.length, inserted: res.inserted, skipped: res.skipped };
  }

  if (!alreadyImported) {
    db.setMetaFlag('hinario_imported', '1');
  }

  if (!synced610) {
    const res = db.importHymnsBatch(embedded, {
      markFlag: 'hinario_610_synced',
    });
    db.setMetaFlag('hinario_610_synced', '1');
    return { totalFiles: embedded.length, inserted: res.inserted, skipped: res.skipped };
  }

  return null;
}

export function ensureColetaneaImported(
  db: LocalSqliteDatabase,
  candidateDirs: string[]
): { totalFiles: number; inserted: number; skipped: number } | null {
  const alreadyImported = db.getMetaFlag('coletanea_jovem_imported') === '1';
  const coletaneaCount = db.listHymns().filter((h) => h.collection_type === 'Coletânea').length;
  if (alreadyImported && coletaneaCount > 0) {
    return null;
  }

  const targetDir = candidateDirs.find((dir) => {
    if (!fs.existsSync(dir)) return false;
    return fs.readdirSync(dir).some((f) => COLETANEA_FILE_REGEX.test(f));
  });

  if (targetDir) {
    if (coletaneaCount <= 1) {
      const res = importColetaneaFromDirectory(db, targetDir, {
        replaceCollection: 'Coletânea',
        markFlag: 'coletanea_jovem_imported',
      });
      if (res.inserted > 0) {
        db.setMetaFlag('coletanea_jovem_imported', '1');
      }
      return res;
    }

    const res = importColetaneaFromDirectory(db, targetDir, {
      markFlag: 'coletanea_jovem_imported',
    });
    db.setMetaFlag('coletanea_jovem_imported', '1');
    return res;
  }

  const embedded = getEmbeddedHymnsCatalog().coletanea;
  if (embedded.length === 0) {
    return null;
  }

  const folderMap = new Map<string, { id: string; name: string }>();
  const items: ParsedHymnInput[] = embedded.map((item) => {
    const folderName = item.folder_name || '';
    if (!folderName) {
      return item;
    }
    let folder = folderMap.get(folderName);
    if (!folder) {
      const created = db.createFolder({
        name: folderName,
        collection_type: 'Coletânea',
      });
      folder = { id: created.id, name: created.name };
      folderMap.set(folderName, folder);
    }
    return {
      ...item,
      folder_id: folder.id,
      folder_name: folder.name,
    };
  });

  if (coletaneaCount <= 1) {
    const res = db.importHymnsBatch(items, {
      replaceCollection: 'Coletânea',
      markFlag: 'coletanea_jovem_imported',
    });
    if (res.inserted > 0) {
      db.setMetaFlag('coletanea_jovem_imported', '1');
    }
    return { totalFiles: items.length, inserted: res.inserted, skipped: res.skipped };
  }

  const res = db.importHymnsBatch(items, {
    markFlag: 'coletanea_jovem_imported',
  });
  db.setMetaFlag('coletanea_jovem_imported', '1');
  return { totalFiles: items.length, inserted: res.inserted, skipped: res.skipped };
}
