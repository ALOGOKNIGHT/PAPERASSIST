"""Import the NEET Biology chapter JSON files from a Crawl4AI ZIP archive."""

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
OUTPUT = ROOT / "data" / "question-banks" / "neet-biology.json.gz"


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
    source_url = str(source.get("sourceUrl") or "")
    question_html = clean_markup(source.get("questionHtml"), source_url)
    difficulty = source.get("difficulty")
    marks = source.get("marks") or {}
    positive = marks.get("positive")
    negative = marks.get("negative")
    marks_label = f"{positive} marks" if positive is not None else "—"
    if negative:
        marks_label += f" · {negative}"
    options = []
    for option in source.get("options") or []:
        option_html = clean_markup(option.get("html"), source_url)
        options.append({
            "label": option.get("label") or "",
            **({"html": option_html} if option_html else {"text": option.get("text") or ""}),
        })
    exam = str(source.get("exam") or "NEET")
    subject = str(source.get("subject") or "Biology")
    chapter = str(source.get("chapter") or "")
    return {
        "id": "|".join((exam, subject, chapter, str(source.get("id") or ""))),
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
        "paper": source.get("paper") or "NEET PYQ",
        "year": source.get("year"),
        "sourceUrl": source_url,
        "imageUrls": source.get("imageUrls") or [],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="Path to the downloaded NEET Biology ZIP")
    args = parser.parse_args()
    if not args.archive.is_file():
        raise SystemExit(f"Archive not found: {args.archive}")

    questions = []
    seen_ids: set[str] = set()
    seen_texts: set[str] = set()
    chapters: set[str] = set()
    levels: Counter[str] = Counter()
    estimated_count = 0
    json_files = 0
    with zipfile.ZipFile(args.archive) as archive:
        for filename in archive.namelist():
            if not filename.lower().endswith(".json") or "checkpoint" in filename.lower():
                continue
            bank = json.loads(archive.read(filename))
            json_files += 1
            for source in bank.get("questions") or []:
                question = canonical_question(source)
                if question["exam"].casefold() != "neet" or question["subject"].casefold() != "biology":
                    raise ValueError(f"Unexpected exam/subject in {filename}: {question['exam']} / {question['subject']}")
                text_key = normalize_text(source.get("questionText"))
                if question["id"] in seen_ids or (text_key and text_key in seen_texts):
                    continue
                seen_ids.add(question["id"])
                if text_key:
                    seen_texts.add(text_key)
                questions.append(question)
                chapters.add(question["chapter"])
                levels[question["level"]] += 1
                estimated_count += question["difficultyEstimated"]

    if not questions:
        raise ValueError("No NEET Biology questions were found in the ZIP.")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix(OUTPUT.suffix + ".tmp")
    with gzip.open(temporary, "wt", encoding="utf-8", compresslevel=9) as output_file:
        json.dump({"questions": questions, "mathSvgDefinitions": []}, output_file,
                  ensure_ascii=False, separators=(",", ":"))
    temporary.replace(OUTPUT)
    size_mb = OUTPUT.stat().st_size / (1024 * 1024)
    print(f"Processed {json_files} chapter files; saved {len(questions)} unique questions "
          f"across {len(chapters)} chapters.")
    print(f"Difficulty counts: {dict(levels)} ({estimated_count} estimated; review recommended).")
    print(f"Output: {OUTPUT} ({size_mb:.2f} MiB compressed)")
    print("Correct answers and explanations were not imported.")


if __name__ == "__main__":
    main()
