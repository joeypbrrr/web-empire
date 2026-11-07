function makePlate(piece, index) {
  var fig = document.createElement("figure");
  fig.className = "plate";
  fig.id = "piece-" + piece.id;
  if (piece.lead) fig.classList.add("lead");
  if (piece.span) fig.classList.add("span-" + piece.span);
  if (piece.offset) fig.classList.add("offset");
  if (piece.drop) fig.classList.add("drop");
  if (piece.bleed) fig.classList.add("bleed");

  var link = document.createElement("a");
  link.href = piece.src;
  link.setAttribute("data-tags", (piece.tags || []).join(","));
  link.setAttribute("data-title", piece.title || "");
  link.setAttribute("data-caption", piece.caption || "");

  var shot = document.createElement("span");
  shot.className = "shot";

  var img = document.createElement("img");
  img.src = piece.src;
  if (piece.srcset) img.srcset = piece.srcset;
  img.sizes = piece.lead
    ? "(min-width: 900px) 48vw, 100vw"
    : "(min-width: 1024px) 36vw, (min-width: 720px) 46vw, 100vw";
  img.width = piece.width;
  img.height = piece.height;
  img.alt = piece.alt || "";
  if (piece.lead) {
    img.setAttribute("fetchpriority", "high");
  } else {
    img.loading = "lazy";
    img.decoding = "async";
  }
  shot.appendChild(img);

  if (piece.offset) {
    var frame = document.createElement("span");
    frame.className = "misreg";
    frame.setAttribute("aria-hidden", "true");
    shot.appendChild(frame);
  }

  var cap = document.createElement("figcaption");
  var num = document.createElement("span");
  num.className = "num";
  num.textContent = String(index + 1).padStart(2, "0");
  var title = document.createElement("span");
  title.className = "t";
  title.textContent = piece.title || "";
  var kicker = document.createElement("span");
  kicker.className = "k";
  kicker.textContent = piece.kicker || "";
  cap.appendChild(num);
  cap.appendChild(title);
  cap.appendChild(kicker);

  link.appendChild(shot);
  link.appendChild(cap);
  fig.appendChild(link);
  return fig;
}

function renderLead() {
  var slot = document.getElementById("lead-slot");
  var pieces = window.PORTFOLIO || [];
  if (!slot || !pieces.length) return;
  var index = 0;
  for (var i = 0; i < pieces.length; i++) {
    if (pieces[i].lead) {
      index = i;
      break;
    }
  }
  slot.textContent = "";
  slot.appendChild(makePlate(pieces[index], index));
}

function renderGrid() {
  var grid = document.getElementById("plates");
  var pieces = window.PORTFOLIO || [];
  if (!grid) return;
  grid.textContent = "";
  pieces.forEach(function (piece, index) {
    if (piece.lead) return;
    grid.appendChild(makePlate(piece, index));
  });
  var status = document.getElementById("filter-status");
  if (status) {
    var count = pieces.length;
    status.textContent = "Showing " + count + (count === 1 ? " piece" : " pieces");
  }
}
