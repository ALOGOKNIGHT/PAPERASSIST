# PaperCraft PDF and image question import

PaperCraft remains a static HTML/CSS/JavaScript app. PDF processing runs in a separate, optional Python service on the educator's computer; uploaded files are read in memory and are not written to disk by the service.

## Local setup on Windows

1. Open PowerShell in the project folder and create a virtual environment:

   ```powershell
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r server\requirements.txt
   ```

2. Install the open-source Tesseract OCR application as a fallback for scanned pages. `pytesseract` is only the Python wrapper; it does not install the Tesseract executable. The Tesseract project points Windows users to the [UB Mannheim Windows installer](https://github.com/UB-Mannheim/tesseract/wiki). If Tesseract is not on `PATH`, set the actual executable path for this PowerShell session (adjust the path if you chose another installation folder):

   ```powershell
   $env:TESSERACT_CMD = 'C:\Program Files\Tesseract-OCR\tesseract.exe'
   ```

   Confirm that the path exists before starting the service:

   ```powershell
   Test-Path $env:TESSERACT_CMD
   ```

3. For local formula-aware OCR, install the optional Pix2Text package in the same virtual environment:

   ```powershell
   python -m pip install -r server\requirements-math-ocr.txt
   ```

   Pix2Text downloads its open-source model weights the first time it is used. After that first download, it performs OCR locally; uploaded pages are not sent to an OCR API. This option is especially useful for mixed text and mathematical notation, but still needs review for chemistry reactions and small print.

4. Start the extraction API in one PowerShell window:

   ```powershell
   python -m uvicorn app:app --app-dir server --host 127.0.0.1 --port 8001
   ```

   Confirm `http://127.0.0.1:8001/health` returns `{"status":"ok",...}`.

5. Start PaperCraft in a second PowerShell window from the project root:

   ```powershell
   py -m http.server 8000
   ```

   Open `http://localhost:8000`, sign in, open a coaching paper's **Add questions** step, and choose **Import from PDF or image**.

## What it does

- Accepts one PDF or image per extraction, up to 25 MB and 40 PDF pages.
- Uses PyMuPDF text and page coordinates first. Pages with little selectable text or damaged font glyphs use local Pix2Text when installed, with Tesseract as a fallback.
- Recognizes numbered questions and common A-D or (1)-(4) option labels, keeps section names and source pages, and attempts to match common printed answer-key rows.
- Shows each extracted item next to its original source page. Question wording, options, section/source, difficulty, and answer can be edited before import.
- Downloads a review JSON with page previews. Selecting **Add selected to paper** also adds questions to the current paper and keeps them in this browser's local storage.

## Limits and deployment

The extractor does not solve questions or infer difficulty. Difficulty starts as Medium with a review flag. Local formula OCR can still misread chemistry reactions, subscripts, or small print; review every extracted choice against the source page. Math is returned as LaTeX where recognized, and the preview uses MathJax to typeset it. Automatic diagram cropping is not included. The downloaded JSON includes each page preview once under `pages` with question-level `assets` references.

This local service is not a public production endpoint. A deployed website cannot call `127.0.0.1` on a teacher's device, and browsers block mixed-content calls from an HTTPS site to HTTP. For hosted use, deploy the API on an HTTPS Python host, configure authentication and per-user quotas, restrict CORS to the PaperCraft domain, and set request/body limits at the proxy as well as in FastAPI. Do not put credentials or service-role keys in browser code.
