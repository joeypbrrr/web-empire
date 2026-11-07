#!/usr/bin/env python3
"""Build data/empire.json from the repo. Nothing here is invented.

Reads:
  git log
  docs/AGENTS.md          agent names, roles, status line
  README.md               location line, when present
  sites/<slug>/index.html page title and meta description
  leads/*.json, leads/*.csv
  rooms/<slug>/index.html and optional rooms/<slug>/room.json

Phone numbers and contact fields are dropped. The script never calls anyone.

Rerun from the repo root after new commits, sites, or lead files, then commit
the JSON:

    python3 scripts/build_dashboard_data.py
"""

from __future__ import annotations

import csv
import io
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "empire.json"

PHONE_RE = re.compile(
    r"(?<!\w)(?:\+?\d{1,3}[\s.\-]?)?(?:\(\s*\d{3}\s*\)|\d{3})[\s.\-]?\d{3}[\s.\-]?\d{4}(?!\w)"
)
LEAD_FIELDS = {
    "name": "name",
    "category": "category",
    "address_area": "address_area",
    "address area": "address_area",
    "current_site_url": "current_site_url",
    "current site url": "current_site_url",
    "issue_notes": "issue_notes",
    "issue notes": "issue_notes",
    "status": "status",
    "preview_site_path": "preview_site_path",
    "preview site path": "preview_site_path",
    "agent": "agent",
}
DROP_FIELDS = {
    "phone",
    "tel",
    "telephone",
    "mobile",
    "cell",
    "email",
    "e-mail",
    "e mail",
}
LEAD_AGENTS = {"lead-gen-1", "lead-gen-2", "lead-gen-3"}
ROOM_AGENTS = {"room-builder-1", "room-builder-2", "room-builder-3"}


class HeadParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._in_title = False
        self.title = ""
        self.description = ""
        self.robots = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {key.lower(): (value or "") for key, value in attrs}
        if tag.lower() == "title":
            self._in_title = True
        if tag.lower() == "meta":
            name = attr.get("name", "").lower()
            if name == "description":
                self.description = attr.get("content", "")
            elif name == "robots":
                self.robots = attr.get("content", "")

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data


def scrub(text: str, source: str, warnings: list[str]) -> str:
    def repl(_match: re.Match[str]) -> str:
        warnings.append(f"Redacted a phone-like number in {source}")
        return "[redacted]"

    cleaned = PHONE_RE.sub(repl, text)
    if re.search(r"tel:\+?\d+", cleaned, flags=re.I):
        warnings.append(f"Redacted a tel link in {source}")
        cleaned = re.sub(r"tel:\+?\d+", "[redacted]", cleaned, flags=re.I)
    return cleaned


def github_slug() -> tuple[str, str]:
    url = subprocess.check_output(
        ["git", "-C", str(ROOT), "remote", "get-url", "origin"],
        text=True,
    ).strip()
    match = re.search(
        r"github\.com[:/](?P<owner>[A-Za-z0-9_.-]+)/(?P<repo>[A-Za-z0-9_.-]+?)(?:\.git)?$",
        url,
    )
    if not match:
        sys.exit("Could not read the GitHub owner and repo from origin.")
    return match.group("owner"), match.group("repo")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def agent_roster(md: str) -> tuple[list[dict[str, str]], str]:
    agents: list[dict[str, str]] = []
    kind: str | None = None
    for line in md.splitlines():
        if line.startswith("## Room Builders"):
            kind = "room"
            continue
        if line.startswith("## Lead Generators"):
            kind = "lead"
            continue
        if line.startswith("## "):
            kind = None
            continue
        if not kind or not line.startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) < 2:
            continue
        name, role = cells[0], cells[1]
        match = re.fullmatch(r"(Room Builder|Lead Gen) (\d+)", name)
        if not match:
            continue
        number = match.group(2)
        prefix = "room-builder" if kind == "room" else "lead-gen"
        agents.append(
            {
                "id": f"{prefix}-{number}",
                "name": name,
                "kind": kind,
                "role": role,
            }
        )
    status = ""
    status_match = re.search(r"^## Status\s*$([\s\S]+)$", md, re.M)
    if status_match:
        lines = [
            line.strip()
            for line in status_match.group(1).splitlines()
            if line.strip() and not line.startswith("#")
        ]
        status = " ".join(lines)
    return agents, status


def location_line(readme: str) -> str:
    match = re.search(r"Reading, Pennsylvania \(ZIP 19601\)", readme)
    return match.group(0) if match else ""


def workflow_steps(md: str) -> list[str]:
    if re.search(r"Scout\s*→\s*Build\s*→\s*Ship\s*→\s*Call", md):
        return ["Scout", "Build", "Ship", "Call"]
    return []


def git_updates(owner: str, repo: str, warnings: list[str]) -> list[dict[str, str]]:
    try:
        out = subprocess.check_output(
            [
                "git",
                "-C",
                str(ROOT),
                "log",
                "-n",
                "20",
                "--pretty=format:%H%x1f%an%x1f%aI%x1f%s",
            ],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError:
        warnings.append("git log failed; updates list is empty.")
        return []
    updates: list[dict[str, str]] = []
    for line in out.splitlines():
        if not line.strip():
            continue
        parts = line.split("\x1f")
        if len(parts) != 4:
            continue
        sha, author, date, subject = parts
        if not re.fullmatch(r"[0-9a-f]{40}", sha):
            continue
        updates.append(
            {
                "sha": sha,
                "shortSha": sha[:7],
                "author": scrub(author, f"commit {sha[:7]} author", warnings),
                "date": date,
                "subject": scrub(subject, f"commit {sha[:7]}", warnings).strip(),
                "url": f"https://github.com/{owner}/{repo}/commit/{sha}",
            }
        )
    return updates


def read_head(path: Path) -> str:
    raw = path.read_text(encoding="utf-8", errors="replace")
    end = raw.lower().find("</head>")
    if end < 0:
        return raw[:20000]
    return raw[: end + len("</head>")]


def short_name(title: str, slug: str) -> str:
    cleaned = title.strip()
    for suffix in (
        " — Unofficial Concept Preview",
        " - Unofficial Concept Preview",
    ):
        if cleaned.endswith(suffix):
            return cleaned[: -len(suffix)].strip() or slug
    return cleaned or slug


def scan_sites(pages: str, warnings: list[str]) -> list[dict[str, object]]:
    sites_dir = ROOT / "sites"
    sites: list[dict[str, object]] = []
    if not sites_dir.is_dir():
        warnings.append("sites/ is missing.")
        return sites
    for path in sorted(sites_dir.iterdir()):
        if not path.is_dir():
            continue
        slug = path.name
        index = path / "index.html"
        if not index.is_file():
            continue
        if not re.fullmatch(r"[a-z0-9-]+", slug):
            warnings.append(f"Skipped sites/{slug}/ because the folder name is not a slug.")
            continue
        parser = HeadParser()
        parser.feed(read_head(index))
        title = scrub(re.sub(r"\s+", " ", parser.title).strip(), f"sites/{slug}/", warnings)
        description = scrub(
            re.sub(r"\s+", " ", parser.description).strip(),
            f"sites/{slug}/",
            warnings,
        )
        robots = parser.robots.lower()
        preview_path = f"sites/{slug}/"
        sites.append(
            {
                "slug": slug,
                "name": short_name(title, slug),
                "title": title or slug,
                "description": description,
                "path": preview_path,
                "previewUrl": f"{pages}{preview_path}",
                "unofficial": "unofficial" in f"{title} {description}".lower(),
                "noindex": "noindex" in robots,
            }
        )
    return sites


def slug_from_preview(value: str) -> str:
    text = value.strip().strip("/")
    match = re.search(r"(?:^|/)sites/([a-z0-9-]+)$", text)
    if match:
        return match.group(1)
    if re.fullmatch(r"[a-z0-9-]+", text):
        return text
    return ""


def normalize_lead(row: object, source: str, warnings: list[str]) -> dict[str, str] | None:
    if not isinstance(row, dict):
        warnings.append(f"{source} is not an object.")
        return None
    cleaned: dict[str, str] = {}
    for key, value in row.items():
        norm = str(key).strip().lower().replace("-", " ")
        norm_key = norm.replace(" ", "_")
        if (
            norm in DROP_FIELDS
            or norm_key in DROP_FIELDS
            or "phone" in norm_key
            or norm_key in {"tel", "mobile", "email"}
        ):
            warnings.append(f"Dropped contact field '{key}' from {source}.")
            continue
        canon = LEAD_FIELDS.get(norm_key) or LEAD_FIELDS.get(norm)
        if not canon:
            warnings.append(f"Ignored unknown field '{key}' in {source}.")
            continue
        if value is None:
            continue
        text = value if isinstance(value, str) else str(value)
        cleaned[canon] = scrub(text, source, warnings).strip()
    if not cleaned.get("name"):
        warnings.append(f"{source} is missing name.")
        return None
    rel = source.split("#", 1)[0]
    cleaned["source"] = rel
    agent = cleaned.get("agent", "")
    if agent and agent not in LEAD_AGENTS:
        warnings.append(f"{source} has an unknown agent id.")
        cleaned.pop("agent", None)
    url = cleaned.get("current_site_url", "")
    if url and not re.match(r"^https?://", url):
        warnings.append(f"{source} current_site_url is not an http(s) URL.")
        cleaned.pop("current_site_url", None)
    return cleaned


def rows_from_json(data: object, source: str, warnings: list[str]) -> list[object]:
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get("leads"), list):
        return data["leads"]
    if isinstance(data, dict):
        return [data]
    warnings.append(f"{source} has no lead object.")
    return []


def scan_leads(warnings: list[str]) -> list[dict[str, str]]:
    leads_dir = ROOT / "leads"
    leads: list[dict[str, str]] = []
    if not leads_dir.is_dir():
        warnings.append("leads/ is missing.")
        return leads
    for path in sorted(leads_dir.iterdir()):
        if not path.is_file() or path.name.startswith("."):
            continue
        rel = path.relative_to(ROOT).as_posix()
        suffix = path.suffix.lower()
        if suffix == ".json":
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError as exc:
                warnings.append(f"{rel} is not valid JSON (line {exc.lineno}).")
                continue
            for index, row in enumerate(rows_from_json(data, rel, warnings), start=1):
                lead = normalize_lead(row, f"{rel}#{index}", warnings)
                if lead:
                    leads.append(lead)
        elif suffix == ".csv":
            text = path.read_text(encoding="utf-8-sig")
            reader = csv.DictReader(io.StringIO(text))
            if not reader.fieldnames:
                warnings.append(f"{rel} has no header row.")
                continue
            for index, row in enumerate(reader, start=1):
                lead = normalize_lead(row, f"{rel}#{index}", warnings)
                if lead:
                    leads.append(lead)
    return leads


def scan_rooms(warnings: list[str]) -> list[dict[str, str]]:
    rooms_dir = ROOT / "rooms"
    rooms: list[dict[str, str]] = []
    if not rooms_dir.is_dir():
        warnings.append("rooms/ is missing.")
        return rooms
    for path in sorted(rooms_dir.iterdir()):
        if not path.is_dir() or not (path / "index.html").is_file():
            continue
        slug = path.name
        if not re.fullmatch(r"[a-z0-9-]+", slug):
            warnings.append(f"Skipped rooms/{slug}/ because the folder name is not a slug.")
            continue
        room: dict[str, str] = {
            "slug": slug,
            "name": slug,
            "path": f"rooms/{slug}/",
        }
        meta_path = path / "room.json"
        if meta_path.is_file():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError as exc:
                warnings.append(f"rooms/{slug}/room.json is not valid JSON (line {exc.lineno}).")
                meta = {}
            if isinstance(meta, dict):
                name = meta.get("name")
                notes = meta.get("notes")
                agent = meta.get("agent")
                if isinstance(name, str) and name.strip():
                    room["name"] = scrub(name.strip(), f"rooms/{slug}/room.json", warnings)
                if isinstance(notes, str) and notes.strip():
                    room["notes"] = scrub(notes.strip(), f"rooms/{slug}/room.json", warnings)
                if isinstance(agent, str) and agent.strip():
                    if agent.strip() in ROOM_AGENTS:
                        room["agent"] = agent.strip()
                    else:
                        warnings.append(f"rooms/{slug}/room.json has an unknown agent id.")
        rooms.append(room)
    return rooms


def ship_note(sites: list[dict[str, object]], leads: list[dict[str, str]]) -> str:
    if not sites:
        return "No site folders with an index.html yet."
    folder_word = "folder" if len(sites) == 1 else "folders"
    note = f"{len(sites)} preview {folder_word} under sites/."
    if not leads:
        note += " No lead files in leads/ yet, so nothing is marked called."
    titles = {str(site.get("title") or "") for site in sites}
    if len(sites) > 1 and len(titles) == 1:
        note += " These folders share the same page title."
    return note


def site_brief(site: dict[str, object]) -> dict[str, object]:
    return {
        "slug": site["slug"],
        "name": site["name"],
        "title": site["title"],
        "path": site["path"],
        "previewUrl": site["previewUrl"],
    }


def attach(agents: list[dict[str, object]], leads: list[dict[str, str]], rooms: list[dict[str, str]], sites: list[dict[str, object]]) -> None:
    by_id = {str(agent["id"]): agent for agent in agents}
    sites_by_slug = {str(site["slug"]): site for site in sites}
    for agent in agents:
        agent["leads"] = []
        agent["builds"] = []
        agent["rooms"] = []
    for lead in leads:
        agent = by_id.get(lead.get("agent", ""))
        if not agent or agent["kind"] != "lead":
            continue
        agent["leads"].append(lead)
        slug = slug_from_preview(lead.get("preview_site_path", ""))
        site = sites_by_slug.get(slug)
        builds = agent["builds"]
        if site and not any(item["slug"] == slug for item in builds):
            builds.append(site_brief(site))
    for room in rooms:
        agent = by_id.get(room.get("agent", ""))
        if agent and agent["kind"] == "room":
            agent["rooms"].append(room)


def build_payload() -> dict[str, object]:
    warnings: list[str] = []
    owner, repo = github_slug()
    pages = f"https://{owner}.github.io/{repo}/"
    agents_md = read_text(ROOT / "docs" / "AGENTS.md")
    readme = read_text(ROOT / "README.md")
    roster, status_note = agent_roster(agents_md)
    if len(roster) != 6:
        sys.exit(f"Expected 6 agents in docs/AGENTS.md, found {len(roster)}.")
    running_phrase = bool(
        re.search(r"not running|no agents are running", status_note, re.I)
    )
    agents: list[dict[str, object]] = []
    for entry in roster:
        agents.append(
            {
                **entry,
                "status": "Not running" if running_phrase else (status_note or "Status not recorded"),
                "statusDetail": status_note,
                "running": False,
            }
        )
    sites = scan_sites(pages, warnings)
    leads = scan_leads(warnings)
    rooms = scan_rooms(warnings)
    attach(agents, leads, rooms, sites)
    updates = git_updates(owner, repo, warnings)
    generated_at = (
        datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    )
    payload: dict[str, object] = {
        "generatedAt": generated_at,
        "source": "scripts/build_dashboard_data.py",
        "repository": f"{owner}/{repo}",
        "pagesBase": pages,
        "location": location_line(readme),
        "workflow": workflow_steps(agents_md) or workflow_steps(readme),
        "statusSource": "docs/AGENTS.md",
        "agentStatusNote": status_note,
        "shipNote": ship_note(sites, leads),
        "agents": agents,
        "leads": leads,
        "rooms": rooms,
        "sites": sites,
        "readyToShip": sites,
        "updates": updates,
        "warnings": warnings,
    }
    blob = json.dumps(payload)
    if PHONE_RE.search(blob) or re.search(r"tel:\+?\d+", blob, re.I):
        sys.exit("Refusing to write data/empire.json because a phone number is still present.")
    return payload


def main() -> None:
    payload = build_payload()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    sites = payload["sites"]
    leads = payload["leads"]
    updates = payload["updates"]
    print(
        f"Wrote {OUT.relative_to(ROOT)} "
        f"({len(sites)} sites, {len(leads)} leads, {len(updates)} updates, "
        f"{len(payload['warnings'])} warnings)."
    )


if __name__ == "__main__":
    main()
