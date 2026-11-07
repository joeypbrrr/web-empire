(function () {
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  var panel = document.getElementById("site-nav");
  var tiles = Array.prototype.slice.call(document.querySelectorAll(".tile"));
  var filterButtons = Array.prototype.slice.call(document.querySelectorAll("[data-filter]"));
  var filterStatus = document.getElementById("filter-status");
  var dialog = document.getElementById("lightbox");
  var lbImage = document.getElementById("lb-image");
  var lbTitle = document.getElementById("lb-title");
  var lbCaption = document.getElementById("lb-caption");
  var lbCount = document.getElementById("lb-count");
  var form = document.getElementById("demo-form");
  var formSuccess = document.getElementById("form-success");
  var formReset = document.getElementById("form-reset");
  var openIndex = 0;

  function visibleTiles() {
    return tiles.filter(function (tile) {
      return !tile.hidden;
    });
  }

  function setMenu(open) {
    if (!toggle || !panel) return;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    panel.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
  }

  if (toggle && panel) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    panel.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setMenu(false);
      });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setMenu(false);
    });
  }

  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  filterButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var filter = button.getAttribute("data-filter");
      filterButtons.forEach(function (other) {
        other.setAttribute("aria-pressed", other === button ? "true" : "false");
      });
      tiles.forEach(function (tile) {
        var tags = (tile.getAttribute("data-tags") || "").split(",");
        tile.hidden = filter !== "all" && tags.indexOf(filter) === -1;
      });
      if (filterStatus) {
        var count = visibleTiles().length;
        filterStatus.textContent = "Showing " + count + (count === 1 ? " piece" : " pieces");
      }
      if (dialog && dialog.open) dialog.close();
    });
  });

  function showSlide(index) {
    var current = visibleTiles();
    if (!current.length || !dialog || !lbImage) return;
    openIndex = (index + current.length) % current.length;
    var tile = current[openIndex];
    var full = tile.getAttribute("href");
    var img = tile.querySelector("img");
    lbImage.src = full;
    lbImage.alt = img ? img.alt : "";
    lbTitle.textContent = tile.getAttribute("data-title") || "";
    lbCaption.textContent = tile.getAttribute("data-caption") || "";
    lbCount.textContent = (openIndex + 1) + " of " + current.length;
  }

  function openLightbox(tile) {
    if (!dialog || typeof dialog.showModal !== "function") return;
    var current = visibleTiles();
    var index = current.indexOf(tile);
    if (index < 0) return;
    showSlide(index);
    if (!dialog.open) dialog.showModal();
  }

  tiles.forEach(function (tile) {
    tile.addEventListener("click", function (event) {
      if (!dialog || typeof dialog.showModal !== "function") return;
      event.preventDefault();
      openLightbox(tile);
    });
  });

  document.querySelectorAll("[data-open-lightbox]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      var id = link.getAttribute("data-open-lightbox");
      var tile = document.getElementById(id);
      if (!tile || !dialog || typeof dialog.showModal !== "function") return;
      event.preventDefault();
      if (tile.hidden) {
        var allButton = document.querySelector('[data-filter="all"]');
        if (allButton) allButton.click();
      }
      openLightbox(tile);
    });
  });

  if (dialog) {
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("keydown", function (event) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        showSlide(openIndex + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        showSlide(openIndex - 1);
      }
    });
    var prev = document.getElementById("lb-prev");
    var next = document.getElementById("lb-next");
    var closeBtn = document.getElementById("lb-close");
    if (prev) prev.addEventListener("click", function () { showSlide(openIndex - 1); });
    if (next) next.addEventListener("click", function () { showSlide(openIndex + 1); });
    if (closeBtn) closeBtn.addEventListener("click", function () { dialog.close(); });
  }

  if (form && formSuccess) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      form.hidden = true;
      formSuccess.hidden = false;
      formSuccess.focus();
    });
  }

  if (formReset && form && formSuccess) {
    formReset.addEventListener("click", function () {
      form.reset();
      formSuccess.hidden = true;
      form.hidden = false;
      var first = form.querySelector("input, textarea, select");
      if (first) first.focus();
    });
  }

  var revealNodes = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealNodes.length) {
    document.documentElement.classList.add("js");
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    revealNodes.forEach(function (node) { observer.observe(node); });
  }
})();
