"""Local, self-hosted PDF/image question extraction service for PaperCraft."""

from __future__ import annotations

import base64
import html
import io
import logging
import os
import re
import shutil
import unicodedata
from collections import Counter, defaultdict
from typing import Any

import fitz
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_PDF_PAGES = 40
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"}

app = FastAPI(title="PaperCraft extraction service", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000", "http://127.0.0.1:8000",
        "http://localhost:5500", "http://127.0.0.1:5500",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

_pix2text_engine: Any = None
_pix2text_attempted = False
_pix2text_error: str | None = None
logger = logging.getLogger(__name__)

QUESTION_START = re.compile(
    r"^\s*(?:Q(?:uestion)?\.?\s*)?(\d{1,3})\s*[.)]\s*(.*)$", re.I
)
LETTER_OPTION = re.compile(r"^\s*(?:\(([A-D])\)|([A-D])[.)])\s*(.*)$", re.I)
NUMBER_OPTION = re.compile(r"^\s*\(([1-4])\)\s*(.*)$")
INLINE_OPTION = re.compile(r"(?<!\S)(?:\(([A-D])\)|([A-D])[.)])", re.I)
INLINE_NUMBER_OPTION = re.compile(r"(?<!\S)\(([1-4])\)")
SOURCE_MARKER = re.compile(r"^\s*(?:FB\d{3,}|HY\d{3,}|[A-Z]{1,4}\d{3,})\s*$", re.I)
ANSWER_HEADING = re.compile(r"\b(?:answer\s*key|answers?\s*key)\b", re.I)
SECTION_HEADING = re.compile(r"^\s*(?:EXERCISE\s*#?\s*)?(.+?)\s*$", re.I)


def normalized(value: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", value)).strip()


def clean_pdf_text(value: str) -> str:
    # Allen and similar modules print internal item IDs next to option rows.
    value = re.sub(r"\bFB\d{3,}\b", " ", value, flags=re.I)
    # Some embedded-font artifacts are inserted inside numeric option markers.
    value = re.sub(r"\(([1-4])\s*\(cid:\d+\)\)", r"(\1)", value, flags=re.I)
    # Keep an explicit marker instead of silently discarding an unmapped glyph.
    value = re.sub(r"\(cid:\d+\)", " [unclear] ", value, flags=re.I)
    return normalized(value)


def image_data_url(image: Image.Image, max_width: int = 1000) -> str:
    image = image.convert("RGB")
    if image.width > max_width:
        height = round(image.height * max_width / image.width)
        image = image.resize((max_width, height), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=70, optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


def reading_order(lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Read a likely two-column page down the left column, then the right."""
    if len(lines) < 8:
        return sorted(lines, key=lambda line: (line["y0"], line["x0"]))
    width = max(line["width"] for line in lines)
    left = [line for line in lines if line["x0"] < width * 0.46 and line["x1"] < width * 0.66]
    right = [line for line in lines if line["x0"] > width * 0.48 and line["x1"] > width * 0.55]
    left_start = sorted(line["x0"] for line in left)[len(left) // 2] if left else 0
    right_start = sorted(line["x0"] for line in right)[len(right) // 2] if right else width
    is_two_column = len(left) >= 4 and len(right) >= 4 and right_start - left_start > width * 0.28
    if is_two_column:
        # Side-by-side answer choices are common on otherwise single-column
        # exam pages. They must remain in top-to-bottom row order. Treat a
        # page as two question columns only when numbered question starts
        # occur repeatedly in both halves of the page.
        def question_starts(items: list[dict[str, Any]]) -> int:
            return sum(bool(re.match(r"^\s*(?:Q(?:uestion)?\.?\s*)?\d{1,3}\s*[.)]\s*", item["text"], re.I)) for item in items)

        if question_starts(left) < 2 or question_starts(right) < 2:
            is_two_column = False
    if not is_two_column:
        return sorted(lines, key=lambda line: (line["y0"], line["x0"]))
    column_lines = set(map(id, left + right))
    full_width = [line for line in lines if id(line) not in column_lines]
    first_column_y = min(line["y0"] for line in left + right)
    top = [line for line in full_width if line["y0"] < first_column_y]
    remaining = [line for line in full_width if line["y0"] >= first_column_y]
    return (
        sorted(top, key=lambda line: (line["y0"], line["x0"]))
        + sorted(left, key=lambda line: (line["y0"], line["x0"]))
        + sorted(right, key=lambda line: (line["y0"], line["x0"]))
        + sorted(remaining, key=lambda line: (line["y0"], line["x0"]))
    )


def render_pdf_page(page: fitz.Page) -> str:
    scale = min(1.35, 1000 / max(page.rect.width, page.rect.height))
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    return image_data_url(image)


def pdf_page_lines(page: fitz.Page, page_number: int) -> tuple[list[dict[str, Any]], int]:
    """Read spans into visual lines while retaining coordinates for review/ordering."""
    page_dict = page.get_text("dict", sort=True)
    extracted: list[dict[str, Any]] = []
    char_count = 0
    for block in page_dict.get("blocks", []):
        if "lines" not in block:
            continue
        for line in block["lines"]:
            spans = line.get("spans", [])
            text = normalized("".join(span.get("text", "") for span in spans))
            if not text:
                continue
            char_count += sum(ch.isalnum() for ch in text)
            extracted.append({
                "page": page_number,
                "x0": min((span["bbox"][0] for span in spans), default=0),
                "x1": max((span["bbox"][2] for span in spans), default=0),
                "y0": min((span["bbox"][1] for span in spans), default=0),
                "y1": max((span["bbox"][3] for span in spans), default=0),
                "width": page.rect.width,
                "height": page.rect.height,
                "text": text,
            })
    return reading_order(extracted), char_count


def image_ocr_lines(image: Image.Image, page_number: int) -> list[dict[str, Any]]:
    """Optional local Tesseract fallback. No OCR API or network request is used."""
    try:
        import pytesseract
        from pytesseract import Output
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=("This page needs OCR, but pytesseract is not installed. Install the "
                    "server requirements and the local Tesseract OCR application, then retry."),
        ) from exc

    configured = os.environ.get("TESSERACT_CMD")
    executable = configured or shutil.which("tesseract")
    if not executable or not os.path.isfile(executable):
        raise HTTPException(
            status_code=503,
            detail=("OCR needs the Tesseract application, which is not installed at the "
                    "configured location. Install the Windows Tesseract OCR application, "
                    "then set TESSERACT_CMD to the full path of tesseract.exe and restart "
                    "the PaperCraft extraction server."),
        )
    pytesseract.pytesseract.tesseract_cmd = executable

    # Render/input quality matters greatly for subscripts, superscripts and
    # closely spaced option labels. Upscale small scans and use Tesseract's
    # equation-friendly sparse-text layout mode as a fallback.
    if max(image.size) < 1800:
        scale = min(2.0, 1800 / max(image.size))
        image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    try:
        data = pytesseract.image_to_data(image, output_type=Output.DICT, config="--oem 3 --psm 3 -c preserve_interword_spaces=1")
    except pytesseract.pytesseract.TesseractNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail=("Tesseract was configured but Windows could not launch tesseract.exe. "
                    "Check TESSERACT_CMD and restart the extraction server."),
        ) from exc
    grouped: dict[tuple[int, int, int], list[tuple[int, str]]] = defaultdict(list)
    for index, token in enumerate(data["text"]):
        token = token.strip()
        if not token or float(data["conf"][index]) < 0:
            continue
        key = (data["block_num"][index], data["par_num"][index], data["line_num"][index])
        grouped[key].append((index, token))

    lines = []
    for items in grouped.values():
        indexes = [item[0] for item in items]
        words = [item[1] for item in items]
        x0 = min(data["left"][i] for i in indexes)
        y0 = min(data["top"][i] for i in indexes)
        x1 = max(data["left"][i] + data["width"][i] for i in indexes)
        y1 = max(data["top"][i] + data["height"][i] for i in indexes)
        lines.append({
            "page": page_number, "x0": x0, "x1": x1, "y0": y0, "y1": y1,
            "width": image.width, "height": image.height,
            "text": normalized(" ".join(words)), "ocr": True,
        })
    return reading_order(lines)


def formula_ocr_lines(image: Image.Image, page_number: int) -> list[dict[str, Any]] | None:
    """Use optional local Pix2Text for mixed prose and mathematical notation.

    Model weights are downloaded on first use; inference then runs on this
    machine. Returning None means Pix2Text is not installed or could not run.
    """
    global _pix2text_engine, _pix2text_attempted, _pix2text_error
    if not _pix2text_attempted:
        _pix2text_attempted = True
        try:
            # RapidOCR 3.x renamed this resolver while the current CnSTD
            # wrapper still imports the former name. They have the same
            # resolver arguments; provide the compatibility alias before
            # importing Pix2Text/CnSTD.
            import rapidocr.utils.model_resolver as model_resolver
            if not hasattr(model_resolver, "resolve_model_key") and hasattr(model_resolver, "route_to_model_key"):
                model_resolver.resolve_model_key = model_resolver.route_to_model_key
            from pix2text import Pix2Text
            _pix2text_engine = Pix2Text()
            _pix2text_error = None
        except Exception as exc:
            _pix2text_engine = None
            _pix2text_error = f"{type(exc).__name__}: {exc}"
            logger.exception("Pix2Text initialization failed; using Tesseract fallback")
    if _pix2text_engine is None:
        return None

    try:
        blocks = _pix2text_engine.recognize_text_formula(image, return_text=False)
    except Exception as exc:
        _pix2text_error = f"{type(exc).__name__}: {exc}"
        logger.exception("Pix2Text recognition failed; using Tesseract fallback")
        return None

    blocks_by_y: list[dict[str, Any]] = []
    for block in blocks or []:
        text = str(block.get("text", "")).strip()
        if not text:
            continue
        kind = str(block.get("type", "text")).lower()
        if kind in {"isolated", "embedding"}:
            formula = text.strip().strip("$")
            text = f"\\({formula}\\)"
        position = block.get("position")
        try:
            points = [[float(point[0]), float(point[1])] for point in position]
            x0 = min(point[0] for point in points)
            y0 = min(point[1] for point in points)
            x1 = max(point[0] for point in points)
            y1 = max(point[1] for point in points)
        except (TypeError, ValueError, IndexError):
            continue
        blocks_by_y.append({
            "page": page_number, "x0": x0, "x1": x1, "y0": y0, "y1": y1,
            "width": image.width, "height": image.height, "text": text,
            "ocr": True, "math_ocr": True,
        })

    # Pix2Text's line_number may be absent or repeated across unrelated rows.
    # Cluster blocks by their visual baselines so stacked reactions remain
    # separate lines instead of being flattened into one string.
    groups: list[list[dict[str, Any]]] = []
    for box in sorted(blocks_by_y, key=lambda item: ((item["y0"] + item["y1"]) / 2, item["x0"])):
        center = (box["y0"] + box["y1"]) / 2
        box_height = max(1.0, box["y1"] - box["y0"])
        best_group = None
        best_distance = float("inf")
        for group in groups:
            group_centers = [(item["y0"] + item["y1"]) / 2 for item in group]
            group_center = sum(group_centers) / len(group_centers)
            group_height = max(1.0, max(item["y1"] - item["y0"] for item in group))
            distance = abs(center - group_center)
            if distance <= max(4.0, 0.52 * max(box_height, group_height)) and distance < best_distance:
                best_group, best_distance = group, distance
        if best_group is None:
            groups.append([box])
        else:
            best_group.append(box)

    lines = []
    for boxes in groups:
        boxes.sort(key=lambda box: box["x0"])
        lines.append({
            "page": page_number,
            "x0": min(box["x0"] for box in boxes), "x1": max(box["x1"] for box in boxes),
            "y0": min(box["y0"] for box in boxes), "y1": max(box["y1"] for box in boxes),
            "width": image.width, "height": image.height,
            "text": normalized(" ".join(box["text"] for box in boxes)),
            "ocr": True, "math_ocr": True,
        })
    return reading_order(lines) if lines else None


def merge_formula_and_text_ocr(text_lines: list[dict[str, Any]], formula_lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep every text-OCR row and replace only rows matched by formula OCR."""
    merged: list[dict[str, Any]] = []
    matched_formula: set[int] = set()
    for text_line in text_lines:
        th = max(1.0, text_line["y1"] - text_line["y0"])
        tx = max(1.0, text_line["x1"] - text_line["x0"])
        best: tuple[float, int] | None = None
        for index, formula_line in enumerate(formula_lines):
            if index in matched_formula:
                continue
            fh = max(1.0, formula_line["y1"] - formula_line["y0"])
            vertical_gap = max(0.0, text_line["y0"] - formula_line["y1"], formula_line["y0"] - text_line["y1"])
            horizontal_overlap = max(0.0, min(text_line["x1"], formula_line["x1"]) - max(text_line["x0"], formula_line["x0"]))
            if vertical_gap > max(th, fh) * 0.65 or horizontal_overlap < min(tx, max(1.0, formula_line["x1"] - formula_line["x0"])) * 0.12:
                continue
            score = horizontal_overlap / max(1.0, min(tx, formula_line["x1"] - formula_line["x0"])) - vertical_gap / max(th, fh)
            if best is None or score > best[0]:
                best = (score, index)
        if best is None:
            merged.append(text_line)
        else:
            index = best[1]
            matched_formula.add(index)
            # Formula OCR tends to preserve superscripts and subscripts; retain
            # the row geometry and text recognized from that same line.
            merged.append({**text_line, "text": formula_lines[index]["text"], "math_ocr": True, "ocr": True})

    for index, formula_line in enumerate(formula_lines):
        if index in matched_formula:
            continue
        center = (formula_line["y0"] + formula_line["y1"]) / 2
        duplicate = any(
            abs(center - (line["y0"] + line["y1"]) / 2) <= max(line["y1"] - line["y0"], formula_line["y1"] - formula_line["y0"]) * 0.45
            and min(line["x1"], formula_line["x1"]) > max(line["x0"], formula_line["x0"])
            for line in merged
        )
        if not duplicate:
            merged.append(formula_line)
    return reading_order(merged)


def repair_damaged_pdf_lines(
    pdf_lines: list[dict[str, Any]], ocr_lines: list[dict[str, Any]], *, scale_x: float, scale_y: float,
) -> tuple[list[dict[str, Any]], int]:
    """Replace only PDF lines with visibly broken glyph mappings using nearby OCR."""
    repaired: list[dict[str, Any]] = []
    replacements = 0
    for line in pdf_lines:
        original = line["text"]
        damaged = bool(re.search(r"\(cid:\d+\)|[�\ufffd]|(?:¾{2,})", original, re.I))
        if not damaged:
            repaired.append(line)
            continue

        # OCR boxes are in rendered-image pixels; PDF text boxes are in points.
        target = [line["x0"] * scale_x, line["y0"] * scale_y, line["x1"] * scale_x, line["y1"] * scale_y]
        height = max(1.0, target[3] - target[1])
        candidates = []
        for ocr_line in ocr_lines:
            box = [ocr_line["x0"], ocr_line["y0"], ocr_line["x1"], ocr_line["y1"]]
            vertical_overlap = min(target[3], box[3]) - max(target[1], box[1])
            horizontal_overlap = min(target[2], box[2]) - max(target[0], box[0])
            center_distance = abs(((target[1] + target[3]) / 2) - ((box[1] + box[3]) / 2))
            if vertical_overlap > 0 or (horizontal_overlap > 0 and center_distance < height * 0.55):
                candidates.append(ocr_line)

        ocr_text = normalized(" ".join(item["text"] for item in sorted(candidates, key=lambda item: item["x0"])))
        original_bad = len(re.findall(r"\(cid:\d+\)|[�\ufffd]|¾", original, re.I))
        ocr_bad = len(re.findall(r"\(cid:\d+\)|[�\ufffd]|¾", ocr_text, re.I))
        if ocr_text and ocr_bad < original_bad:
            repaired.append({**line, "text": ocr_text, "ocr": True, "math_ocr": bool(any(item.get("math_ocr") for item in candidates))})
            replacements += 1
        else:
            repaired.append({**line, "ocr": True})
    # Keep the PDF extractor's reading order; re-sorting coordinates can
    # scramble pages that use two columns.
    return repaired, replacements


def strip_repeating_margins(pages: list[list[dict[str, Any]]]) -> list[list[dict[str, Any]]]:
    edge_counts = Counter()
    for lines in pages:
        for line in lines:
            near_edge = line["y0"] < line["height"] * 0.11 or line["y1"] > line["height"] * 0.90
            key = normalized(line["text"]).casefold()
            if near_edge and len(key) > 3:
                edge_counts[key] += 1
    threshold = max(2, round(len(pages) * 0.3))
    repeated = {key for key, count in edge_counts.items() if count >= threshold}
    cleaned = []
    for lines in pages:
        retained = []
        for line in lines:
            key = normalized(line["text"]).casefold()
            near_edge = line["y0"] < line["height"] * 0.11 or line["y1"] > line["height"] * 0.90
            if near_edge and key in repeated:
                continue
            if re.fullmatch(r"[\[\(]?\d{1,3}[\]\)]?", key):
                continue
            if SOURCE_MARKER.match(line["text"]):
                continue
            retained.append(line)
        cleaned.append(retained)
    return cleaned


def extract_answer_key(pages: list[list[dict[str, Any]]]) -> dict[tuple[str, int], str]:
    """Read common paired number/answer rows, including the supplied Allen layout."""
    answer_map: dict[tuple[str, int], str] = {}
    in_key = False
    section = ""
    pending_numbers: list[int] | None = None
    for lines in pages:
        for line in lines:
            text = normalized(line["text"])
            if ANSWER_HEADING.search(text):
                in_key = True
                pending_numbers = None
                continue
            if not in_key:
                continue
            heading = re.search(r"EXERCISE\s*#?\s*(.+)$", text, re.I)
            if heading:
                section = normalized(heading.group(1)).upper()
                pending_numbers = None
                continue
            solved_answer = re.match(r"^(\d{1,3})\s*\.\s*\(([1-4])\)", text)
            if solved_answer:
                answer_map[(section, int(solved_answer.group(1)))] = solved_answer.group(2)
                continue
            is_question_row = bool(re.match(r"^(?:QUE\.?|QUESTION)\s*", text, re.I))
            is_answer_row = bool(re.match(r"^(?:ANS\.?|ANSWER)\s*", text, re.I))
            stripped = re.sub(r"^(?:QUE\.?|QUESTION|ANS\.?|ANSWER)\s*", "", text, flags=re.I)
            tokens = re.findall(r"(?<![A-Za-z])\d{1,3}(?![A-Za-z])|\b[A-D]\b", stripped, re.I)
            if not tokens:
                continue
            if "cid:" in text.casefold() or "�" in text:
                continue
            if is_answer_row and pending_numbers:
                if all(token.upper() in {"A", "B", "C", "D"} for token in tokens):
                    for number, answer in zip(pending_numbers, tokens):
                        answer_map[(section, number)] = answer.upper()
                    pending_numbers = None
                elif all(token.isdigit() and 1 <= int(token) <= 4 for token in tokens):
                    for number, answer in zip(pending_numbers, tokens):
                        answer_map[(section, number)] = answer
                    pending_numbers = None
            elif is_question_row and all(token.isdigit() for token in tokens):
                pending_numbers = [int(token) for token in tokens]
            elif not is_answer_row and re.fullmatch(r"[\d\s]+", text) and len(tokens) >= 2:
                pending_numbers = [int(token) for token in tokens]
            elif pending_numbers and re.fullmatch(r"[A-D\s]+", text, re.I) and all(token.upper() in {"A", "B", "C", "D"} for token in tokens):
                for number, answer in zip(pending_numbers, tokens):
                    answer_map[(section, number)] = answer.upper()
                pending_numbers = None
            elif pending_numbers and re.fullmatch(r"[1-4\s]+", text) and all(token.isdigit() and 1 <= int(token) <= 4 for token in tokens):
                for number, answer in zip(pending_numbers, tokens):
                    answer_map[(section, number)] = answer
                pending_numbers = None
    return answer_map


def split_inline_options(text: str) -> tuple[str, list[dict[str, str]]]:
    for pattern, numeric in ((INLINE_OPTION, False), (INLINE_NUMBER_OPTION, True)):
        matches = list(pattern.finditer(text))
        # Options in exam PDFs are often printed two per row: A/B then C/D.
        # Accept those exact contiguous pairs, as well as a complete A-D row.
        if len(matches) < 2:
            continue
        labels = [(match.group(1) or match.group(2)) for match in matches]
        labels = labels if numeric else [label.upper() for label in labels]
        expected = ["1", "2", "3", "4"] if numeric else ["A", "B", "C", "D"]
        positions = [expected.index(label) if label in expected else -1 for label in labels]
        if any(position < 0 for position in positions):
            continue
        if len(positions) == 2:
            valid_sequence = positions in ([0, 1], [2, 3])
        else:
            valid_sequence = positions == list(range(positions[0], positions[0] + len(positions)))
        if not valid_sequence:
            continue
        prefix = text[:matches[0].start()].strip()
        options = []
        for index, match in enumerate(matches):
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            label = match.group(1) or match.group(2)
            label = label if numeric else label.upper()
            options.append({"label": label, "text": text[match.end():end].strip()})
        return prefix, options
    return text, []


def parse_questions(
    pages: list[list[dict[str, Any]]], *, exam: str, subject: str, chapter: str,
    filename: str, answer_key: dict[tuple[str, int], str],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    questions: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    current_option: int | None = None
    section = "Practice"
    page_images: list[dict[str, Any]] = []

    def append_content(text: str) -> None:
        nonlocal current_option
        if not current or not text.strip():
            return
        text = clean_pdf_text(text)
        if current_option is not None:
            current["options"][current_option]["text"] = normalized(
                current["options"][current_option]["text"] + " " + text
            )
        else:
            current["text"] = clean_pdf_text(current["text"] + " " + text)

    def include_source_bbox(line: dict[str, Any]) -> None:
        if not current:
            return
        box = [line["x0"], line["y0"], line["x1"], line["y1"]]
        for source_box in current["source_bboxes"]:
            if source_box["page"] == line["page"]:
                old = source_box["bbox"]
                source_box["bbox"] = [min(old[0], box[0]), min(old[1], box[1]), max(old[2], box[2]), max(old[3], box[3])]
                return
        current["source_bboxes"].append({"page": line["page"], "bbox": box})

    def finish() -> None:
        nonlocal current, current_option
        if not current:
            return
        current["text"] = normalized(current["text"])
        for option in current["options"]:
            option["text"] = normalized(option["text"])
        warnings = current["extractionWarnings"]
        if not current["text"]:
            warnings.append("Question text could not be extracted.")
        labels = [option["label"] for option in current["options"]]
        if current["options"] and labels not in (["A", "B", "C", "D"], ["1", "2", "3", "4"]):
            warnings.append("Option labels are incomplete or unusual; verify against the page.")
        combined = current["text"] + " " + " ".join(o["text"] for o in current["options"])
        if re.search(r"[�\ufffd]|\[unclear\]", combined, re.I):
            warnings.append("The PDF contains an unreadable glyph; verify this question image.")
        if re.search(r"(?:¾{2,}|\(cid:\d+\))", combined, re.I):
            warnings.append("A formula or symbol may not have survived text extraction; verify the page image.")
        current["questionHtml"] = html.escape(current["text"], quote=False)
        current["type"] = "MCQ (Single Correct Answer)" if current["options"] else "Short answer"
        citation = re.search(
            r"\b(AIEEE|JEE\s*[- ]?\s*MAIN|JEE\s*[- ]?\s*ADV(?:ANCED)?|IIT)\s*[-, ]+\s*((?:19|20)\d{2})\b",
            current["text"], re.I,
        )
        if citation:
            label = re.sub(r"\s+", " ", citation.group(1).replace("-", " ")).strip().upper()
            current["paper"] = "JEE Main" if "MAIN" in label else "JEE Advanced" if "ADV" in label or label == "IIT" else label
            current["year"] = citation.group(2)
        answer = answer_key.get((current["section"].upper(), current["question_number"]), "")
        if answer in {"1", "2", "3", "4"} and [option["label"] for option in current["options"]] == ["A", "B", "C", "D"]:
            answer = "ABCD"[int(answer) - 1]
        current["answer"] = answer
        warnings.append("Difficulty is not inferred; choose a level during review.")
        current["reviewRequired"] = bool(warnings) or not current["options"]
        current["difficultyMissing"] = True
        current["difficultyEstimated"] = False
        current["level"] = "Medium"
        current["id"] = f"pdf-{len(questions) + 1:04d}"
        questions.append(current)
        current = None
        current_option = None

    for page_lines in pages:
        for line in page_lines:
            text = clean_pdf_text(line["text"])
            if not text:
                continue
            if ANSWER_HEADING.search(text):
                finish()
                # Key material is never appended to question content.
                break
            section_match = re.match(r"^EXERCISE\s*#?\s*(.+)$", text, re.I)
            if section_match:
                finish()
                section = normalized(section_match.group(1))
                continue
            if SOURCE_MARKER.match(text):
                continue

            start = QUESTION_START.match(text)
            if start:
                finish()
                number = int(start.group(1))
                current = {
                    "id": "", "section": section, "question_number": number,
                    "question_text": "", "text": "", "questionHtml": "",
                    "options": [], "question_type": "mcq", "type": "",
                    "answer_key": None, "answer": "", "assets": [],
                    "source_page": line["page"], "sourcePages": [line["page"]],
                    "source_bbox": [line["x0"], line["y0"], line["x1"], line["y1"]],
                    "source_bboxes": [{"page": line["page"], "bbox": [line["x0"], line["y0"], line["x1"], line["y1"]]}],
                    "exam": exam, "subject": subject, "chapter": chapter,
                    "name": chapter, "marks": "", "paper": section,
                    "year": "", "sourceUrl": filename, "imageUrls": [],
                    "extractionWarnings": [], "reviewRequired": False,
                    "difficultyMissing": True, "difficultyEstimated": False,
                    "level": "Medium",
                }
                include_source_bbox(line)
                content, inline = split_inline_options(start.group(2))
                if content:
                    append_content(content)
                if inline:
                    current["options"].extend(inline)
                    current_option = len(current["options"]) - 1
                continue

            if not current:
                continue
            if line["page"] not in current["sourcePages"]:
                current["sourcePages"].append(line["page"])
            include_source_bbox(line)

            # A row can contain all four choices side by side, so split it
            # before treating its first label as a single-option line.
            content, inline = split_inline_options(text)
            if len(inline) >= 2:
                if content:
                    append_content(content)
                current["options"].extend(inline)
                current_option = len(current["options"]) - 1
                continue

            option_match = LETTER_OPTION.match(text)
            number_match = NUMBER_OPTION.match(text)
            if option_match or number_match:
                match = option_match or number_match
                label = (match.group(1) or match.group(2)).upper() if option_match else number_match.group(1)
                current["options"].append({"label": label, "text": clean_pdf_text(match.group(3) if option_match else number_match.group(2))})
                current_option = len(current["options"]) - 1
                continue

            append_content(text)
        else:
            continue
        # Encountered the answer key: later pages are not question content.
        break

    finish()
    for index, question in enumerate(questions, 1):
        question["id"] = f"{slug(chapter)}-{index:04d}"
        question["question_text"] = question["text"]
        question["question_type"] = "mcq" if question["options"] else "short_answer"
        question["answer_key"] = question["answer"] or None
        question["assets"] = [{"type": "source-page-preview", "page": page} for page in question["sourcePages"]]
        for option in question["options"]:
            option["html"] = html.escape(option["text"], quote=False)
    return questions, page_images


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "chapter"


def formula_ocr_fallback_reason() -> str:
    if _pix2text_error:
        return f"Pix2Text unavailable ({_pix2text_error})"
    return "Pix2Text is unavailable or not installed"


@app.get("/health")
def health() -> dict[str, str]:
    if _pix2text_engine is not None:
        formula_ocr = "ready"
    elif _pix2text_error:
        formula_ocr = f"unavailable: {_pix2text_error}"
    else:
        formula_ocr = "not initialized yet"
    return {"status": "ok", "service": "PaperCraft extraction", "formulaOcr": formula_ocr}


@app.post("/api/extract")
async def extract(
    file: UploadFile = File(...),
    exam: str = Form("JEE Main"),
    subject: str = Form("Physics"),
    chapter: str = Form("Unsorted questions"),
) -> dict[str, Any]:
    filename = os.path.basename(file.filename or "upload")
    extension = os.path.splitext(filename)[1].lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Upload a PDF or a supported image file.")
    payload = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="The upload exceeds the 25 MB limit.")
    if not payload:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    page_lines: list[list[dict[str, Any]]] = []
    pages_for_review: list[dict[str, Any]] = []
    page_warnings: list[str] = []

    if extension == ".pdf":
        try:
            document = fitz.open(stream=payload, filetype="pdf")
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Could not read this PDF. Check that it is not password-protected or damaged.") from exc
        if document.page_count > MAX_PDF_PAGES:
            raise HTTPException(status_code=413, detail=f"The PDF has {document.page_count} pages; the limit is {MAX_PDF_PAGES}.")
        if document.is_encrypted:
            raise HTTPException(status_code=400, detail="Password-protected PDFs are not supported.")
        for index, page in enumerate(document, 1):
            lines, usable_chars = pdf_page_lines(page, index)
            extracted_text = " ".join(line["text"] for line in lines)
            # Preserve a readable PDF's own layout and use formula OCR only
            # to repair lines whose embedded font mapping is visibly broken.
            damaged_pattern = re.compile(r"\(cid:\d+\)|[�\ufffd]|(?:¾{2,})", re.I)
            damaged_lines = [line for line in lines if damaged_pattern.search(line["text"])]
            if usable_chars < 25 or damaged_lines:
                scale = 2.2
                pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
                image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
                math_lines = formula_ocr_lines(image, index)
                if math_lines and usable_chars < 25:
                    # Keep Tesseract's text rows so formula OCR omissions do not
                    # silently drop separate reactions or option rows.
                    text_lines = image_ocr_lines(image, index)
                    lines = merge_formula_and_text_ocr(text_lines, math_lines) if text_lines else math_lines
                    page_warnings.append(f"Page {index}: formula-aware OCR was merged with local text OCR; check every reaction row and symbol against the page image.")
                elif math_lines and damaged_lines:
                    lines, repaired_count = repair_damaged_pdf_lines(
                        lines, math_lines,
                        scale_x=pix.width / page.rect.width,
                        scale_y=pix.height / page.rect.height,
                    )
                    page_warnings.append(
                        f"Page {index}: formula OCR repaired {repaired_count} damaged text line(s); "
                        "check equations and choices against the page image."
                    )
                else:
                    ocr_lines = image_ocr_lines(image, index)
                    if usable_chars < 25 and ocr_lines:
                        lines = ocr_lines
                        page_warnings.append(f"Page {index}: {formula_ocr_fallback_reason()}; Tesseract OCR was used. Formula notation may need manual correction.")
                    elif damaged_lines and ocr_lines:
                        lines, repaired_count = repair_damaged_pdf_lines(
                            lines, ocr_lines,
                            scale_x=pix.width / page.rect.width,
                            scale_y=pix.height / page.rect.height,
                        )
                        page_warnings.append(
                            f"Page {index}: {formula_ocr_fallback_reason()}; {repaired_count} damaged text line(s) were retried with Tesseract. "
                            "Check formulas and reaction arrows against the page image."
                        )
                    elif usable_chars < 25:
                        page_warnings.append(f"Page {index}: OCR did not return readable text.")
            page_lines.append(lines)
            pages_for_review.append({"page": index, "dataUrl": render_pdf_page(page)})
        document.close()
    else:
        try:
            image = Image.open(io.BytesIO(payload)).convert("RGB")
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Could not read this image.") from exc
        lines = formula_ocr_lines(image, 1)
        if lines:
            text_lines = image_ocr_lines(image, 1)
            if text_lines:
                lines = merge_formula_and_text_ocr(text_lines, lines)
        if not lines:
            lines = image_ocr_lines(image, 1)
            page_warnings.append(f"{formula_ocr_fallback_reason()}; Tesseract was used. Check equations against the source image.")
        else:
            page_warnings.append("Local formula-aware OCR was used. Check equations and choices against the source image.")
        page_lines = [lines]
        pages_for_review = [{"page": 1, "dataUrl": image_data_url(image)}]

    cleaned_pages = strip_repeating_margins(page_lines)
    answer_key = extract_answer_key(page_lines)
    questions, _ = parse_questions(
        cleaned_pages, exam=exam.strip() or "JEE Main", subject=subject.strip() or "Physics",
        chapter=chapter.strip() or "Unsorted questions", filename=filename,
        answer_key=answer_key,
    )
    if not questions:
        raise HTTPException(
            status_code=422,
            detail="No numbered questions were recognized. This PDF may need a different layout rule or OCR cleanup.",
        )
    for question in questions:
        if any("ocr" in line for page in cleaned_pages for line in page if line["page"] in question["sourcePages"]):
            question["extractionWarnings"].append("OCR was used; compare wording and symbols with the source image.")
            question["reviewRequired"] = True
        if question["difficultyMissing"]:
            question["extractionWarnings"].append("Difficulty is not inferred; choose a level during review.")
    return {
        "sourceFile": filename,
        "questions": questions,
        "pages": pages_for_review,
        "mathSvgDefinitions": [],
        "questionCount": len(questions),
        "needsReviewCount": sum(question["reviewRequired"] for question in questions),
        "pageWarnings": page_warnings,
    }
