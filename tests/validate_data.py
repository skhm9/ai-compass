#!/usr/bin/env python3
import json
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
TOOLS_PATH = ROOT / 'data' / 'tools.json'
NEWS_PATH = ROOT / 'data' / 'news.json'

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


def validate_tools(data):
    tools = data.get('tools')
    if not isinstance(tools, list):
        raise AssertionError('Tools dataset must be a list under "tools"')
    if len(tools) < 10:
        raise AssertionError(f'Expected at least 10 tools; found {len(tools)}')

    for index, tool in enumerate(tools, start=1):
        missing = sorted(REQUIRED_TOOL_FIELDS - set(tool.keys()))
        if missing:
            raise AssertionError(f'Tool #{index} missing required fields: {missing}')

        if tool['verification_status'] not in VALID_STATUSES:
            raise AssertionError(f'Tool #{index} has invalid verification_status: {tool["verification_status"]}')

        assert_http_url(tool['website'], f'Tool #{index} website')
        assert_http_url(tool['pricing_url'], f'Tool #{index} pricing_url')

        for key in ('features', 'limitations', 'use_cases'):
            if not isinstance(tool.get(key), list) or not tool[key]:
                raise AssertionError(f'Tool #{index} field "{key}" must be a non-empty list')

        sources = tool.get('source_urls')
        if not isinstance(sources, list) or not sources:
            raise AssertionError(f'Tool #{index} source_urls must be a non-empty list')
        for url in sources:
            assert_http_url(url, f'Tool #{index} source URL')

        if not isinstance(tool.get('pricing_summary'), str) or not tool['pricing_summary'].strip():
            raise AssertionError(f'Tool #{index} pricing_summary must be a non-empty string')

        if not isinstance(tool.get('description'), str) or not tool['description'].strip():
            raise AssertionError(f'Tool #{index} description must be a non-empty string')


def validate_news(data):
    news = data.get('news', [])
    if news is None:
        raise AssertionError('News key is present but null; expected list or empty list')
    if not isinstance(news, list):
        raise AssertionError('News dataset must be a list under "news"')

    for index, item in enumerate(news, start=1):
        missing = sorted(REQUIRED_NEWS_FIELDS - set(item.keys()))
        if missing:
            raise AssertionError(f'News item #{index} missing required fields: {missing}')
        assert_http_url(item['source_url'], f'News item #{index} source_url')


def main():
    try:
        tools_data = load_json(TOOLS_PATH)
        news_data = load_json(NEWS_PATH)
        validate_tools(tools_data)
        validate_news(news_data)
        print(f'Validation passed: {len(tools_data["tools"])} tools and {len(news_data.get("news", []))} news items checked.')
        return 0
    except Exception as exc:  # pragma: no cover - test script should fail loudly
        print(f'Validation failed: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
