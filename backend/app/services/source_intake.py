"""Safe, optimized source intake. Deep mode: each sub-page becomes its own source entry with headline + overview.
Normal mode: single source entry. PDF/Doc: extracted as text with LLM headline + overview."""
from __future__ import annotations
import html
import io
import ipaddress
import json
import os
import re
import socket
from pathlib import Path
from typing import Any, Dict, List
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

import pypdf
from dotenv import load_dotenv
from genblaze import Modality, Pipeline
from app.core.media_interfaces import IStorageBackend

base_dir = Path(__file__).resolve().parent.parent.parent
env_path = base_dir / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

from app.services.studio_pipeline import DashScopeGenblazeProvider

class SourceIntakeError(ValueError): pass

_dashscope_provider = DashScopeGenblazeProvider()

# ── Helpers ───────────────────────────────────────────────────────────────────

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
    links = re.findall(r"<a\s+(?:[^>]*?\s+)?href=[\"']([^\"']+)[\"']", raw_html, re.I)
    cleaned = re.sub(r"<(script|style|svg|noscript|nav|header|footer|aside|img)[^>]*>.*?</\1>", " ", raw_html, flags=re.I | re.S)
    cleaned = re.sub(r"<img[^>]*>", " ", cleaned, flags=re.I)
    text = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", cleaned))).strip()
    return title[:180], text, links

def _fetch_url_content(url: str, timeout: int = 10) -> tuple[str, str, List[str]]:
    safe_target = _safe_url(url)
    req = Request(safe_target, headers={"User-Agent": "GenMindIntake/3.0"})
    with urlopen(req, timeout=timeout) as resp:
        content_type = resp.headers.get_content_type()
        data = resp.read(10_000_000)
    if content_type == "text/html":
        raw = data.decode("utf-8", errors="replace")
        return _extract_clean_html(raw)
    else:
        text = data.decode("utf-8", errors="replace")
        return url, text[:200000], []

def _favicon_url(page_url: str) -> str:
    """Returns the Google favicon proxy URL for a given page URL."""
    parsed = urlparse(page_url)
    domain = f"{parsed.scheme}://{parsed.netloc}"
    return f"https://www.google.com/s2/favicons?domain={domain}&sz=32"

def _make_source_id(url: str, index: int, suffix: str = "") -> str:
    return f"url_{index}_{abs(hash(url + suffix))}"

def fast_source_meta(title: str, text: str) -> tuple[str, str]:
    """Fast, zero-LLM metadata extraction for scraped sources."""
    clean_title = (title or "").strip()
    words = text.split()
    if not clean_title or clean_title == "Web Document":
        clean_title = " ".join(words[:6]).title() if words else "Source Document"
    overview = " ".join(words[:35]) + ("..." if len(words) > 35 else "")
    return clean_title[:80], overview[:300]


class SourceIntakeService:
    def __init__(self, storage: IStorageBackend):
        self.storage = storage

    def inspect_urls(self, urls: List[str], deep_research: bool = False) -> List[Dict[str, Any]]:
        """
        Normal mode: one source per URL.
        Deep mode: parent URL + each successfully crawled sub-page become SEPARATE source entries.
        """
        results: List[Dict[str, Any]] = []

        for index, raw_url in enumerate(urls[:10]):
            try:
                main_title, main_text, internal_links = _fetch_url_content(raw_url)
                favicon = _favicon_url(raw_url)

                if not deep_research:
                    # ── Normal mode: single source ──────────────────────────
                    archive_url = self.storage.upload_manifest(main_text, _make_source_id(raw_url, index))
                    headline, overview = fast_source_meta(main_title, main_text)
                    results.append({
                        "id": _make_source_id(raw_url, index),
                        "kind": "url",
                        "mode": "normal",
                        "name": main_title,
                        "headline": headline,
                        "overview": overview,
                        "source_url": raw_url,
                        "favicon_url": favicon,
                        "archive_url": archive_url,
                        "excerpt": main_text[:350] + "...",
                        "content": main_text,
                        "word_count": len(main_text.split()),
                        "deep_pages": [],
                        "status": "ready",
                        "is_subpage": False,
                        "parent_url": None,
                    })
                else:
                    # ── Deep mode: parent + each sub-page as own entry ──────
                    base_domain = urlparse(raw_url).netloc
                    unique_child_links: List[str] = []
                    for link in internal_links:
                        full_link = urljoin(raw_url, link)
                        parsed_link = urlparse(full_link)
                        if (
                            parsed_link.netloc == base_domain
                            and full_link not in unique_child_links
                            and full_link != raw_url
                            and not parsed_link.path.endswith(
                                (".png", ".jpg", ".jpeg", ".gif", ".pdf", ".zip", ".css", ".js")
                            )
                        ):
                            unique_child_links.append(full_link)

                    # Add parent page first
                    parent_archive = self.storage.upload_manifest(main_text, _make_source_id(raw_url, index, "parent"))
                    parent_headline, parent_overview = fast_source_meta(main_title, main_text)
                    crawled_subpage_urls: List[str] = []
                    results.append({
                        "id": _make_source_id(raw_url, index, "parent"),
                        "kind": "url",
                        "mode": "deep",
                        "name": main_title,
                        "headline": parent_headline,
                        "overview": parent_overview,
                        "source_url": raw_url,
                        "favicon_url": favicon,
                        "archive_url": parent_archive,
                        "excerpt": main_text[:350] + "...",
                        "content": main_text,
                        "word_count": len(main_text.split()),
                        "deep_pages": [],  # filled in below
                        "status": "ready",
                        "is_subpage": False,
                        "parent_url": None,
                    })

                    # Add each sub-page as a separate source entry
                    for child_url in unique_child_links[:4]:
                        try:
                            child_title, child_text, _ = _fetch_url_content(child_url, timeout=6)
                            if len(child_text) < 150:
                                continue
                            child_archive = self.storage.upload_manifest(
                                child_text, _make_source_id(child_url, index, "sub")
                            )
                            child_headline, child_overview = fast_source_meta(child_title, child_text)
                            child_favicon = _favicon_url(child_url)
                            crawled_subpage_urls.append(child_url)
                            results.append({
                                "id": _make_source_id(child_url, index, "sub"),
                                "kind": "url",
                                "mode": "deep",
                                "name": child_title,
                                "headline": child_headline,
                                "overview": child_overview,
                                "source_url": child_url,
                                "favicon_url": child_favicon,
                                "archive_url": child_archive,
                                "excerpt": child_text[:350] + "...",
                                "content": child_text,
                                "word_count": len(child_text.split()),
                                "deep_pages": [],
                                "status": "ready",
                                "is_subpage": True,
                                "parent_url": raw_url,
                            })
                        except Exception:
                            continue

                    # Back-fill parent's deep_pages list
                    for entry in results:
                        if entry.get("source_url") == raw_url and not entry.get("is_subpage"):
                            entry["deep_pages"] = crawled_subpage_urls

            except Exception as exc:
                results.append({
                    "id": f"url_{index}",
                    "kind": "url",
                    "mode": "deep" if deep_research else "normal",
                    "name": raw_url,
                    "headline": raw_url,
                    "overview": str(exc),
                    "source_url": raw_url,
                    "favicon_url": "",
                    "status": "error",
                    "error": str(exc),
                    "is_subpage": False,
                    "parent_url": None,
                })

        return results

    def ingest_document(self, filename: str, data: bytes, content_type: str) -> Dict[str, Any]:
        if len(data) > 20_000_000:
            raise SourceIntakeError("Document size must be under 20 MB.")

        ext = Path(filename).suffix.lower()
        is_image = ext in {".png", ".jpg", ".jpeg"} or content_type in {"image/png", "image/jpeg", "image/jpg"}

        if is_image:
            import uuid
            if ext not in {".png", ".jpg", ".jpeg"} and content_type not in {"image/png", "image/jpeg", "image/jpg"}:
                raise SourceIntakeError("Only PNG and JPG/JPEG image formats are accepted.")

            public_dir = Path(__file__).resolve().parent.parent.parent / "static" / "public"
            public_dir.mkdir(parents=True, exist_ok=True)
            safe_ext = ext if ext in {".png", ".jpg", ".jpeg"} else (".png" if "png" in content_type else ".jpg")
            safe_filename = f"img_src_{uuid.uuid4().hex[:10]}{safe_ext}"
            file_path = public_dir / safe_filename
            with open(file_path, "wb") as f:
                f.write(data)

            static_url = f"/static/public/{safe_filename}"
            headline = f"Image Source: {filename}"
            overview = f"Uploaded source image asset ({filename}) available for multi-modal reference."

            return {
                "id": f"img_{uuid.uuid4().hex[:8]}",
                "kind": "image",
                "name": filename,
                "headline": headline,
                "overview": overview,
                "source_url": None,
                "favicon_url": None,
                "archive_url": static_url,
                "excerpt": f"[Image Source Asset: {filename}]({static_url})",
                "content": f"[Image Source Asset: {filename}]({static_url})",
                "word_count": 0,
                "deep_pages": [],
                "status": "ready",
                "is_subpage": False,
                "parent_url": None,
            }

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

        clean_text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]", "", extracted_text)
        clean_text = re.sub(r"\n{3,}", "\n\n", clean_text).strip()

        if not clean_text:
            raise SourceIntakeError(f"No readable text found in document '{filename}'.")

        archive_url = self.storage.upload_asset(data, filename, content_type)
        headline, overview = fast_source_meta(filename, clean_text)

        # Detect document type
        doc_kind = "document"
        if filename.lower().endswith(".pdf"):
            doc_kind = "pdf"
        elif filename.lower().endswith(".docx"):
            doc_kind = "word"
        elif filename.lower().endswith(".pptx"):
            doc_kind = "ppt"

        return {
            "id": f"file_{abs(hash(filename + str(len(data))))}",
            "kind": doc_kind,
            "name": filename,
            "headline": headline,
            "overview": overview,
            "source_url": None,
            "favicon_url": None,
            "archive_url": archive_url,
            "excerpt": clean_text[:350] + "...",
            "content": clean_text,
            "word_count": len(clean_text.split()),
            "deep_pages": [],
            "status": "ready",
            "is_subpage": False,
            "parent_url": None,
        }
