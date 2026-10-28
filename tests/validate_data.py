#!/usr/bin/env python3
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
TOOLS_PATH = ROOT / 'data' / 'tools.json'
NEWS_PATH = ROOT / 'data' / 'news.json'
HTML_PAGES = [
    ROOT / 'index.html',
    ROOT / 'tools.html',
    ROOT / 'tool.html',
    ROOT / 'comparison.html',
    ROOT / 'news.html',
]
REQUIRED_TOOL_FIELDS = {
    'id', 'name', 'developer', 'category', 'description', 'website', 'pricing_url',
    'pricing_summary', 'pricing_currency', 'pricing_period', 'last_verified',
    'verification_status', 'features', 'limitations', 'use_cases', 'source_urls'
}
REQUIRED_NEWS_FIELDS = {'title', 'date', 'tag', 'summary', 'source_url'}
VALID_STATUSES = {'verified', 'partial', 'unverified'}


def load_json(path: Path):
    with path.open('r', encoding='utf-8') as handle:
        return json.load(handle)


def assert_http_url(raw_url: str, label: str):
    if not isinstance(raw_url, str) or not raw_url:
        raise AssertionError(f'{label} is missing or not a string')
    parsed = urlparse(raw_url)
    if parsed.scheme not in {'http', 'https'} or not parsed.netloc:
        raise AssertionError(f'{label} is not a valid HTTP(S) URL: {raw_url}')


def assert_iso_date(raw_value: str, label: str):
    if not isinstance(raw_value, str) or not raw_value:
        raise AssertionError(f'{label} must be a non-empty ISO date string')
    try:
        datetime.strptime(raw_value, '%Y-%m-%d')
    except ValueError as exc:
        raise AssertionError(f'{label} is not a valid YYYY-MM-DD date: {raw_value}') from exc


def validate_tools(data):
    tools = data.get('tools')
    if not isinstance(tools, list):
        raise AssertionError('Tools dataset must be a list under "tools"')
    if len(tools) < 10:
        raise AssertionError(f'Expected at least 10 tools; found {len(tools)}')

    seen_ids = set()
    for index, tool in enumerate(tools, start=1):
        if not isinstance(tool, dict):
            raise AssertionError(f'Tool #{index} is not an object')

        missing = sorted(REQUIRED_TOOL_FIELDS - set(tool.keys()))
        if missing:
            raise AssertionError(f'Tool #{index} missing required fields: {missing}')

        tool_id = tool.get('id')
        if not isinstance(tool_id, str) or not tool_id.strip():
            raise AssertionError(f'Tool #{index} id must be a non-empty string')
        if tool_id in seen_ids:
            raise AssertionError(f'Duplicate tool id found: {tool_id}')
        seen_ids.add(tool_id)

        if tool['verification_status'] not in VALID_STATUSES:
            raise AssertionError(f'Tool #{index} has invalid verification_status: {tool["verification_status"]}')

        assert_http_url(tool['website'], f'Tool #{index} website')
        assert_http_url(tool['pricing_url'], f'Tool #{index} pricing_url')
        assert_iso_date(tool['last_verified'], f'Tool #{index} last_verified')

        for key in ('features', 'limitations', 'use_cases'):
            values = tool.get(key)
            if not isinstance(values, list) or not values or any(not isinstance(item, str) or not item.strip() for item in values):
                raise AssertionError(f'Tool #{index} field "{key}" must be a non-empty list of strings')

        sources = tool.get('source_urls')
        if not isinstance(sources, list) or not sources:
            raise AssertionError(f'Tool #{index} source_urls must be a non-empty list')
        if len(sources) != len(set(sources)):
            raise AssertionError(f'Tool #{index} source_urls contains duplicates')
        for url in sources:
            assert_http_url(url, f'Tool #{index} source URL')

        if not isinstance(tool.get('pricing_summary'), str) or not tool['pricing_summary'].strip():
            raise AssertionError(f'Tool #{index} pricing_summary must be a non-empty string')
        if not isinstance(tool.get('description'), str) or not tool['description'].strip():
            raise AssertionError(f'Tool #{index} description must be a non-empty string')

        if not isinstance(tool.get('developer'), str) or not tool['developer'].strip():
            raise AssertionError(f'Tool #{index} developer must be a non-empty string')

        if tool['verification_status'] == 'verified' and not tool.get('source_urls'):
            raise AssertionError(f'Tool #{index} marked verified but has no source URLs')


def validate_news(data):
    news = data.get('news', [])
    if news is None:
        raise AssertionError('News key is present but null; expected list or empty list')
    if not isinstance(news, list):
        raise AssertionError('News dataset must be a list under "news"')

    for index, item in enumerate(news, start=1):
        if not isinstance(item, dict):
            raise AssertionError(f'News item #{index} is not an object')
        missing = sorted(REQUIRED_NEWS_FIELDS - set(item.keys()))
        if missing:
            raise AssertionError(f'News item #{index} missing required fields: {missing}')
        assert_http_url(item['source_url'], f'News item #{index} source_url')
        assert_iso_date(item['date'], f'News item #{index} date')

    empty_message = data.get('empty_message')
    if empty_message is not None and not isinstance(empty_message, str):
        raise AssertionError('empty_message must be a string when present')


def validate_html_pages():
    for page in HTML_PAGES:
        text = page.read_text(encoding='utf-8')
        if 'assets/styles.css' not in text or 'assets/app.js' not in text:
            raise AssertionError(f'{page.name} is missing required static asset references')
        if 'rel="canonical"' not in text:
            raise AssertionError(f'{page.name} is missing a canonical URL tag')

        refs = re.findall(r'''(?:href|src)=["']([^"']+)["']''', text)
        for ref in refs:
            if ref.startswith(('http://', 'https://', 'mailto:', 'tel:', '#', 'javascript:')):
                continue
            candidate = (page.parent / ref.lstrip('/')).resolve()
            if not candidate.exists() and not candidate.is_dir():
                raise AssertionError(f'{page.name} references missing file: {ref}')


def validate_site_files():
    robots_path = ROOT / 'robots.txt'
    sitemap_path = ROOT / 'sitemap.xml'
    if not robots_path.exists() or not sitemap_path.exists():
        raise AssertionError('robots.txt and sitemap.xml are required for deployment metadata')

    sitemap = sitemap_path.read_text(encoding='utf-8')
    if 'https://skhm9.github.io/ai-compass/' not in sitemap:
        raise AssertionError('sitemap.xml should include the canonical GitHub Pages URL')

    robots = robots_path.read_text(encoding='utf-8')
    if 'Sitemap:' not in robots:
        raise AssertionError('robots.txt is missing the sitemap directive')


def main():
    try:
        tools_data = load_json(TOOLS_PATH)
        news_data = load_json(NEWS_PATH)
        validate_tools(tools_data)
        validate_news(news_data)
        validate_html_pages()
        validate_site_files()
        print(f'Validation passed: {len(tools_data["tools"])} tools and {len(news_data.get("news", []))} news items checked.')
        print('Static page references and site metadata validated.')
        return 0
    except Exception as exc:  # pragma: no cover - test script should fail loudly
        print(f'Validation failed: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
