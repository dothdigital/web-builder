#!/usr/bin/env python3
"""Check the deployed public pages using their sitemap, without requiring a browser."""
import concurrent.futures
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from urllib.parse import urlsplit

origin = sys.argv[1].rstrip('/') if len(sys.argv) > 1 else 'https://webtummy.com'
canonical_origin = 'https://webtummy.com'


def fetch(path):
    result = subprocess.run(['curl', '--silent', '--show-error', '--max-time', '30', '-H', 'Host: webtummy.com', '-w', '\n%{http_code}', origin + path], capture_output=True, text=True, check=True)
    body, status = result.stdout.rsplit('\n', 1)
    return int(status), body


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ''
        self.meta = {}
        self.canonicals = []
        self.headings = 0
        self.lang = None
        self.links = []
        self.images = []
        self.jsonld = []
        self.capture = None
        self.schema_text = ''

    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if tag == 'html': self.lang = data.get('lang')
        if tag == 'title': self.capture = 'title'
        if tag == 'h1': self.headings += 1
        if tag == 'meta': self.meta[data.get('name', data.get('property'))] = data.get('content', '')
        if tag == 'link' and data.get('rel') == 'canonical': self.canonicals.append(data.get('href'))
        if tag == 'a': self.links.append(data.get('href', ''))
        if tag == 'img': self.images.append(data)
        if tag == 'script' and data.get('type') == 'application/ld+json':
            self.capture = 'schema'
            self.schema_text = ''

    def handle_data(self, data):
        if self.capture == 'title': self.title += data
        if self.capture == 'schema': self.schema_text += data

    def handle_endtag(self, tag):
        if tag == 'title': self.capture = None
        if tag == 'script' and self.capture == 'schema':
            self.jsonld.append(json.loads(self.schema_text))
            self.capture = None


status, xml = fetch('/sitemap.xml')
assert status == 200, ('sitemap status', status)
urls = [entry.text for entry in ET.fromstring(xml).findall('{*}url/{*}loc')]
assert len(set(urls)) == len(urls), 'Duplicate sitemap URLs'
paths = [urlsplit(url).path or '/' for url in urls]
assert all(url.startswith(canonical_origin + '/') for url in urls)
assert not any(path.split('/')[1] in {'api', 'admin', 'projects', 'preview', 'signup', 'signin', 'dashboard', 'account'} for path in paths)
status, robots = fetch('/robots.txt')
assert status == 200 and 'Sitemap: https://webtummy.com/sitemap.xml' in robots
assert 'Allow: /' in robots and 'Disallow: /api/' in robots


def audit(path):
    status, html = fetch(path)
    assert status == 200, (path, 'status', status)
    page = Page()
    page.feed(html)
    assert page.lang == 'en', (path, 'language')
    assert page.title and page.meta.get('description'), (path, 'missing title or description')
    expected_urls = {canonical_origin + path}
    if path == '/': expected_urls.add(canonical_origin)
    assert len(page.canonicals) == 1 and page.canonicals[0] in expected_urls, (path, 'canonical', page.canonicals)
    assert 'noindex' not in page.meta.get('robots', ''), (path, 'noindex')
    assert 'index' in page.meta.get('robots', ''), (path, 'missing explicit public indexing')
    assert page.headings == 1, (path, 'H1 count', page.headings)
    assert page.meta.get('og:title') == page.title and page.meta.get('og:url') in expected_urls, (path, 'Open Graph')
    assert page.meta.get('og:description') == page.meta['description']
    assert page.meta.get('og:image', '').startswith(canonical_origin + '/og/'), (path, 'social image')
    assert page.meta.get('twitter:card') == 'summary_large_image'
    assert page.jsonld, (path, 'missing structured data')
    for schema in page.jsonld:
        assert not any(key in json.dumps(schema) for key in ['PostalAddress', 'addressLocality', 'addressCountry', 'LocalBusiness', 'latitude', 'longitude']), (path, 'geographic schema')
    assert all('alt' in image for image in page.images), (path, 'missing image alt')
    if path.count('/') == 1 and path in landing_paths:
        assert page.images and all(image.get('alt') for image in page.images), (path, 'landing image')
        assert 'Illustrative example' in html and 'fictional Willow Studio' in html, (path, 'example disclosure')
        assert 'google-consent-default' in html, (path, 'consent bootstrap')
    return {'path': path, 'title': page.title, 'images': len(page.images)}


landing_paths = ['/ai-website-builder', '/website-builder-for-entrepreneurs', '/no-code-website-builder', '/website-builder-for-consultants', '/restaurant-website-builder', '/freelancer-website-builder']
assert all(path in paths for path in landing_paths)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    results = list(pool.map(audit, paths))
assert len({page['title'] for page in results}) == len(results), 'Duplicate public page titles'
for path in ['/signin', '/signup', '/forgot-password']:
    status, html = fetch(path)
    page = Page()
    page.feed(html)
    assert status == 200 and 'noindex' in page.meta.get('robots', ''), (path, 'auth indexing')
for path in ['/not-a-real-webtummy-page', '/support/not-a-real-guide']:
    assert fetch(path)[0] == 404, (path, 'expected real 404')
print(json.dumps({'origin': origin, 'publicPagesPassed': len(results), 'landingPagesPassed': landing_paths, 'checks': ['sitemap', 'robots', 'unique titles', 'descriptions', 'canonicals', 'public indexing', 'one H1', 'Open Graph', 'Twitter cards', 'JSON-LD', 'no geographic schema', 'image alt text', 'auth noindex', '404 responses'], 'pages': results}, indent=2))
