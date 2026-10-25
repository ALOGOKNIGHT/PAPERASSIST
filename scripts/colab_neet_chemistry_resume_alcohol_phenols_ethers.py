# Run this file in Google Colab after installing Crawl4AI.
# It writes one resumable JSON file per NEET Chemistry chapter to Google Drive.

from google.colab import drive
drive.mount("/content/drive")

import asyncio
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse

import nest_asyncio
from bs4 import BeautifulSoup
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode


INDEX_URL = "https://questions.examside.com/past-years/medical/neet/chemistry"
OUTPUT_DIR = Path("/content/drive/MyDrive/PaperCraft/NEET_Chemistry")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Resume at Alcohol, Phenols and Ethers, then question-page link 8.
START_CHAPTER_SLUG = "alcohol-phenols-and-ethers"
START_QUESTION_PAGE = 8


def clean_html(value):
    """Remove Crawl4AI's boundary markers while retaining MathJax/SVG markup."""
    value = value or ""
    value = re.sub(r"HTML_TAG_START\s*", "", value)
    value = re.sub(r"\s*HTML_TAG_END", "", value)
    return value.strip()


def normalize_text(value):
    return re.sub(r"\s+", " ", value or "").strip().casefold()


def answer_from_explanation(text):
    """Return an explicit option/numerical answer; never guess an answer."""
    text = text or ""
    option_patterns = [
        r"(?:correct option|correct answer|correct options)\s*(?:is|are|:|=)?\s*(?:option\s*)?[\[(]?\s*([A-D1-4])\b",
        r"\boption\s*([A-D1-4])\s*(?:is\s*)?(?:correct|the answer)\b",
        r"\banswer\s*:\s*(?:option\s*)?([A-D1-4])\b",
    ]
    for pattern in option_patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return match.group(1).upper()

    numeric_patterns = [
        r"(?:correct numerical answer|correct answer|final answer|answer)\s*(?:is|:|=)\s*([+-]?\d+(?:\.\d+)?(?:\s*[×x]\s*10\s*(?:\^|\*\*)?\s*[+-]?\d+)?)\b",
    ]
    for pattern in numeric_patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return re.sub(r"\s+", "", match.group(1))
    return ""


def estimate_difficulty(text):
    """A rough chemistry-text heuristic; every returned label is estimated."""
    value = (text or "").casefold()
    if any(term in value for term in (
        "reaction mechanism", "stereochemistry", "coordination compound",
        "electrochemical cell", "match the following",
    )) or (("equilibrium" in value or "mechanism" in value) and len(value) > 260):
        return "hard", "Estimated from chemistry topic and question length"
    if len(value) < 150 and not any(term in value for term in (
        "calculate", "equilibrium", "oxidation state", "hybridisation",
    )):
        return "easy", "Estimated from short, direct wording"
    return "medium", "Estimated; review recommended"


def parse_question_cards(html, page_url, chapter_name, chapter_slug):
    soup = BeautifulSoup(html or "", "html.parser")
    records = {}
    definitions = {str(node) for node in soup.select("svg defs")}

    for card in soup.select("div.question-component"):
        stem = card.select_one(".question.q-prose")
        if not stem:
            continue

        question_text = stem.get_text(" ", strip=True)
        question_html = clean_html("".join(str(child) for child in stem.contents))
        if not question_text and not question_html:
            continue

        # MathJax glyph codes distinguish questions whose formulas do not
        # survive as ordinary text.
        math_signature = " ".join(
            node.get("data-c", "")
            for node in stem.select("[data-c]")
            if node.get("data-c")
        )
        fingerprint = hashlib.sha256((normalize_text(question_text) + "|" + math_signature).encode("utf-8")).hexdigest()
        question_id = f"neet-chemistry-{chapter_slug}-{fingerprint[:16]}"

        result_box = card.select_one(".when-answered.q-result")
        if result_box is None:
            result_box = card.select_one(".q-result")
        explanation = (
            result_box.select_one(".question.q-prose")
            if result_box else None
        )
        if explanation is None:
            explanation = result_box

        explanation_text = explanation.get_text(" ", strip=True) if explanation else ""
        explanation_html = (
            clean_html("".join(str(child) for child in explanation.contents))
            if explanation else ""
        )

        options = []
        for option in card.select(".options .option"):
            label = option.select_one(".option-badge")
            content = option.select_one(".option-content")
            options.append({
                "label": label.get_text(" ", strip=True) if label else "",
                "html": clean_html(
                    "".join(str(child) for child in content.contents)
                ) if content else "",
                "text": content.get_text(" ", strip=True) if content else "",
            })

        card_text = card.get_text(" ", strip=True)
        if "MCQ (Multiple Correct Answer)" in card_text:
            question_type = "MCQ (Multiple Correct Answer)"
        elif "MCQ (Single Correct Answer)" in card_text:
            question_type = "MCQ (Single Correct Answer)"
        elif "Numerical" in card_text or not options:
            question_type = "Numerical"
        else:
            question_type = "Question"

        year_match = re.search(r"(?:(?:RE-)?NEET|AIPMT)\s+(20\d{2})", card_text, re.I)
        paper_match = re.search(
            r"((?:RE-)?NEET|AIPMT)\s+(20\d{2})(?:\s+\((?:Re-Examination|Phase\s*\d+)\))?",
            card_text,
            flags=re.IGNORECASE,
        )
        mark_match = re.search(r"\+(\d+)\s*[−-]\s*(\d+)", card_text)

        images = []
        for img in card.select("img"):
            src = img.get("src") or img.get("data-src")
            if src:
                images.append({
                    "url": urljoin(page_url, src),
                    "alt": img.get("alt", ""),
                })

        difficulty, difficulty_reason = estimate_difficulty(question_text)
        answer = answer_from_explanation(explanation_text)

        records[question_id] = {
            "id": question_id,
            "sourceUrl": page_url,
            "sourceUrls": [page_url],
            "exam": "NEET",
            "subject": "Chemistry",
            "chapter": chapter_name,
            "paper": paper_match.group(0) if paper_match else "NEET PYQ",
            "year": int(year_match.group(1)) if year_match else None,
            "type": question_type,
            "marks": ({
                "positive": int(mark_match.group(1)),
                "negative": int(mark_match.group(2)),
            } if mark_match else None),
            "questionHtml": question_html,
            "questionText": question_text,
            "options": options,
            # Always present. Empty string means no explicit answer was found.
            "answer": answer,
            "answerStatus": "found_in_explanation" if answer else "not_found",
            "explanationHtml": explanation_html,
            "explanationText": explanation_text,
            "images": images,
            "imageUrls": [image["url"] for image in images],
            "difficulty": difficulty,
            "difficultyReason": difficulty_reason,
            "difficultyIsEstimated": True,
        }

    return records, definitions


def save_checkpoint(path, chapter_url, processed, questions, definitions, failures):
    path.write_text(json.dumps({
        "chapterUrl": chapter_url,
        "processedUrls": sorted(processed),
        "questions": questions,
        "mathSvgDefinitions": sorted(definitions),
        "failures": failures,
    }, ensure_ascii=False), encoding="utf-8")


async def export_all_chapters():
    config = CrawlerRunConfig(cache_mode=CacheMode.ENABLED)

    async with AsyncWebCrawler() as crawler:
        index_result = await crawler.arun(INDEX_URL, config=config)
        if not index_result.success:
            raise RuntimeError("Could not load the NEET Chemistry index.")

        index_soup = BeautifulSoup(index_result.html or "", "html.parser")
        chapters = {}
        for link in index_soup.select("a[href]"):
            url = urljoin(INDEX_URL, link["href"])
            parsed = urlparse(url)
            parts = parsed.path.strip("/").split("/")
            if (
                parsed.netloc == "questions.examside.com"
                and len(parts) == 5
                and parts[:4] == ["past-years", "medical", "neet", "chemistry"]
            ):
                slug = parts[4]
                name = link.get_text(" ", strip=True)
                name = re.sub(r"\s+(?:Syllabus reduced\s+)?2026\b.*$", "", name).strip()
                name = re.sub(r"\s+Out of syllabus.*$", "", name, flags=re.I).strip()
                chapters[slug] = {"name": name or slug.replace("-", " ").title(), "url": url}

        print(f"Discovered {len(chapters)} chapter links.")

        chapter_items = list(chapters.items())
        start_index = next(
            (i for i, (slug, _) in enumerate(chapter_items) if slug == START_CHAPTER_SLUG),
            None,
        )
        if start_index is None:
            raise RuntimeError(
                f"Could not find chapter slug '{START_CHAPTER_SLUG}' in the NEET Chemistry index."
            )

        print(
            f"Resuming at chapter link {start_index + 1}/{len(chapter_items)}: "
            f"{chapter_items[start_index][1]['name']}"
        )

        for chapter_number, (slug, chapter) in enumerate(
            chapter_items[start_index:], start=start_index + 1
        ):
            final_path = OUTPUT_DIR / f"neet-chemistry-{slug}.json"
            checkpoint_path = OUTPUT_DIR / f"neet-chemistry-{slug}.checkpoint.json"

            if checkpoint_path.exists():
                try:
                    state = json.loads(checkpoint_path.read_text(encoding="utf-8"))
                except Exception:
                    state = {}
            else:
                state = {}

            # Keep existing final-file questions if a checkpoint is absent or older.
            # This avoids overwriting data while still allowing missing pages to be fetched.
            old_output = {}
            if final_path.exists():
                try:
                    old_output = json.loads(final_path.read_text(encoding="utf-8"))
                except Exception:
                    old_output = {}

            questions = {
                q.get("id"): q
                for q in old_output.get("questions", [])
                if isinstance(q, dict) and q.get("id")
            }
            questions.update(state.get("questions", {}))

            processed = set(state.get("processedUrls", []))
            # The final JSON has source URLs per question, which lets us recover progress
            # even when the checkpoint was not written before the interruption.
            for question in questions.values():
                processed.update(question.get("sourceUrls", []))
                if question.get("sourceUrl"):
                    processed.add(question["sourceUrl"])

            definitions = set(old_output.get("mathSvgDefinitions", []))
            definitions.update(state.get("mathSvgDefinitions", []))
            failures = list(dict.fromkeys(
                old_output.get("failedPages", []) + state.get("failures", [])
            ))

            listing = await crawler.arun(chapter["url"], config=config)
            if not listing.success:
                print(f"Could not load listing for {chapter['name']}")
                continue

            listing_soup = BeautifulSoup(listing.html or "", "html.parser")
            question_urls = []
            for link in listing_soup.select("a[href]"):
                url = urljoin(chapter["url"], link["href"])
                parsed = urlparse(url)
                if (
                    parsed.netloc == "questions.examside.com"
                    and "/past-years/medical/question/" in parsed.path
                ):
                    question_urls.append(url)
            question_urls = list(dict.fromkeys(question_urls))

            if not question_urls:
                print(
                    f"[{chapter_number}/{len(chapters)}] WARNING: No question-page URLs "
                    f"were found for {chapter['name']}; leaving its files unchanged."
                )
                continue

            first_question_page = (
                START_QUESTION_PAGE if slug == START_CHAPTER_SLUG else 1
            )
            if first_question_page > len(question_urls):
                print(
                    f"  Only {len(question_urls)} question-page URLs found; "
                    f"nothing to process from page {first_question_page}."
                )
                continue

            print(
                f"[{chapter_number}/{len(chapters)}] {chapter['name']}: "
                f"{len(question_urls)} question-page URLs; starting at {first_question_page}; "
                f"already present in checkpoint/output: "
                f"{sum(url in processed for url in question_urls[first_question_page - 1:])}/"
                f"{len(question_urls[first_question_page - 1:])}"
            )

            for page_number, page_url in enumerate(question_urls, start=1):
                if page_number < first_question_page:
                    continue
                if page_url in processed:
                    continue
                try:
                    result = await crawler.arun(page_url, config=config)
                    if not result.success:
                        failures.append(page_url)
                        continue

                    found, page_definitions = parse_question_cards(
                        result.html, page_url, chapter["name"], slug
                    )
                    definitions.update(page_definitions)

                    for qid, question in found.items():
                        if qid not in questions:
                            questions[qid] = question
                        else:
                            old = questions[qid]
                            if page_url not in old["sourceUrls"]:
                                old["sourceUrls"].append(page_url)
                            if len(question["explanationText"]) > len(old["explanationText"]):
                                old["explanationText"] = question["explanationText"]
                                old["explanationHtml"] = question["explanationHtml"]
                            if question["answer"] and not old["answer"]:
                                old["answer"] = question["answer"]
                                old["answerStatus"] = question["answerStatus"]

                    processed.add(page_url)
                    if page_number % 5 == 0 or page_number == len(question_urls):
                        save_checkpoint(
                            checkpoint_path, chapter["url"], processed,
                            questions, definitions, failures
                        )
                        answer_count = sum(bool(q["answer"]) for q in questions.values())
                        explanation_count = sum(bool(q["explanationText"]) for q in questions.values())
                        print(
                            f"  {page_number}/{len(question_urls)} pages; "
                            f"{len(questions)} questions; {explanation_count} explanations; "
                            f"{answer_count} answers"
                        )

                    await asyncio.sleep(0.6)

                except Exception as exc:
                    failures.append(f"{page_url} | {exc}")
                    save_checkpoint(
                        checkpoint_path, chapter["url"], processed,
                        questions, definitions, failures
                    )

            requested_urls = question_urls[first_question_page - 1:]
            complete = bool(requested_urls) and all(
                page_url in processed for page_url in requested_urls
            )
            output = {
                "exam": "NEET",
                "subject": "Chemistry",
                "chapter": chapter["name"],
                "sourceChapterUrl": chapter["url"],
                "status": "complete" if complete else "incomplete",
                "startedAtQuestionPage": first_question_page,
                "pagesBeforeResumeExcluded": first_question_page - 1,
                "count": len(questions),
                "mathSvgDefinitions": sorted(definitions),
                "questions": list(questions.values()),
                "failedPageCount": len(failures),
            }
            final_path.write_text(
                json.dumps(output, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            print(f"  Saved {final_path.name}: {len(questions)} questions ({output['status']})")

    print(f"\nFinished this run. Files are in {OUTPUT_DIR}")


nest_asyncio.apply()
asyncio.get_event_loop().run_until_complete(export_all_chapters())


