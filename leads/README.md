# Leads

Lead files live in this folder. `scripts/build_dashboard_data.py` reads them into `data/empire.json` for the dashboard. It does not invent missing facts.

Do not put phone numbers, email addresses, or other contact details in these files. The script drops contact fields and redacts phone-like numbers. Agents never contact a business. Joey is the only person who calls.

## Files

- `leads/*.json`
- `leads/*.csv` (UTF-8, header row)

A JSON file can be one lead object, an array of lead objects, or `{"leads": [ ... ]}`.

## Fields

| Field | Required | Meaning |
|---|---|---|
| `name` | yes | Business name, copied from a public source. |
| `category` | no | What the business does, such as tattoo or bakery. |
| `address_area` | no | Neighborhood, town, or ZIP area. Not a private contact. |
| `current_site_url` | no | Public `http` or `https` URL of the site they have now. |
| `issue_notes` | no | What is outdated, broken, or missing, from pages you actually opened. |
| `status` | no | Suggested words: `scouted`, `building`, `ready`, `called`. Other text is kept as written. |
| `preview_site_path` | no | Repo path of the preview, such as `sites/business-slug`. |
| `agent` | no | `lead-gen-1` (Reading 19601), `lead-gen-2` (surrounding towns), or `lead-gen-3` (other niches and QA). |

CSV headers can use the same names, with spaces or underscores (`address area` or `address_area`).

Unknown fields are ignored. A row with no `name` is skipped. Both show up in `warnings` inside `data/empire.json`.

Leads with an `agent` appear on that agent's desk. Leads with no `agent` stay in the top-level `leads` list and are not assigned to a desk.

## JSON shape

```json
{
  "name": "Business Name",
  "category": "category",
  "address_area": "Reading, PA 19601",
  "current_site_url": "https://example.com",
  "issue_notes": "What is outdated or broken, from public pages only.",
  "status": "scouted",
  "preview_site_path": "sites/business-slug",
  "agent": "lead-gen-1"
}
```

That block is a blank template. It is not a lead. Do not save it here as a `.json` or `.csv` file unless the values are real.

## CSV header

```csv
name,category,address_area,current_site_url,issue_notes,status,preview_site_path,agent
```

Rebuild the dashboard data from the repo root:

```bash
python3 scripts/build_dashboard_data.py
```
