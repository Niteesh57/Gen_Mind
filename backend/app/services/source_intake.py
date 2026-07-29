"""Safe, optimized source intake for URLs (Normal & Deep depth 1) and PDF/Doc files with Qwen LLM summary & auto-naming."""
from __future__ import annotations
import html
import io
import ipaddress
import json
import os
import re
import socket
from typing import Any, Dict, List
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

import pypdf
from openai import OpenAI
from app.core.media_interfaces import IStorageBackend

DEFAULT_DASHSCOPE_KEY = "sk-ws-H.XEPHHX.yJ6F.MEQCIGBqUnDCfr2aS4ta3m7f7Yr35KZFQ9b9E36nxa58ZpqRAiALWC1NzT8PC_XCXj2vZOdhVIjfswhXNRkNXp78FHGyGg"
DASHSCOPE_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"

class SourceIntakeError(ValueError): pass

def _get_qwen_client() -> OpenAI:
    api_key = os.getenv("DASHSCOPE_API_KEY", DEFAULT_DASHSCOPE_KEY)
    return OpenAI(api_key=api_key, base_url=DASHSCOPE_BASE_URL)

def _safe_url(value: str) -> str:
    parsed = urlparse(value.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise SourceIntakeError(f"URL '{value}' must be a valid http/https link.")
    if parsed.hostname in {"localhost", "127.0.0.1", "::1"}:
        raise SourceIntakeError("Localhost URLs are not allowed.")
    try:
        for record in socket.getaddrinfo(parsed.hostname, None):
            address = ipaddress.ip_address(record[4][0])
            if address.is_private or address.is_loopback or address.is_link_local:
                raise SourceIntakeError(f"Private network URL '{value}' is restricted.")
    except socket.gaierror as exc:
        raise SourceIntakeError(f"Could not resolve host '{parsed.hostname}'.") from exc
    return value.strip()

def _extract_clean_html(raw_html: str) -> tuple[str, str, List[str]]:
    title_match = re.search(r"<title[^>]*>(.*?)</title>", raw_html, re.I | re.S)
    title = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", title_match.group(1))).strip()) if title_match else "Web Document"

    # Extract 1st-level links before stripping HTML
    links = re.findall(r'<a\s+(?:[^>]*?\s+)?href=["\']([^"\']+)["\']', raw_html, re.I)

    # Strip scripts, styles, SVGs, navs, footers, headers, images
    cleaned = re.sub(r"<(script|style|svg|noscript|nav|header|footer|aside|img)[^>]*>.*?</\1>", " ", raw_html, flags=re.I | re.S)
    cleaned = re.sub(r"<img[^>]*>", " ", cleaned, flags=re.I)
    text = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", cleaned))).strip()
    return title[:180], text, links

def _fetch_url_content(url: str, timeout: int = 10) -> tuple[str, str, List[str]]:
    safe_target = _safe_url(url)
    req = Request(safe_target, headers={"User-Agent": "GenMindIntake/3.0"})
    with urlopen(req, timeout=timeout) as resp:
        content_type = resp.headers.get_content_type()
        data = resp.read(2_000_000)
    if content_type == "text/html":
        raw = data.decode("utf-8", errors="replace")
        return _extract_clean_html(raw)
    else:
        text = data.decode("utf-8", errors="replace")
        return url, text[:20000], []

def summarize_content_and_create_headline(text: str) -> tuple[str, str]:
    """Agentic summarizer using Qwen (qwen3.5-flash): Creates a session headline and brief overview."""
    words = text.split()
    if not words:
        return "New Media Session", "No content extracted."

    clean_snippet = " ".join(words[:4000])

    try:
        client = _get_qwen_client()
        prompt = (
            "You are an expert editor for a NotebookLM media app. "
            "Analyze the following text extracted from user sources.\n"
            "Return JSON only with two keys:\n"
            '1. "headline": A crisp 4 to 7 word title for this notebook session.\n'
            '2. "overview": A concise paragraph summary (50-80 words).\n\n'
            f"SOURCE TEXT:\n{clean_snippet}"
        )
        res = client.chat.completions.create(
            model="qwen3.5-flash",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )
        content = res.choices[0].message.content or ""
        # Clean JSON formatting fence if present
        clean_json = re.sub(r"^```json\s*", "", content, flags=re.I).strip()
        clean_json = re.sub(r"```$", "", clean_json).strip()
        data = json.loads(clean_json)
        headline = data.get("headline", "").strip() or " ".join(words[:6]).title()
        overview = data.get("overview", "").strip() or " ".join(words[:100])
        return headline[:70], overview[:500]
    except Exception:
        # Rule-based fallback if LLM request fails
        first_sentence = [s.strip() for s in re.split(r'[.!?]', clean_snippet) if len(s.strip()) > 10]
        headline = first_sentence[0][:50].strip() if first_sentence else " ".join(words[:6]).title()
        overview = " ".join(words[:100]) + ("..." if len(words) > 100 else "")
        return headline, overview

class SourceIntakeService:
    def __init__(self, storage: IStorageBackend):
        self.storage = storage

    def inspect_urls(self, urls: List[str], deep_research: bool = False) -> List[Dict[str, Any]]:
        results = []
        for index, raw_url in enumerate(urls[:10]):
            try:
                main_title, main_text, internal_links = _fetch_url_content(raw_url)
                accumulated_text = [f"=== Main Source: {main_title} ===\n{main_text[:10000]}"]
                crawled_subpages = []

                # Deep Research: Maximum depth of 1 (1-hop direct child links on same domain)
                if deep_research and internal_links:
                    base_domain = urlparse(raw_url).netloc
                    unique_child_links = []
                    for link in internal_links:
                        full_link = urljoin(raw_url, link)
                        parsed_link = urlparse(full_link)
                        if parsed_link.netloc == base_domain and full_link not in unique_child_links and full_link != raw_url:
                            if not parsed_link.path.endswith((".png", ".jpg", ".jpeg", ".gif", ".pdf", ".zip", ".css", ".js")):
                                unique_child_links.append(full_link)

                    # Crawl depth 1 direct subpages (max 4)
                    for child_url in unique_child_links[:4]:
                        try:
                            child_title, child_text, _ = _fetch_url_content(child_url, timeout=6)
                            if len(child_text) > 150:
                                accumulated_text.append(f"\n--- Depth-1 Subpage ({child_title}): {child_url} ---\n{child_text[:6000]}")
                                crawled_subpages.append(child_url)
                        except Exception:
                            continue

                full_text = "\n\n".join(accumulated_text)
                archive_url = self.storage.upload_manifest(full_text, f"url_{index}_{abs(hash(raw_url))}")

                headline, overview = summarize_content_and_create_headline(full_text)

                results.append({
                    "id": f"url_{index}_{abs(hash(raw_url))}",
                    "kind": "url",
                    "mode": "deep" if deep_research else "normal",
                    "name": main_title,
                    "headline": headline,
                    "overview": overview,
                    "source_url": raw_url,
                    "archive_url": archive_url,
                    "excerpt": full_text[:350] + "...",
                    "content": full_text,
                    "word_count": len(full_text.split()),
                    "deep_pages": crawled_subpages,
                    "status": "ready"
                })
            except Exception as exc:
                results.append({
                    "id": f"url_{index}",
                    "kind": "url",
                    "mode": "deep" if deep_research else "normal",
                    "name": raw_url,
                    "source_url": raw_url,
                    "status": "error",
                    "error": str(exc)
                })
        return results

    def ingest_document(self, filename: str, data: bytes, content_type: str) -> Dict[str, Any]:
        """Reads PDF or plain text documents, extracting clean text only and discarding images/noise."""
        if len(data) > 20_000_000:
            raise SourceIntakeError("Document size must be under 20 MB.")

        extracted_text = ""
        is_pdf = filename.lower().endswith(".pdf") or content_type == "application/pdf"

        if is_pdf:
            try:
                reader = pypdf.PdfReader(io.BytesIO(data))
                page_texts = []
                for idx, page in enumerate(reader.pages):
                    txt = page.extract_text() or ""
                    if txt.strip():
                        page_texts.append(f"--- Page {idx + 1} ---\n{txt}")
                extracted_text = "\n\n".join(page_texts)
            except Exception as exc:
                raise SourceIntakeError(f"Could not extract PDF text: {exc}") from exc
        else:
            try:
                extracted_text = data.decode("utf-8", errors="replace")
            except Exception as exc:
                raise SourceIntakeError("Could not decode document text.") from exc

        # Clean binary noise and excess whitespace
        clean_text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]", "", extracted_text)
        clean_text = re.sub(r"\n{3,}", "\n\n", clean_text).strip()

        if not clean_text:
            raise SourceIntakeError(f"No readable text found in document '{filename}'.")

        archive_url = self.storage.upload_asset(data, filename, content_type)
        headline, overview = summarize_content_and_create_headline(clean_text)

        return {
            "id": f"file_{abs(hash(filename + str(len(data))))}",
            "kind": "document",
            "name": filename,
            "headline": headline,
            "overview": overview,
            "archive_url": archive_url,
            "excerpt": clean_text[:350] + "...",
            "content": clean_text,
            "word_count": len(clean_text.split()),
            "status": "ready"
        }
