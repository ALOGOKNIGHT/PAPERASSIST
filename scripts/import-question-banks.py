"""Import chapter JSON files from the user's ZIP archives into lazy-loaded banks.

The ZIPs are read in place; checkpoint files and crawler explanations/answers are
intentionally excluded. Difficulty labels are retained with their estimated flag.
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
import zipfile
from collections import Counter
from pathlib import Path
from urllib.parse import urljoin


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "question-banks"


def normalize_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip().casefold()


def clean_markup(value: object, source_url: str) -> str:
    markup = re.sub(r"HTML_TAG_START\s*|\s*HTML_TAG_END", "", str(value or "")).strip()
    return re.sub(
        r'\bsrc="([^"]+)"',
        lambda match: f'src="{urljoin(source_url, match.group(1))}"',
        markup,
    )


def canonical_question(source: dict) -> dict:
    exam = str(source.get("exam") or "")
    subject = str(source.get("subject") or "")
    chapter = str(source.get("chapter") or "")
    source_id = str(source.get("id") or "")
    marks = source.get("marks") or {}
    positive = marks.get("positive")
    negative = marks.get("negative")
    marks_label = f"{positive} marks" if positive is not None else "—"
    if negative:
        marks_label += f" · {negative}"
    source_url = str(source.get("sourceUrl") or "")
    difficulty = source.get("difficulty")
    options = []
    for option in source.get("options") or []:
        rendered_option = clean_markup(option.get("html"), source_url)
        options.append({
            "label": option.get("label") or "",
            **({"html": rendered_option} if rendered_option else {"text": option.get("text") or ""}),
        })
    question_html = clean_markup(source.get("questionHtml"), source_url)
    return {
        "id": "|".join((exam, subject, chapter, source_id)),
        "level": str(difficulty or "medium").capitalize(),
        "difficultyEstimated": difficulty is None or source.get("difficultyIsEstimated") is True,
        "difficultyMissing": difficulty is None,
        "subject": subject,
        "exam": exam,
        "chapter": chapter,
        "name": chapter or "Question",
        "text": "" if question_html else (source.get("questionText") or ""),
        "questionHtml": question_html,
        "options": options,
        "type": source.get("type") or "Question",
        "marks": marks_label,
        "paper": source.get("paper") or ("NEET PYQ" if exam == "NEET" else "JEE Main PYQ"),
        "year": source.get("year"),
        "sourceUrl": source_url,
        "imageUrls": source.get("imageUrls") or [],
    }


def import_archive(label: str, archive_path: Path, known_ids: set[str], known_texts: set[str]):
    questions = []
    definitions: dict[str, str] = {}
    levels = Counter()
    estimated = 0
    chapter_files = 0
    with zipfile.ZipFile(archive_path) as archive:
        for filename in archive.namelist():
            if not filename.lower().endswith(".json") or "checkpoint" in filename.lower():
                continue
            bank = json.loads(archive.read(filename))
            chapter_files += 1
            # Crawl4AI saves a full copy of MathJax's SVG font paths with many
            # questions. Those copies reuse the same stable glyph IDs; retain
            # one path per ID so the browser doesn't receive hundreds of MB.
            for definition in bank.get("mathSvgDefinitions") or []:
                for path_tag in re.findall(r"<path\b[^>]*>(?:.*?)</path>|<path\b[^>]*/>", definition, re.S):
                    match = re.search(r'\bid="([^"]+)"', path_tag)
                    if match:
                        definitions.setdefault(match.group(1), path_tag)
            for source in bank.get("questions") or []:
                question = canonical_question(source)
                text_key = normalize_text(question["text"])
                if question["id"] in known_ids or (text_key and text_key in known_texts):
                    continue
                known_ids.add(question["id"])
                if text_key:
                    known_texts.add(text_key)
                questions.append(question)
                levels[question["level"]] += 1
                estimated += question["difficultyEstimated"]

    slug = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    destination = OUTPUT / f"{slug}.json.gz"
    merged_definitions = "<defs>" + "".join(definitions.values()) + "</defs>" if definitions else ""
    payload = {"questions": questions, "mathSvgDefinitions": [merged_definitions] if merged_definitions else []}
    with gzip.open(destination, "wt", encoding="utf-8", compresslevel=9) as output_file:
        json.dump(payload, output_file, ensure_ascii=False, separators=(",", ":"))
    # Keep only the deployable compressed asset, not the oversized intermediate JSON.
    (OUTPUT / f"{slug}.json").unlink(missing_ok=True)
    size_mb = destination.stat().st_size / (1024 * 1024)
    print(f"{label}: {chapter_files} chapters, {len(questions)} new questions, "
          f"levels={dict(levels)}, estimated={estimated}, {size_mb:.1f} MiB -> {destination}")
    return len(questions), estimated


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jee-physics", required=True, type=Path)
    parser.add_argument("--jee-mathematics", required=True, type=Path)
    parser.add_argument("--neet-physics", required=True, type=Path)
    parser.add_argument("--jee-chemistry", required=True, type=Path)
    parser.add_argument("--neet-chemistry", required=True, type=Path)
    args = parser.parse_args()

    # Seed deduplication from the small bank already compiled into the app.
    existing = ROOT / "data" / "question-bank.js"
    known_ids: set[str] = set()
    known_texts: set[str] = set()
    if existing.exists():
        raw = existing.read_text(encoding="utf-8")
        match = re.search(r"window\.PAPERCRAFT_QUESTION_BANK=(.*?);\s*window\.PAPERCRAFT_MATH", raw, re.S)
        if match:
            for question in json.loads(match.group(1)):
                known_ids.add(str(question.get("id") or ""))
                text_key = normalize_text(question.get("text"))
                if text_key:
                    known_texts.add(text_key)

    files = [
        ("jee-main-physics", args.jee_physics),
        ("jee-main-mathematics", args.jee_mathematics),
        ("neet-physics", args.neet_physics),
        ("jee-main-chemistry", args.jee_chemistry),
        ("neet-chemistry", args.neet_chemistry),
    ]
    total = estimated_total = 0
    for label, archive_path in files:
        count, estimated = import_archive(label, archive_path, known_ids, known_texts)
        total += count
        estimated_total += estimated
    print(f"Imported {total} unique questions; {estimated_total} difficulty labels are estimates. "
          "No answers or explanations were imported.")


if __name__ == "__main__":
    main()
