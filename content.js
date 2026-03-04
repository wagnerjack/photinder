(() => {
  // State
  let active = false;
  let photos = [];
  let currentIndex = 0;
  let deletedCount = 0;
  let history = []; // tracks actions: { index, action: "keep"|"delete" }
  let seenHrefs = new Set(); // track already-swiped photos across batches
  let overlayEl = null;

  // ---- DOM Discovery ----

  function scanPhotos() {
    const items = [];

    // Find all photo links — individual photos are <a> tags linking to /photo/
    const photoLinks = document.querySelectorAll('a[href*="/photo/"]');

    for (const link of photoLinks) {
      // The checkbox is a sibling in the same parent container
      const container = link.parentElement;
      if (!container) continue;

      // Skip photos we've already swiped through
      const href = link.href;
      if (seenHrefs.has(href)) continue;

      const checkbox = container.querySelector('[role="checkbox"]');
      if (!checkbox) continue;

      // Thumbnail is a CSS background-image on a div inside the link or container
      let thumbnailSrc = null;
      const allDivs = container.querySelectorAll("div");
      for (const div of allDivs) {
        const bg = div.style.backgroundImage;
        if (bg && bg.includes("usercontent.google.com")) {
          // Extract URL from url("...")
          const match = bg.match(/url\("?([^")]+)"?\)/);
          if (match) {
            thumbnailSrc = match[1];
            break;
          }
        }
      }

      items.push({
        checkbox,
        container,
        link,
        thumbnailSrc,
        label: link.ariaLabel || "",
      });
    }

    console.log("[Photinder] Found " + items.length + " photo(s)");
    return items;
  }

  function getEnlargedUrl(src) {
    if (!src) return "";
    // Google Photos thumbnail URLs end with size params like =w108-h234-no?authuser=0
    // Replace the size params with larger dimensions
    return src.replace(/=w\d+-h\d+[^?]*/, "=w1600-h1000-no");
  }

  // ---- Overlay ----

  function createOverlay() {
    if (overlayEl) overlayEl.remove();

    const overlay = document.createElement("div");
    overlay.id = "pt-overlay";
    overlay.innerHTML = `
      <div id="pt-backdrop"></div>
      <div id="pt-header">
        <span id="pt-progress-text">Photo 1 of 0</span>
        <span id="pt-delete-count">0 selected for deletion</span>
        <button id="pt-close-btn" title="Close (Esc)">&times;</button>
      </div>
      <div id="pt-progress-bar">
        <div id="pt-progress-fill" style="width: 0%"></div>
      </div>
      <div id="pt-photo-container">
        <img id="pt-photo" src="" alt="Photo" />
      </div>
      <div id="pt-actions">
        <button id="pt-undo-btn" class="pt-action-btn pt-undo-btn">
          <span class="pt-kbd">U / Z</span> Undo
        </button>
        <button id="pt-delete-btn" class="pt-action-btn">
          <span class="pt-kbd">D / &larr;</span> Delete
        </button>
        <button id="pt-keep-btn" class="pt-action-btn">
          Keep <span class="pt-kbd">K / &rarr;</span>
        </button>
      </div>
      <div id="pt-end-message">
        <h2>Batch Complete!</h2>
        <p id="pt-end-summary"></p>
        <p>Selected photos are now checked in Google Photos.</p>
        <button class="pt-action-btn" id="pt-load-more-btn" style="background:#8ab4f8;color:#202124">Load More Photos</button>
        <button class="pt-action-btn" id="pt-done-btn" style="background:#e8eaed;color:#202124;margin-top:8px">Done</button>
      </div>
    `;

    document.body.appendChild(overlay);
    overlayEl = overlay;

    // Event listeners
    overlay
      .querySelector("#pt-close-btn")
      .addEventListener("click", stopTriage);
    overlay.querySelector("#pt-backdrop").addEventListener("click", stopTriage);
    overlay
      .querySelector("#pt-keep-btn")
      .addEventListener("click", () => triageAction("keep"));
    overlay.querySelector("#pt-undo-btn").addEventListener("click", undoAction);
    overlay
      .querySelector("#pt-delete-btn")
      .addEventListener("click", () => triageAction("delete"));
    overlay
      .querySelector("#pt-load-more-btn")
      .addEventListener("click", loadMorePhotos);
    overlay.querySelector("#pt-done-btn").addEventListener("click", stopTriage);

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyBlock, true);
  }

  function removeOverlay() {
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
    // Defer listener removal so the current event is fully consumed
    // before Google Photos' own handlers can fire
    setTimeout(() => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", onKeyBlock, true);
    }, 0);
  }

  // Block keyup events from reaching Google Photos while overlay is active
  function onKeyBlock(e) {
    if (!active && !overlayEl) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  function onKeyDown(e) {
    if (!active) return;

    // Don't capture if user is typing in an input
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    switch (e.key) {
      case "k":
      case "K":
      case "ArrowRight":
        e.preventDefault();
        e.stopImmediatePropagation();
        triageAction("keep");
        break;
      case "d":
      case "D":
      case "ArrowLeft":
        e.preventDefault();
        e.stopImmediatePropagation();
        triageAction("delete");
        break;
      case "u":
      case "U":
      case "z":
      case "Z":
        e.preventDefault();
        e.stopImmediatePropagation();
        undoAction();
        break;
      case "Escape":
        e.preventDefault();
        e.stopImmediatePropagation();
        stopTriage();
        break;
    }
  }

  function updateOverlayUI() {
    if (!overlayEl) return;

    const total = photos.length;
    const progressText = overlayEl.querySelector("#pt-progress-text");
    const deleteCount = overlayEl.querySelector("#pt-delete-count");
    const progressFill = overlayEl.querySelector("#pt-progress-fill");
    const photoImg = overlayEl.querySelector("#pt-photo");
    const actionsEl = overlayEl.querySelector("#pt-actions");
    const photoContainer = overlayEl.querySelector("#pt-photo-container");
    const endMessage = overlayEl.querySelector("#pt-end-message");

    if (currentIndex >= total) {
      // Done
      actionsEl.style.display = "none";
      photoContainer.style.display = "none";
      endMessage.style.display = "flex";
      endMessage.querySelector("#pt-end-summary").textContent =
        `Reviewed ${total} photos. ${deletedCount} selected for deletion.`;
      progressFill.style.width = "100%";
      progressText.textContent = `Done — ${total} photos reviewed`;
      deleteCount.textContent = `${deletedCount} selected for deletion`;
      return;
    }

    actionsEl.style.display = "flex";
    photoContainer.style.display = "flex";
    endMessage.style.display = "none";

    progressText.textContent = `Photo ${currentIndex + 1} of ${total}`;
    deleteCount.textContent = `${deletedCount} selected for deletion`;
    const pct = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;
    progressFill.style.width = pct + "%";

    const photo = photos[currentIndex];
    if (photo.thumbnailSrc) {
      photoImg.src = getEnlargedUrl(photo.thumbnailSrc);
      photoImg.style.opacity = "1";
    } else {
      photoImg.src = "";
      photoImg.alt = "No preview available";
      photoImg.style.opacity = "0.3";
    }

    // Scroll the photo into view in the background grid
    try {
      photo.container.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      // Element might have been virtualized away
    }
  }

  // ---- Triage Actions ----

  function triageAction(action) {
    if (!active || currentIndex >= photos.length) return;

    const photo = photos[currentIndex];

    if (action === "delete") {
      // Click the checkbox to select this photo for deletion
      try {
        photo.checkbox.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );
        deletedCount++;
      } catch (err) {
        console.error("[Photinder] Failed to click checkbox:", err);
      }
      flashEffect("delete");
    } else {
      flashEffect("keep");
    }

    // Mark this photo as seen
    seenHrefs.add(photo.link.href);
    history.push({ index: currentIndex, action });
    currentIndex++;
    // Small delay to let the flash animation play and checkbox register
    setTimeout(() => updateOverlayUI(), 200);
  }

  function undoAction() {
    if (!active || history.length === 0) return;

    const last = history.pop();

    // If the last action was delete, uncheck the photo
    if (last.action === "delete") {
      const photo = photos[last.index];
      try {
        photo.checkbox.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );
        deletedCount--;
      } catch (err) {
        console.error("[Photinder] Failed to undo checkbox:", err);
      }
    }

    currentIndex = last.index;
    updateOverlayUI();
  }

  function flashEffect(type) {
    if (!overlayEl) return;
    const cls = type === "keep" ? "pt-flash-keep" : "pt-flash-delete";
    overlayEl.classList.add(cls);
    setTimeout(() => overlayEl.classList.remove(cls), 300);
  }

  // ---- Load More ----

  async function loadMorePhotos() {
    if (!overlayEl) return;

    const btn = overlayEl.querySelector("#pt-load-more-btn");
    btn.textContent = "Scrolling...";
    btn.disabled = true;

    // Hide overlay temporarily so the page can scroll
    overlayEl.style.display = "none";

    // Scroll down to trigger Google Photos to load more
    const scrollEl = document.scrollingElement || document.documentElement;
    const prevHeight = scrollEl.scrollHeight;
    scrollEl.scrollTop = scrollEl.scrollHeight;

    // Wait for new content to render, retry a few times
    let newPhotos = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((r) => setTimeout(r, 800));
      newPhotos = scanPhotos();
      if (newPhotos.length > 0) break;
      // Scroll again in case more needs loading
      scrollEl.scrollTop = scrollEl.scrollHeight;
    }

    overlayEl.style.display = "flex";
    btn.textContent = "Load More Photos";
    btn.disabled = false;

    if (newPhotos.length === 0) {
      const summary = overlayEl.querySelector("#pt-end-summary");
      summary.textContent += " No more photos found.";
      return;
    }

    // Append new photos and continue swiping
    photos = photos.concat(newPhotos);
    const endMessage = overlayEl.querySelector("#pt-end-message");
    endMessage.style.display = "none";
    updateOverlayUI();
  }

  // ---- Start / Stop ----

  function startTriage() {
    photos = scanPhotos();

    if (photos.length === 0) {
      return {
        error:
          "No photos found on this page. Make sure you're on photos.google.com with photos visible.",
      };
    }

    active = true;
    currentIndex = 0;
    deletedCount = 0;
    history = [];
    seenHrefs = new Set();

    createOverlay();
    updateOverlayUI();

    return getStatus();
  }

  function stopTriage() {
    active = false;
    removeOverlay();
    return getStatus();
  }

  function getStatus() {
    return {
      active,
      current: currentIndex + 1,
      total: photos.length,
      deleted: deletedCount,
    };
  }

  // ---- Message Handling ----

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.action) {
      case "toggleTriage":
        if (active) {
          sendResponse(stopTriage());
        } else {
          sendResponse(startTriage());
        }
        break;
      default:
        sendResponse({ error: "Unknown action" });
    }
    return true;
  });
})();
