# AI Compass

AI Compass is a lightweight static discovery platform for comparing AI tools with a verified-data foundation and no paid API dependency.

## Verified data foundation

This project now treats tool and pricing data as a source-backed dataset rather than a marketing dump. The site intentionally keeps all data in static JSON files and avoids unverified claims.

## Project structure

- `index.html` — homepage
- `tools.html` — tool directory
- `comparison.html` — comparison page
- `news.html` — curated news page
- `tool.html` — individual tool detail page
- `assets/styles.css` — shared styling
- `assets/app.js` — data fetching and rendering logic
- `data/tools.json` — verified, partial, and unverified tool catalog data
- `data/news.json` — empty or source-backed news dataset only
- `tests/validate_data.py` — JSON and field validation checks

## Local preview

Run a simple local web server from the repository root:

```bash
python3 -m http.server 8000
```

Then open:

- http://localhost:8000/

## GitHub Pages

This project is designed for GitHub Pages with no build step.

1. Push the repository to GitHub.
2. In the repository settings, enable GitHub Pages.
3. Set the source to the default branch (for example `main`).
4. The site will be available at:
   `https://skhm9.github.io/ai-compass/`

## Data validation tests

Run the validation script from the repository root:

```bash
python3 tests/validate_data.py
```

This validates JSON syntax, required fields, minimum tool count, and URL structure. It does not validate the external truth of the tool claims themselves.

## Notes

- Pricing and feature summaries are intentionally conservative.
- A URL alone is not treated as proof of correctness; claims must match the referenced source.
- If data is not verifiable, the UI shows the relevant status instead of making a definitive claim.
