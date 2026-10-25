import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const questionsDir = path.join(root, 'data', 'questions');
const output = path.join(root, 'data', 'question-bank.js');

const files = (await readdir(questionsDir)).filter(name => name.toLowerCase().endsWith('.json')).sort();
const questions = [];
const definitions = new Set();
const seen = new Set();
const seenQuestionText = new Set();

function normalizeQuestionText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

function stripCrawlerMarkers(markup) {
  return String(markup ?? '')
    .replace(/HTML_TAG_START\s*/g, '')
    .replace(/\s*HTML_TAG_END/g, '')
    .trim();
}

function makeQuestionHtmlUrlsAbsolute(markup, sourceUrl) {
  return markup.replace(/\bsrc="([^"]+)"/g, (match, value) => {
    try { return `src="${new URL(value, sourceUrl).href}"`; }
    catch { return match; }
  });
}

for (const filename of files) {
  const bank = JSON.parse(await readFile(path.join(questionsDir, filename), 'utf8'));
  for (const definition of bank.mathSvgDefinitions ?? []) definitions.add(definition);
  for (const source of bank.questions ?? []) {
    const key = [source.exam, source.subject, source.chapter, source.id].join('|');
    const textKey = normalizeQuestionText(source.questionText);
    if (seen.has(key) || (textKey && seenQuestionText.has(textKey))) continue;
    seen.add(key);
    if (textKey) seenQuestionText.add(textKey);
    const questionHtml = stripCrawlerMarkers(source.questionHtml ?? '');
    const difficultyEstimated = source.difficulty == null || source.difficultyIsEstimated === true;
    const difficultyMissing = source.difficulty == null;
    questions.push({
      id: key,
      level: String(source.difficulty ?? 'medium').replace(/^./, c => c.toUpperCase()),
      difficultyEstimated,
      difficultyMissing,
      subject: source.subject ?? '',
      exam: source.exam ?? '',
      chapter: source.chapter ?? '',
      name: source.chapter ?? 'Question',
      text: source.questionText ?? '',
      questionHtml: makeQuestionHtmlUrlsAbsolute(questionHtml, source.sourceUrl ?? ''),
      options: (source.options ?? []).map(option => ({
        ...option,
        html: makeQuestionHtmlUrlsAbsolute(stripCrawlerMarkers(option.html ?? ''), source.sourceUrl ?? ''),
      })),
      type: source.type ?? 'Question',
      marks: source.marks ? `${source.marks.positive} marks${source.marks.negative ? ` · ${source.marks.negative}` : ''}` : '—',
      paper: source.paper ?? 'JEE Main PYQ',
      year: source.year ?? null,
      sourceUrl: source.sourceUrl ?? '',
      imageUrls: source.imageUrls ?? [],
    });
  }
}

const bundle = `window.PAPERCRAFT_QUESTION_BANK=${JSON.stringify(questions)};\nwindow.PAPERCRAFT_MATH_SVG_DEFINITIONS=${JSON.stringify([...definitions])};\n`;
await writeFile(output, bundle, 'utf8');
console.log(`Built ${questions.length} questions from ${files.length} JSON file(s) at ${output}`);
