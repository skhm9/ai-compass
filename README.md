# AI Compass

AI Compass is a lightweight static discovery platform for comparing AI tools without paying for hosting or using a framework.

## Features

- GitHub Pages ready static site
- Responsive homepage and category browsing
- Tool detail pages with strengths, limitations, and source links
- Comparison matrix for up to three tools
- Manual, source-backed news list
- JSON-driven data model for tool and news records
- No paid API dependency

## Project structure

- `index.html` — homepage
- `tools.html` — tools directory
- `comparison.html` — comparison page
- `news.html` — curated AI news page
- `tool.html` — individual tool detail page
- `assets/styles.css` — shared styling
- `assets/app.js` — data fetching and rendering logic
- `data/tools.json` — tool catalog data
- `data/news.json` — curated news feed data

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
3. Set the source to the default branch (for example, `main`).
4. The site will be available at:
   `https://skhm9.github.io/ai-compass/`

## Notes

- Pricing and product details are intentionally conservative and use source-backed wording where verification is necessary.
- The data model is simple and editable for future updates.
