import { accentFor, kindLabel } from "./palette.js";
import { mountRoom } from "./room.js";

const panel = document.getElementById("agent-panel");
const panelTitle = document.getElementById("panel-title");
const panelBody = document.getElementById("panel-body");
const panelClose = document.getElementById("panel-close");
const crewList = document.getElementById("crew-list");
const shipList = document.getElementById("ship-list");
const shipNote = document.getElementById("ship-note");
const updates = document.getElementById("updates");
const boot = document.getElementById("boot");
const locationEl = document.getElementById("location");
const flowEl = document.getElementById("flow");
const resetBtn = document.getElementById("reset-view");
const unassignedEl = document.getElementById("unassigned");

let empire = null;
let room = null;
let lastFocus = null;
let openedAt = 0;

panelClose.addEventListener("click", closePanel);
panel.addEventListener("click", (event) => {
  if (event.target !== panel) return;
  if (performance.now() - openedAt < 500) return;
  closePanel();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !panel.hidden) closePanel();
});
resetBtn.addEventListener("click", () => room && room.resetView());

init().catch((error) => {
  window.__empireError = String(error && error.stack ? error.stack : error);
  document.body.dataset.scene = "error";
  boot.hidden = false;
  boot.textContent = error && error.message ? error.message : "The floor could not start.";
});

async function init() {
  const response = await fetch("data/empire.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`data/empire.json returned ${response.status}`);
  empire = await response.json();
  renderChrome(empire);
  renderCrew(empire.agents || []);
  renderShip(empire);
  renderUpdates(empire);
  const canvas = document.getElementById("floor");
  room = mountRoom(canvas, empire, {
    onAgent: (id) => openAgent(id, crewList.querySelector(`[data-agent="${id}"]`)),
    onSite: (item) => focusSite(item.slug, true),
  });
  window.__empire = {
    get pixelRatio() {
      return room.pixelRatio;
    },
    get shadows() {
      return room.shadows;
    },
    screenPoint: (id) => room.screenPoint(id),
  };
  boot.hidden = true;
  document.body.dataset.scene = "ready";
}

function renderChrome(data) {
  if (data.location) locationEl.textContent = data.location;
  flowEl.replaceChildren();
  for (const step of data.workflow || []) {
    const item = document.createElement("li");
    item.textContent = step;
    flowEl.append(item);
  }
}

function renderCrew(agents) {
  crewList.replaceChildren();
  for (const agent of agents) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.agent = agent.id;
    button.setAttribute("aria-pressed", "false");
    button.style.setProperty("--accent", accentFor(agent.id));
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = accentFor(agent.id);
    const text = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = agent.name || agent.id;
    const kind = document.createElement("small");
    kind.textContent = kindLabel(agent.kind);
    text.append(name, kind);
    button.append(swatch, text);
    button.addEventListener("click", () => openAgent(agent.id, button));
    crewList.append(button);
  }
}

function renderShip(data) {
  shipNote.textContent = data.shipNote || "";
  shipList.replaceChildren();
  const sites = Array.isArray(data.readyToShip) ? data.readyToShip : [];
  if (!sites.length) {
    shipList.append(empty("Nothing ready to ship yet."));
    return;
  }
  for (const site of sites) {
    const link = document.createElement("a");
    link.className = "ship-link";
    link.dataset.slug = site.slug || "";
    const href = safeHttp(site.previewUrl);
    if (href) {
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    const name = document.createElement("span");
    name.className = "ship-name";
    name.textContent = site.name || site.title || site.slug || "Site";
    const path = document.createElement("span");
    path.className = "ship-path";
    path.textContent = site.path || "";
    const go = document.createElement("span");
    go.className = "ship-go";
    go.textContent = "Open live preview";
    link.append(name, path, go);
    if (site.description) {
      const copy = document.createElement("span");
      copy.className = "ship-copy";
      copy.textContent = site.description;
      link.append(copy);
    }
    const tags = document.createElement("span");
    tags.className = "tags";
    if (site.unofficial) tags.append(tag("Unofficial"));
    if (site.noindex) tags.append(tag("noindex"));
    if (tags.childNodes.length) link.append(tags);
    shipList.append(link);
  }
}

function renderUpdates(data) {
  updates.replaceChildren();
  const rows = Array.isArray(data.updates) ? data.updates : [];
  if (!rows.length) {
    const item = document.createElement("li");
    item.textContent = "No commits found.";
    updates.append(item);
    return;
  }
  for (const row of rows) {
    const item = document.createElement("li");
    const time = document.createElement("time");
    time.dateTime = row.date || "";
    time.textContent = formatWhen(row.date);
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = row.author || "";
    const subject = document.createElement("p");
    subject.textContent = row.subject || "";
    item.append(time, who, subject);
    if (isCommitUrl(row.url)) {
      const sha = document.createElement("a");
      sha.href = row.url;
      sha.target = "_blank";
      sha.rel = "noopener noreferrer";
      sha.textContent = row.shortSha || "commit";
      item.append(sha);
    }
    updates.append(item);
  }
  if (data.generatedAt) {
    const meta = document.createElement("li");
    meta.className = "feed-meta";
    meta.textContent = `Snapshot ${formatWhen(data.generatedAt)}. Rerun scripts/build_dashboard_data.py after new commits.`;
    updates.append(meta);
  }
  const unassigned = (data.leads || []).filter((lead) => !lead.agent);
  if (unassigned.length && (data.leads || []).length) {
    unassignedEl.hidden = false;
    unassignedEl.textContent = `${unassigned.length} lead file(s) have no agent id. They are in data/empire.json under leads, not on a desk.`;
  }
}

function openAgent(id, focusEl) {
  const agent = (empire.agents || []).find((item) => item.id === id);
  if (!agent) return;
  openedAt = performance.now();
  lastFocus = focusEl || document.activeElement;
  panelTitle.textContent = agent.name || agent.id;
  panelBody.replaceChildren();
  panelBody.append(statusBlock(agent));
  if (empire.statusSource) {
    const source = document.createElement("p");
    source.className = "note";
    source.textContent = `Status line from ${empire.statusSource}.`;
    panelBody.append(source);
  }
  const role = document.createElement("p");
  role.className = "role";
  role.textContent = agent.role || "";
  panelBody.append(role);

  if (agent.kind === "lead") {
    panelBody.append(section("Leads", agent.leads, "No leads yet", renderLead));
    panelBody.append(section("Builds", agent.builds, "No builds yet", renderBuild));
  } else {
    panelBody.append(section("Rooms", agent.rooms, "No rooms built yet", renderRoom));
  }

  panel.hidden = false;
  panelClose.focus();
  for (const button of crewList.querySelectorAll("[data-agent]")) {
    button.setAttribute("aria-pressed", button.dataset.agent === id ? "true" : "false");
  }
  if (room) {
    room.highlightAgent(id);
    room.highlightSite(null);
  }
}

function closePanel() {
  panel.hidden = true;
  for (const button of crewList.querySelectorAll("[data-agent]")) {
    button.setAttribute("aria-pressed", "false");
  }
  if (room) room.highlightAgent(null);
  if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
}

function focusSite(slug, openPreview) {
  const link = shipList.querySelector(`[data-slug="${CSS.escape(slug)}"]`);
  if (!link) return;
  for (const other of shipList.querySelectorAll(".ship-link")) {
    other.classList.toggle("is-hot", other === link);
  }
  link.scrollIntoView({ block: "nearest" });
  if (room) room.highlightSite(slug);
  if (openPreview && link.href) window.open(link.href, "_blank", "noopener,noreferrer");
}

function statusBlock(agent) {
  const wrap = document.createElement("p");
  wrap.className = "status-row";
  const label = document.createElement("span");
  label.className = "k";
  label.textContent = "Status";
  const pill = document.createElement("span");
  pill.className = "pill";
  pill.textContent = agent.status || "Status not recorded";
  wrap.append(label, pill);
  const detail = document.createElement("p");
  detail.className = "detail";
  detail.textContent = agent.statusDetail || "";
  const holder = document.createElement("div");
  holder.append(wrap, detail);
  return holder;
}

function section(title, items, emptyText, render) {
  const block = document.createElement("section");
  const heading = document.createElement("h3");
  heading.textContent = title;
  block.append(heading);
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    block.append(empty(emptyText));
    return block;
  }
  const ul = document.createElement("ul");
  ul.className = "records";
  for (const item of list) ul.append(render(item));
  block.append(ul);
  return block;
}

function renderLead(lead) {
  const item = document.createElement("li");
  const name = document.createElement("strong");
  name.textContent = lead.name || "Lead";
  item.append(name);
  addLine(item, lead.category);
  addLine(item, lead.address_area);
  addLine(item, lead.status);
  addLine(item, lead.issue_notes);
  const href = safeHttp(lead.current_site_url);
  if (href) item.append(textLink(href, "Current site"));
  if (lead.preview_site_path) addLine(item, lead.preview_site_path);
  return item;
}

function renderBuild(build) {
  const item = document.createElement("li");
  const name = document.createElement("strong");
  name.textContent = build.name || build.slug || "Build";
  item.append(name);
  addLine(item, build.path);
  const href = safeHttp(build.previewUrl);
  if (href) item.append(textLink(href, "Open live preview"));
  return item;
}

function renderRoom(roomItem) {
  const item = document.createElement("li");
  const name = document.createElement("strong");
  name.textContent = roomItem.name || roomItem.slug || "Room";
  item.append(name);
  addLine(item, roomItem.path);
  addLine(item, roomItem.notes);
  return item;
}

function addLine(parent, value) {
  if (!value) return;
  const line = document.createElement("span");
  line.textContent = value;
  parent.append(line);
}

function textLink(href, label) {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  return link;
}

function empty(text) {
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = text;
  return p;
}

function tag(text) {
  const span = document.createElement("span");
  span.className = "tag";
  span.textContent = text;
  return span;
}

function safeHttp(url) {
  if (typeof url !== "string") return "";
  if (/^https?:\/\/[^\s]+$/.test(url)) return url;
  return "";
}

function isCommitUrl(url) {
  return typeof url === "string" && /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/commit\/[0-9a-f]{7,40}$/.test(url);
}

function formatWhen(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
