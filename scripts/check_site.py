"""Check a built blog without installing Python packages.

Usage: python scripts/check_site.py [output-directory] [baseurl]
"""

import json
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
from xml.etree import ElementTree


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.h1_count = 0
        self.div_depth = 0
        self.post_content_depth = None
        self.language = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "div":
            self.div_depth += 1
            if attrs.get("id") == "post-content":
                self.post_content_depth = self.div_depth
        if tag == "html":
            self.language = attrs.get("lang")
        # Markdown # headings are supported inside posts; require one page title.
        if tag == "h1" and self.post_content_depth is None:
            self.h1_count += 1
        if tag in {"a", "link", "script", "img"}:
            value = attrs.get("href") if tag in {"a", "link"} else attrs.get("src")
            if value:
                self.links.append(value)

    def handle_endtag(self, tag):
        if tag == "div":
            if self.div_depth == self.post_content_depth:
                self.post_content_depth = None
            self.div_depth -= 1


root = Path(sys.argv[1] if len(sys.argv) > 1 else "_site").resolve()
baseurl = (sys.argv[2] if len(sys.argv) > 2 else "").rstrip("/")
errors = []
pages = list(root.rglob("*.html"))
if not pages:
    raise SystemExit("No built HTML pages found.")

for file in pages:
    source = file.read_text(encoding="utf-8")
    page = Page()
    page.feed(source)
    relative = file.relative_to(root).as_posix()
    if not page.language:
        errors.append(f"{relative}: missing document language")
    if page.h1_count != 1:
        errors.append(f"{relative}: expected one main heading; found {page.h1_count}")
    page_path = "/" + relative
    if page_path.endswith("index.html"):
        page_path = page_path[:-10]
    for link in page.links:
        parsed = urlsplit(link)
        if parsed.scheme or parsed.netloc or link.startswith("#"):
            continue
        path = unquote(urlsplit(urljoin(baseurl + page_path, link)).path)
        if baseurl:
            if path != baseurl and not path.startswith(baseurl + "/"):
                errors.append(f"{relative}: link escapes configured baseurl: {link}")
                continue
            path = path[len(baseurl):]
        target = root / path.lstrip("/")
        if not target.is_file() and not (target / "index.html").is_file():
            errors.append(f"{relative}: missing local link target: {link}")

posts = json.loads((root / "search.json").read_text(encoding="utf-8"))
if not posts:
    errors.append("Search index has no posts")
for post in posts:
    for key in ("title", "url", "date", "categories", "tags", "content"):
        if key not in post:
            errors.append(f"Search index entry missing {key}")
    if not isinstance(post.get("categories"), list) or not isinstance(post.get("tags"), list):
        errors.append("Search categories and tags must be arrays")
    if not post.get("content", "").strip():
        errors.append(f"Search content is empty for {post.get('title')}")
for name in ("feed.xml", "sitemap.xml"):
    ElementTree.parse(root / name)
for name in ("Gemfile", "Gemfile.lock", "README.md", "vendor", "scripts", ".bundle", ".local"):
    if (root / name).exists():
        errors.append(f"Development-only file included in website: {name}")

if errors:
    raise SystemExit("\n".join(errors))
print(f"PASS: {len(pages)} HTML pages, {len(posts)} searchable posts, local links, RSS, sitemap, and source exclusions.")
