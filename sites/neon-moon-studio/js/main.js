(function () {
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  var panel = document.getElementById("site-nav");
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

  function plates() {
    return Array.prototype.slice.call(document.querySelectorAll(".plate"));
  }

  function visiblePlates() {
    return plates().filter(function (plate) {
      return !plate.hidden;
    });
  }

  function setMenu(open) {
    if (!toggle || !panel) return;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.textContent = open ? "Close" : "Menu";
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
    document.addEventListener("click", function (event) {
      if (!panel.classList.contains("is-open")) return;
      if (panel.contains(event.target) || toggle.contains(event.target)) return;
      setMenu(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && panel.classList.contains("is-open")) setMenu(false);
    });
  }

  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 4);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function applyFilter(filter) {
    plates().forEach(function (plate) {
      var link = plate.querySelector("a");
      var tags = link ? (link.getAttribute("data-tags") || "").split(",") : [];
      plate.hidden = filter !== "all" && tags.indexOf(filter) === -1;
    });
    if (filterStatus) {
      var count = visiblePlates().length;
      filterStatus.textContent = count === 0
        ? "No pieces in this set."
        : "Showing " + count + (count === 1 ? " piece" : " pieces");
    }
    if (dialog && dialog.open) dialog.close();
  }

  filterButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var filter = button.getAttribute("data-filter");
      filterButtons.forEach(function (other) {
        other.setAttribute("aria-pressed", other === button ? "true" : "false");
      });
      applyFilter(filter);
    });
  });

  function showSlide(index) {
    var current = visiblePlates();
    if (!current.length || !dialog || !lbImage) return;
    openIndex = (index + current.length) % current.length;
    var plate = current[openIndex];
    var link = plate.querySelector("a");
    var img = plate.querySelector("img");
    lbImage.src = link ? link.getAttribute("href") : "";
    lbImage.alt = img ? img.alt : "";
    if (img) {
      lbImage.width = img.width;
      lbImage.height = img.height;
    }
    lbTitle.textContent = link ? (link.getAttribute("data-title") || "") : "";
    lbCaption.textContent = link ? (link.getAttribute("data-caption") || "") : "";
    lbCount.textContent = (openIndex + 1) + " of " + current.length;
  }

  function openLightbox(plate) {
    if (!dialog || typeof dialog.showModal !== "function") return;
    var current = visiblePlates();
    var index = current.indexOf(plate);
    if (index < 0) return;
    showSlide(index);
    if (!dialog.open) dialog.showModal();
  }

  plates().forEach(function (plate) {
    var link = plate.querySelector("a");
    if (!link) return;
    link.addEventListener("click", function (event) {
      if (!dialog || typeof dialog.showModal !== "function") return;
      event.preventDefault();
      openLightbox(plate);
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
    var touchX = null;
    var touchY = null;
    dialog.addEventListener("touchstart", function (event) {
      if (!event.changedTouches || !event.changedTouches.length) return;
      touchX = event.changedTouches[0].clientX;
      touchY = event.changedTouches[0].clientY;
    }, { passive: true });
    dialog.addEventListener("touchend", function (event) {
      if (touchX == null || !event.changedTouches || !event.changedTouches.length) return;
      var dx = event.changedTouches[0].clientX - touchX;
      var dy = event.changedTouches[0].clientY - touchY;
      touchX = null;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) showSlide(openIndex + 1);
      else showSlide(openIndex - 1);
    }, { passive: true });
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
      if (typeof form.reportValidity === "function" && !form.reportValidity()) return;
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
})();
