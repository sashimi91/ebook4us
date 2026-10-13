(function () {
  let book, rendition;
  let isFullScreen = false;
  let isInternalDark = false;
  let bookmarkKey = "";
  let isNavigating = false;

  // 1. Dark/Light mode toggle function
  window.applyEpubTheme = function (isDark) {
    if (typeof isDark !== "boolean") isDark = isInternalDark;

    var container = document.getElementById("epub-container");
    var viewer = document.getElementById("epub-viewer");
    var controls = document.getElementById("epub-controls");
    var progressText = document.getElementById("progress-text");
    var pageDisplay = document.getElementById("page-display");

    var fontSelect = document.getElementById("font-select");
    var tocSelect = document.getElementById("toc-select");
    var zoomIn = document.getElementById("zoom-in");
    var zoomOut = document.getElementById("zoom-out");
    var prevBtn = document.getElementById("prev-btn");
    var nextBtn = document.getElementById("next-btn");

    var bgColor = isDark ? "#1e1e1e" : "#f5f0e6";
    var controlBg = isDark ? "#2d2d2d" : "#f8fafc";
    var borderColor = isDark ? "#3f3f46" : "#e2e8f0";
    var textColor = isDark ? "#e2e8f0" : "#334155";
    var inputBg = isDark ? "#3f3f46" : "#ffffff";
    var inputBorder = isDark ? "#52525b" : "#cbd5e1";

    if (container) {
      container.style.backgroundColor = bgColor;
      container.style.borderColor = borderColor;
    }
    if (viewer) {
      viewer.style.backgroundColor = bgColor;
      viewer.style.borderColor = borderColor;
    }
    if (controls) {
      controls.style.backgroundColor = controlBg;
      controls.style.borderColor = borderColor;
      controls.style.color = textColor;
    }

    if (progressText) progressText.style.color = isDark ? "#94a3b8" : "#475569";
    if (pageDisplay) pageDisplay.style.color = isDark ? "#94a3b8" : "#475569";
    
// 🌟 Dùng Hook để tiêm thẳng CSS vào từng chương sách (bất chấp CSS gốc của file epub)
  if (typeof rendition !== "undefined" && rendition) {
    rendition.hooks.content.register(function(contents) {
      var doc = contents.document;
      
      // Kiểm tra xem đã chèn style chưa để tránh bị lặp
      if (!doc.getElementById("custom-epub-style")) {
        var style = doc.createElement("style");
        style.id = "custom-epub-style";
        style.innerHTML = `
          body {
            background-color: ${bgColor} !important;
            color: ${textColor} !important;
          }
          /* Ép các thành phần bên trong suốt nền để lộ màu nền vàng nhạt */
          p, span, div, h1, h2, h3, h4, h5, h6 {
            background-color: transparent !important;
            color: ${textColor} !important;
          }
        `;
        doc.head.appendChild(style);
      }
    });
    
    // Yêu cầu render lại giao diện ngay lập tức để nhận style mới
    rendition.timer && rendition.timer.update ? rendition.timer.update() : rendition.display();
  }

    [fontSelect, tocSelect, zoomIn, zoomOut, prevBtn, nextBtn].forEach(function (el) {
      if (el) {
        el.style.backgroundColor = inputBg;
        el.style.color = textColor;
        el.style.borderColor = inputBorder;
      }
    });

    var iframes = document.querySelectorAll("#epub-viewer iframe");
    iframes.forEach(function (iframe) {
      try {
        var doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
        if (doc) {
          var target = doc.head || doc.body || doc.documentElement;
          if (target) {
            var styleEl = doc.getElementById("epub-override-css");
            if (!styleEl) {
              styleEl = doc.createElement("style");
              styleEl.id = "epub-override-css";
              target.appendChild(styleEl);
            }
            styleEl.textContent = isDark
              ? "@page { margin: 0 !important; }" +
                "html, body { background-color: #1e1e1e !important; color: #e2e8f0 !important; line-height: 1.6 !important; margin: 0 !important; padding: 0 !important; }" +
                "html *, body * { color: #e2e8f0 !important; background-color: transparent !important; line-height: 1.6 !important; margin-left: 0 !important; margin-right: 0 !important; padding-left: 0 !important; padding-right: 0 !important; }" +
                "a, a * { color: #60a5fa !important; }" +
                "img, svg { max-width: 100% !important; height: auto !important; }"
              : "@page { margin: 0 !important; }" +
                "html, body { background-color: #ffffff !important; color: #000000 !important; line-height: 1.6 !important; margin: 0 !important; padding: 0 !important; }" +
                "html *, body * { color: #000000 !important; background-color: transparent !important; line-height: 1.6 !important; margin-left: 0 !important; margin-right: 0 !important; padding-left: 0 !important; padding-right: 0 !important; }" +
                "img, svg { max-width: 100% !important; height: auto !important; }";
          }
        }
      } catch (e) {}
    });
  };

  // 2. Smart chapter navigation (prevents queue lock on iOS WebKit)
  function goToChapter(href) {
    if (!href || !rendition || !book || isNavigating) return;
    isNavigating = true;

    var parts = href.split('#');
    var rawPath = decodeURIComponent(parts[0]).trim();
    var anchor = parts[1] ? parts[1].trim() : '';

    var cleanPath = rawPath.replace(/^(\.\.\/|\.\/)+/, '');
    var fileName = cleanPath.split('/').pop();

    var matchedItem = null;
    if (book.spine && book.spine.spineItems) {
      matchedItem = book.spine.spineItems.find(function (item) {
        var itemHref = decodeURIComponent(item.href);
        return itemHref === cleanPath ||
               itemHref.endsWith(cleanPath) ||
               cleanPath.endsWith(itemHref) ||
               itemHref.endsWith(fileName);
      });
    }

    var targetPath = matchedItem ? matchedItem.href : cleanPath;
    var fullTarget = targetPath + (anchor ? '#' + anchor : '');

    rendition.display(fullTarget).then(function () {
      if (anchor) {
        setTimeout(function () {
          try {
            var contents = rendition.getContents();
            if (contents && contents.length > 0) {
              var doc = contents[0].document || contents[0].window.document;
              if (doc) {
                var el = doc.getElementById(anchor) || doc.querySelector('[name="' + anchor + '"]');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }
            }
          } catch (e) {
            console.warn("Cannot scroll to anchor on iOS:", e);
          }
        }, 100);
      }
    }).catch(function () {
      if (matchedItem) {
        rendition.display(matchedItem.href);
      }
    }).finally(function () {
      setTimeout(function () { isNavigating = false; }, 300);
    });
  }

  // 3. Fullscreen (custom CSS)
  function toggleFullscreen(active) {
    isFullScreen = active;
    var container = document.getElementById("epub-container");
    var viewer = document.getElementById("epub-viewer");
    var fsBtn = document.getElementById("fullscreen-btn");
    var iconFS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    var iconExitFS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';

    if (!container || !viewer) return;

    if (active) {
      container.style.position = "fixed";
      container.style.top = "0";
      container.style.left = "0";
      container.style.width = "100vw";
      container.style.height = "100dvh";
      container.style.zIndex = "999999";
      container.style.borderRadius = "0";
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.padding = "0 0 10px 0";
      viewer.style.flex = "1";
      viewer.style.height = "auto";
      viewer.style.minHeight = "0";
      if (fsBtn) fsBtn.innerHTML = iconExitFS + " <span>Exit fullscreen</span>";
      document.body.style.overflow = "hidden";
    } else {
      container.style.position = "";
      container.style.top = "";
      container.style.left = "";
      container.style.width = "";
      container.style.height = "";
      container.style.zIndex = "";
      container.style.borderRadius = "8px";
      container.style.display = "";
      container.style.flexDirection = "";
      container.style.padding = "0 0 10px 0";
      viewer.style.flex = "";
      viewer.style.height = "600px";
      viewer.style.minHeight = "";
      if (fsBtn) fsBtn.innerHTML = iconFS + " <span>Fullscreen</span>";
      document.body.style.overflow = "";
    }
    window.applyEpubTheme(isInternalDark);
    setTimeout(function () {
      if (rendition) rendition.resize("100%", "100%");
    }, 100);
  }

  function exitFullScreenHandler(e) {
    if ((e.key === 'Escape' || e.keyCode === 27) && isFullScreen) {
      toggleFullscreen(false);
    }
  }

  document.addEventListener('keydown', exitFullScreenHandler);

  // 4. Main initialization
  window.initEpubReader = function (encodedUrl) {
    if (!encodedUrl) return;

    var bookUrl = atob(encodedUrl);

    bookmarkKey = "epub_pos_" + btoa(window.location.pathname + encodedUrl.slice(-20)).replace(/=/g, '');
    var savedCfi = null;
    try {
      savedCfi = localStorage.getItem(bookmarkKey);
    } catch (e) {
      console.warn("Cannot access localStorage:", e);
    }

    book = ePub(bookUrl);
    rendition = book.renderTo("epub-viewer", {
      width: "100%",
      height: "100%",
      spread: "always"
    });

    window.currentRendition = rendition;

    // Arrow key navigation (Left / Right)
    function handleArrowKeys(e) {
      var tag = e.target ? e.target.tagName.toLowerCase() : "";
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "ArrowLeft" || e.keyCode === 37 || e.key === "ArrowRight" || e.keyCode === 39) {
        if (tag === "select") {
          e.preventDefault();
          if (e.target) e.target.blur();
        }
        if (e.key === "ArrowLeft" || e.keyCode === 37) {
          rendition.prev();
        } else if (e.key === "ArrowRight" || e.keyCode === 39) {
          rendition.next();
        }
      }
    }

    document.addEventListener("keydown", handleArrowKeys);

    // Listen for keydown events inside iframe content
    rendition.hooks.content.register(function (contents) {
      contents.addStylesheet("https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,600;0,700;1,400&display=swap");

      var doc = contents.document || (contents.window && contents.window.document);
      if (!doc) return;

      window.applyEpubTheme(isInternalDark);

      doc.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); return false; }, true);
      doc.addEventListener('copy', function (e) { e.preventDefault(); e.stopPropagation(); return false; }, true);
      doc.addEventListener('keydown', function (e) {
        if (e.key === 'F12' || e.keyCode === 123) { e.preventDefault(); e.stopPropagation(); return false; }
        if (e.ctrlKey && ['u', 'U', 'c', 'C', 's', 'S', 'p', 'P'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); return false; }
        exitFullScreenHandler(e);
      }, true);
    });

    rendition.on('keydown', function (e) {
      exitFullScreenHandler(e);
      handleArrowKeys(e);
    });

    // Open book (restore bookmark, auto-clean invalid keys)
    var startPromise = savedCfi ? rendition.display(savedCfi) : rendition.display();
    startPromise.then(function () {
      rendition.themes.font("Georgia, 'Times New Roman', serif");
      window.applyEpubTheme(isInternalDark);
    }).catch(function () {
      try { localStorage.removeItem(bookmarkKey); } catch (e) {}
      rendition.display().then(function () {
        rendition.themes.font("Georgia, 'Times New Roman', serif");
        window.applyEpubTheme(isInternalDark);
      });
    });

    // Initialize positions: auto toggle generate() based on chapter count
    book.ready.then(function () {
      var totalChapters = (book.spine && book.spine.spineItems) ? book.spine.spineItems.length : 0;

      // Only generate detailed page positions if book has 200 chapters or fewer
      if (totalChapters > 0 && totalChapters <= 200) {
        return book.locations.generate(1000);
      }
    }).then(function () {
      var loc = rendition.currentLocation();
      if (loc && loc.start) updateProgress(loc);
    });

    // Load multi-level table of contents
    book.loaded.navigation.then(function (toc) {
      var select = document.getElementById("toc-select");
      if (!select) return;

      select.innerHTML = "";
      var defaultOption = document.createElement("option");
      defaultOption.text = "-- Select chapter --";
      defaultOption.value = "";
      select.appendChild(defaultOption);

      function renderTocItems(items, level) {
        if (!items) return;
        items.forEach(function (chapter) {
          var subItems = chapter.subitems || chapter.children;
          var rawHref = chapter.href ? chapter.href.trim() : "";

          if (rawHref || (subItems && subItems.length > 0)) {
            var option = document.createElement("option");
            option.text = "\u2014 ".repeat(level) + (chapter.label ? chapter.label.trim() : "");
            option.value = rawHref;
            if (!rawHref) option.disabled = true;
            select.appendChild(option);
          }

          if (subItems && subItems.length > 0) {
            renderTocItems(subItems, level + 1);
          }
        });
      }

      renderTocItems(toc.toc, 0);
    });

    // Update progress & sync TOC (auto-adapts for short & long books)
    function updateProgress(location) {
      if (!location || !location.start || isNavigating) return;

      // 1. Sync chapter dropdown (toc-select)
      var select = document.getElementById("toc-select");
      if (select && location.start.href) {
        var currentHref = decodeURIComponent(location.start.href).split('#')[0].trim();
        for (var i = 0; i < select.options.length; i++) {
          var option = select.options[i];
          if (!option.value) continue;
          var optionHref = decodeURIComponent(option.value).split('#')[0].trim();
          if (
            currentHref === optionHref ||
            currentHref.endsWith(optionHref) ||
            optionHref.endsWith(currentHref) ||
            (optionHref !== '' && currentHref.includes(optionHref))
          ) {
            select.value = option.value;
            break;
          }
        }
      }

      var progressBar = document.getElementById("progress-bar");
      var progressText = document.getElementById("progress-text");
      var pageDisplay = document.getElementById("page-display");

      // 2. If Locations have been generated (for short books)
      if (book.locations && book.locations.total && book.locations.total > 0) {
        var percent = book.locations.percentageFromCfi(location.start.cfi);
        var percentage = Math.round(percent * 100);

        if (progressBar) progressBar.style.width = percentage + "%";
        if (progressText) progressText.innerText = "Progress: " + percentage + "%";
        if (pageDisplay) pageDisplay.innerText = "Position: " + location.start.location + " / " + book.locations.total;
      }
      // 3. If no Locations (for long books > 200 chapters) -> use chapter count mode
      else if (book.spine && book.spine.spineItems && book.spine.spineItems.length > 0) {
        var currentIndex = location.start.index;
        var totalChapters = book.spine.spineItems.length;
        var currentChapterNum = currentIndex;
        var percentage = Math.round((currentChapterNum / totalChapters) * 100);

        if (progressBar) progressBar.style.width = percentage + "%";
        if (progressText) progressText.innerText = "Progress: " + percentage + "%";
        if (pageDisplay) pageDisplay.innerText = "Chapter: " + currentChapterNum + " / " + totalChapters;
      }
    }

    rendition.on("relocated", function (location) {
      updateProgress(location);
      window.applyEpubTheme(isInternalDark);

      if (location && location.start && location.start.cfi) {
        try { localStorage.setItem(bookmarkKey, location.start.cfi); } catch (err) {}
      }
    });

    ['prev-btn', 'next-btn'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) {
        btn.style.touchAction = 'manipulation';
        btn.style.webkitUserSelect = 'none';
        btn.style.userSelect = 'none';
      }
    });

    var prevBtn = document.getElementById("prev-btn");
    var nextBtn = document.getElementById("next-btn");
    var fsBtn = document.getElementById("fullscreen-btn");
    var themeBtn = document.getElementById("reader-theme-btn");
    var themeIcon = document.getElementById("theme-btn-icon");
    var themeText = document.getElementById("theme-btn-text");
    var tocSelect = document.getElementById("toc-select");
    var fontSelect = document.getElementById("font-select");
    var zoomIn = document.getElementById("zoom-in");
    var zoomOut = document.getElementById("zoom-out");
    var currentFontSize = 100;

    var iconMoon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    var iconSun = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

    if (prevBtn) prevBtn.onclick = function () { rendition.prev(); };
    if (nextBtn) nextBtn.onclick = function () { rendition.next(); };
    if (fsBtn) fsBtn.onclick = function () { toggleFullscreen(!isFullScreen); };

    if (themeBtn) {
      themeBtn.onclick = function () {
        isInternalDark = !isInternalDark;
        if (themeIcon && themeText) {
          if (isInternalDark) {
            themeIcon.innerHTML = iconSun;
            themeText.innerText = "Light mode";
            themeBtn.style.backgroundColor = "#3f3f46";
            themeBtn.style.color = "#f8fafc";
            themeBtn.style.borderColor = "#52525b";
          } else {
            themeIcon.innerHTML = iconMoon;
            themeText.innerText = "Dark mode";
            themeBtn.style.backgroundColor = "#ffffff";
            themeBtn.style.color = "#334155";
            themeBtn.style.borderColor = "#cbd5e1";
          }
        }
        window.applyEpubTheme(isInternalDark);
      };
    }

    if (tocSelect) {
      tocSelect.onchange = function (e) {
        var selectedHref = e.target.value;
        if (selectedHref) {
          e.target.blur();
          if (document.activeElement) document.activeElement.blur();
          setTimeout(function () {
            goToChapter(selectedHref);
          }, 50);
        }
      };
    }

    if (fontSelect) {
      fontSelect.onchange = function (e) {
        rendition.themes.font(e.target.value);
      };
    }

    if (zoomIn) {
      zoomIn.onclick = function () {
        currentFontSize = Math.min(currentFontSize + 10, 200);
        rendition.themes.fontSize(currentFontSize + "%");
        var fontDisplay = document.getElementById("font-size-display");
        if (fontDisplay) fontDisplay.innerText = currentFontSize + "%";
      };
    }

    if (zoomOut) {
      zoomOut.onclick = function () {
        currentFontSize = Math.max(currentFontSize - 10, 70);
        rendition.themes.fontSize(currentFontSize + "%");
        var fontDisplay = document.getElementById("font-size-display");
        if (fontDisplay) fontDisplay.innerText = currentFontSize + "%";
      };
    }
  };

  // Auto-inject responsive CSS for chapter select dropdown
  var readerStyle = document.createElement("style");
  readerStyle.textContent = `
    #toc-select { max-width: 180px !important; }
    @media (min-width: 768px) { #toc-select { max-width: 310px !important; } }
  `;
  document.head.appendChild(readerStyle);

})();
