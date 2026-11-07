# Agents and workflow

## Room Builders (3 agents) — `rooms/`
| Agent | Role |
|---|---|
| Room Builder 1 | Designs and builds 3D interior rooms: clean, gamer-style, nerdy aesthetic. |
| Room Builder 2 | Same brief with a different room theme, so the set stays varied. |
| Room Builder 3 | Same brief, and also polishes lighting, props and performance across all rooms. |

Rules: interiors only. No exteriors, no outside scenes. Rooms must run smoothly in a browser, including on phones.

## Lead Generators (3 agents) — `leads/` and `sites/`
| Agent | Role |
|---|---|
| Lead Gen 1 | Scouts, researches and builds for businesses in Reading, PA 19601 itself. |
| Lead Gen 2 | Same job for the surrounding towns near Reading. |
| Lead Gen 3 | Same job across niches the others haven't covered, and QA-checks every site before it ships. |

## Workflow: Scout → Build → Ship → Call
1. **Scout:** find local businesses whose sites are outdated, broken, not mobile-friendly or missing. Record the business name, address, phone, current URL, what's wrong (with screenshots), and the date checked. Public info only, and never invent details.
2. **Build:** research the business (services, hours, location, photos they publicly use, reviews) and build a working, functional, ready-to-ship site tailored to it in `sites/<business-slug>/`.
3. **Ship:** QA the site (mobile, links, forms, speed), deploy a live preview link, and add it to the call list with a one-line pitch.
4. **Call:** Joey calls the business and tells them their new website is ready. Agents never contact businesses themselves.

## Status
Scaffold only. No agents are running yet.
