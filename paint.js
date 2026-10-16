// Builds the Paint window around the page's <main> content and makes the
// toolbox work: you can draw on top of the page, highlight and recolor text,
// zoom, fill, pick colors, undo (Ctrl+Z), minimize and close.
(function () {
  var COLORS = ["#000000", "#808080", "#800000", "#808000", "#008000", "#008080", "#000080",
    "#800080", "#657a62", "#004040", "#0080ff", "#004080", "#8000ff", "#804000",
    "#ffffff", "#c0c0c0", "#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff",
    "#ff00ff", "#ffff80", "#00ff80", "#80ffff", "#8080ff", "#ff0080", "#ff8040"];
  var TOOLS = [
    ["freeselect", "✂", "Free-Form Select: browse the page. Click a color to repaint the page."],
    ["select", "⬚", "Select: browse the page. Click a color to repaint the page."],
    ["eraser", "⌫", "Eraser: drag to erase your drawing."],
    ["fill", "🪣", "Fill With Color: fill a shape, or click empty paper to recolor it."],
    ["pick", "💉", "Pick Color: click anything to grab its color."],
    ["zoom", "🔍", "Magnifier: click to zoom in or out."],
    ["pencil", "✏", "Pencil: drag to draw a thin line."],
    ["brush", "🖌", "Brush: drag to paint."],
    ["airbrush", "💨", "Airbrush: hold to spray paint."],
    ["text", "A", "Text: select words on the page to highlight them."],
    ["line", "╲", "Line: drag to draw a straight line."],
    ["curve", "∿", "Curve: drag a line, then drag again to bend it."],
    ["rect", "▭", "Rectangle: drag to draw a rectangle."],
    ["polygon", "⬠", "Polygon: drag the first side, click for more, double-click to close."],
    ["ellipse", "◯", "Ellipse: drag to draw an ellipse."],
    ["rounded", "▢", "Rounded Rectangle: drag to draw a rounded rectangle."]
  ];
  var BROWSE = { freeselect: 1, select: 1, text: 1 };
  var WIDTHS = [1, 3, 5];

  var page = document.body.dataset.page;
  var file = page === "about" ? "tairan_habib.bmp" : page === "draw" ? "untitled.bmp" : page + ".bmp";
  var drawn = false;
  var main = document.querySelector("main");

  function nav(href, label, key) {
    var ext = /^http/.test(href) ? ' target="_blank" rel="noopener"' : "";
    return '<a href="' + href + '"' + ext + (key === page ? ' class="active"' : "") + ">" + label + "</a>";
  }

  var win = document.createElement("div");
  win.className = "window";
  win.innerHTML =
    '<div class="titlebar"><span class="title"><span class="icon"></span>' + file + " - Paint</span>" +
    '<span class="controls"><button data-act="min" aria-label="Minimize">_</button><button data-act="max" aria-label="Full screen">□</button><button data-act="close" aria-label="Close">×</button></span></div>' +
    '<nav class="menubar">' +
      nav("index.html", "About", "about") +
      nav("experience.html", "Experience", "experience") +
      nav("projects.html", "Projects", "projects") +
      nav("draw.html", "Doodle", "draw") +
      '<span class="spacer"></span>' + (page === "draw" ? '<a href="gallery.html" title="See doodles other people sent in">Gallery</a><button data-act="submit" title="Send your doodle to the gallery (shows up after a quick review)">Submit</button><button data-act="save" title="Download your doodle as a PNG">Save Image</button>' : "") + '<button data-act="clear" title="Erase everything drawn on this page">Erase Drawing</button>' +
    "</nav>" +
    '<div class="workspace"><div class="toolbox">' +
      TOOLS.map(function (t) { return '<button data-tool="' + t[0] + '" title="' + t[2].split(":")[0] + '">' + t[1] + "</button>"; }).join("") +
      '<div class="well">' + WIDTHS.map(function (w, i) { return '<span data-w="' + i + '" style="height:' + (w + 1) + 'px"></span>'; }).join("") + "</div>" +
    '</div><div class="canvas-frame"></div></div>' +
    '<div class="palette"><div class="current" title="Left click a color to draw with it, right click for the second color"><span class="fg"></span><span class="bg"></span></div><div class="swatches">' +
      COLORS.map(function (c) { return '<button style="background:' + c + '" data-c="' + c + '" aria-label="color ' + c + '"></button>'; }).join("") +
    "</div></div>" +
    '<div class="statusbar"><div class="hint"></div><div class="xy">&nbsp;</div></div>';

  main.classList.add("canvas");
  document.body.classList.add("page-" + page);
  var frame = win.querySelector(".canvas-frame");
  frame.appendChild(main);
  document.body.appendChild(win);

  var layer = document.createElement("canvas");
  layer.className = "layer";
  main.appendChild(layer);
  var ctx = layer.getContext("2d");
  var hint = win.querySelector(".hint");
  var xy = win.querySelector(".xy");

  var state = { tool: "select", fg: "#000000", bg: "#ffffff", w: 1, zoom: 1 };
  var touch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  // keep the drawing layer small enough for phones: big canvases (and undo copies of them)
  // run phones out of memory and the tab goes blank
  var MAX_PX = touch ? 3e6 : 6e6;
  var UNDO_MAX = touch ? 4 : 12;
  var dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  var built = false, hasInk = false;
  layer.width = layer.height = 0;

  // ----- layer sizing (only built once someone picks a drawing tool) -----
  function sizeLayer() {
    var w = main.clientWidth, h = main.scrollHeight;
    // lower the resolution (never the size) so long pages stay under the memory cap
    var nd = Math.max(0.5, Math.min(dpr, Math.sqrt(MAX_PX / (w * h))));
    built = true;
    if (layer.width === Math.round(w * nd) && layer.height === Math.round(h * nd)) return;
    var old = null;
    if (hasInk) {
      old = document.createElement("canvas");
      old.width = layer.width; old.height = layer.height;
      old.getContext("2d").drawImage(layer, 0, 0);
    }
    var scale = nd / dpr;
    dpr = nd;
    layer.width = Math.round(w * dpr);
    layer.height = Math.round(h * dpr);
    layer.style.width = w + "px";
    layer.style.height = h + "px";
    if (old) ctx.drawImage(old, 0, 0, old.width * scale, old.height * scale);
    if (scale !== 1 && undo) undo.length = 0;
    hasInk = true;
  }
  function sizeIfUsed() { if (built) sizeLayer(); }
  window.addEventListener("resize", sizeIfUsed);
  window.addEventListener("load", sizeIfUsed);

  function pos(e) {
    var r = layer.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (layer.width / r.width), y: (e.clientY - r.top) * (layer.height / r.height) };
  }

  // ----- undo -----
  var undo = [];
  function save() {
    drawn = true;
    undo.push({ img: ctx.getImageData(0, 0, layer.width, layer.height), paper: main.style.background });
    if (undo.length > UNDO_MAX) undo.shift();
  }
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && undo.length) {
      e.preventDefault();
      var u = undo.pop();
      sizeLayer();
      ctx.putImageData(u.img, 0, 0);
      main.style.background = u.paper;
    }
  });

  // ----- toolbox, widths, palette -----
  function setTool(name) {
    state.tool = name;
    poly = null; curve = null;
    win.querySelectorAll("[data-tool]").forEach(function (b) { b.classList.toggle("on", b.dataset.tool === name); });
    main.classList.toggle("drawing", !BROWSE[name]);
    if (!BROWSE[name]) sizeLayer();
    var t = TOOLS.filter(function (t) { return t[0] === name; })[0];
    hint.textContent = t[2] + (touch && !BROWSE[name] ? " (Pick Select ⬚ to scroll.)" : "");
  }
  function setWidth(i) {
    state.w = i;
    win.querySelectorAll("[data-w]").forEach(function (s) { s.classList.toggle("on", +s.dataset.w === i); });
  }
  function showColors() {
    win.querySelector(".current .fg").style.background = state.fg;
    win.querySelector(".current .bg").style.background = state.bg;
  }
  win.querySelector(".toolbox").addEventListener("click", function (e) {
    var b = e.target.closest("[data-tool]");
    if (b) setTool(b.dataset.tool);
    var s = e.target.closest("[data-w]");
    if (s) setWidth(+s.dataset.w);
  });

  var swatches = win.querySelector(".swatches");
  // keep the text selection alive when clicking a color
  swatches.addEventListener("mousedown", function (e) { e.preventDefault(); });
  function pickSwatch(e, which) {
    var c = e.target.dataset && e.target.dataset.c;
    if (!c) return;
    e.preventDefault();
    state[which] = c;
    showColors();
    if (which === "fg" && hasSelection()) styleSelection("foreColor", c);
    else if (which === "fg" && (state.tool === "select" || state.tool === "freeselect")) setAccent(c, true);
  }

  // ----- page accent color (headings, rules, tags); starts green, palette can change it -----
  // only accept colors that stay readable as heading text on white (WCAG 3:1 for large text)
  function contrastOnWhite(hex) {
    var n = parseInt(hex.slice(1), 16);
    var lum = [n >> 16, (n >> 8) & 255, n & 255].map(function (v) {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    var L = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
    return 1.05 / (L + 0.05);
  }
  function setAccent(c, remember) {
    if (contrastOnWhite(c) < 3) { hint.textContent = "That color is too light to read on white. Try a darker one."; return; }
    document.documentElement.style.setProperty("--ink", c);
    if (remember) { try { localStorage.setItem("accent", c); } catch (err) {} }
  }
  try { var savedAccent = localStorage.getItem("accent"); if (savedAccent) setAccent(savedAccent); } catch (err) {}
  swatches.addEventListener("click", function (e) { pickSwatch(e, "fg"); });
  swatches.addEventListener("contextmenu", function (e) { pickSwatch(e, "bg"); });

  // ----- text: highlight and recolor selected words -----
  function hasSelection() {
    var s = window.getSelection();
    return s && !s.isCollapsed && main.contains(s.anchorNode) && main.contains(s.focusNode);
  }
  function styleSelection(cmd, color) {
    main.contentEditable = "true";
    document.execCommand("styleWithCSS", false, true);
    document.execCommand(cmd, false, color);
    main.contentEditable = "false";
    sizeLayer();
  }
  main.addEventListener("mouseup", function () {
    if (state.tool === "text" && hasSelection()) {
      styleSelection("hiliteColor", state.fg);
      window.getSelection().removeAllRanges();
    }
  });

  // ----- drawing -----
  var drawing = null, poly = null, curve = null, spray = null;

  function width() {
    var k = state.tool;
    var base = WIDTHS[state.w];
    if (k === "pencil") return 1.5 * dpr;
    if (k === "brush") return (4 + base * 3) * dpr;
    if (k === "eraser") return (10 + base * 6) * dpr;
    return (base + 1) * dpr;
  }
  function stroke(color) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width();
    ctx.lineCap = state.tool === "eraser" ? "square" : "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = state.tool === "eraser" ? "destination-out" : "source-over";
  }
  function shape(kind, a, b) {
    ctx.beginPath();
    var x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    if (kind === "line") { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    else if (kind === "rect") ctx.rect(x, y, w, h);
    else if (kind === "ellipse") ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    else if (kind === "rounded") {
      var r = Math.min(12 * dpr, w / 2, h / 2);
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    ctx.stroke();
  }
  function snapshot() { return ctx.getImageData(0, 0, layer.width, layer.height); }

  function sprayAt(p, color) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = color;
    var r = (6 + WIDTHS[state.w] * 3) * dpr;
    for (var i = 0; i < 14; i++) {
      var a = Math.random() * Math.PI * 2, d = Math.random() * r;
      ctx.fillRect(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, dpr, dpr);
    }
  }

  function floodFill(p, hex) {
    var W = layer.width, H = layer.height;
    var img = ctx.getImageData(0, 0, W, H), d = img.data;
    var sx = Math.floor(p.x), sy = Math.floor(p.y), si = (sy * W + sx) * 4;
    var target = [d[si], d[si + 1], d[si + 2], d[si + 3]];
    var n = parseInt(hex.slice(1), 16), fill = [n >> 16, (n >> 8) & 255, n & 255, 255];
    if (target.join() === fill.join()) return;
    function match(i) {
      return Math.abs(d[i] - target[0]) < 40 && Math.abs(d[i + 1] - target[1]) < 40 &&
        Math.abs(d[i + 2] - target[2]) < 40 && Math.abs(d[i + 3] - target[3]) < 60;
    }
    var stack = [sx, sy], edge = false;
    while (stack.length) {
      if (edge && target[3] === 0) return false;
      var y = stack.pop(), x = stack.pop();
      var i = (y * W + x) * 4;
      while (x >= 0 && match(i)) { x--; i -= 4; }
      x++; i += 4;
      if (x === 0 || y === 0 || y === H - 1) edge = true;
      var up = false, down = false;
      while (x < W && match(i)) {
        d[i] = fill[0]; d[i + 1] = fill[1]; d[i + 2] = fill[2]; d[i + 3] = 255;
        if (y > 0) { var u = match(i - W * 4); if (u && !up) { stack.push(x, y - 1); } up = u; }
        if (y < H - 1) { var dn = match(i + W * 4); if (dn && !down) { stack.push(x, y + 1); } down = dn; }
        x++; i += 4;
      }
      if (x === W) edge = true;
    }
    // an open area (not enclosed by a drawing) recolors the paper instead
    if (edge && target[3] === 0) return false;
    ctx.putImageData(img, 0, 0);
    return true;
  }

  function toHex(rgb) {
    var m = rgb.match(/\d+(\.\d+)?/g);
    if (!m) return null;
    if (m.length > 3 && +m[3] === 0) return null;
    return "#" + m.slice(0, 3).map(function (v) { return (+v).toString(16).padStart(2, "0"); }).join("");
  }
  function pickColor(e, p) {
    var px = ctx.getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data;
    if (px[3] > 0) return toHex("rgb(" + px[0] + "," + px[1] + "," + px[2] + ")");
    layer.style.pointerEvents = "none";
    var el = document.elementFromPoint(e.clientX, e.clientY);
    layer.style.pointerEvents = "";
    if (!el) return null;
    if (el.tagName === "IMG") {
      var c = document.createElement("canvas"), r = el.getBoundingClientRect();
      c.width = r.width; c.height = r.height;
      var cx = c.getContext("2d");
      cx.drawImage(el, 0, 0, r.width, r.height);
      var q = cx.getImageData(e.clientX - r.left, e.clientY - r.top, 1, 1).data;
      return toHex("rgb(" + q[0] + "," + q[1] + "," + q[2] + ")");
    }
    if (el === main) return toHex(getComputedStyle(main).backgroundColor) || "#ffffff";
    return toHex(getComputedStyle(el).color);
  }

  layer.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  // on phones, a finger drag on the canvas should draw, never scroll the page
  function noScroll(e) { if (main.classList.contains("drawing")) e.preventDefault(); }
  layer.addEventListener("touchstart", noScroll, { passive: false });
  layer.addEventListener("touchmove", noScroll, { passive: false });

  layer.addEventListener("pointerdown", function (e) {
    sizeLayer();
    var p = pos(e), color = e.button === 2 ? state.bg : state.fg, k = state.tool;
    layer.setPointerCapture(e.pointerId);

    if (k === "zoom") {
      state.zoom = state.zoom === 1 ? 2 : 1;
      var fx = (e.clientX - frame.getBoundingClientRect().left + frame.scrollLeft) / frame.scrollWidth;
      var fy = (e.clientY - frame.getBoundingClientRect().top + frame.scrollTop) / frame.scrollHeight;
      main.style.zoom = state.zoom;
      frame.scrollLeft = fx * frame.scrollWidth - frame.clientWidth / 2;
      frame.scrollTop = fy * frame.scrollHeight - frame.clientHeight / 2;
      return;
    }
    if (k === "pick") {
      var c = pickColor(e, p);
      if (c) { if (e.button === 2) state.bg = c; else state.fg = c; showColors(); }
      setTool(state.prev || "pencil");
      return;
    }
    if (k === "fill") {
      save();
      if (floodFill(p, color) === false) main.style.background = color;
      return;
    }
    if (k === "polygon") {
      if (!poly) { save(); poly = { first: p, last: p, base: snapshot(), color: color }; }
      drawing = { start: poly.last };
      return;
    }
    if (k === "curve" && curve) {
      drawing = { bend: true };
      return;
    }

    save();
    drawing = { start: p, last: p, base: snapshot(), color: color };
    stroke(color);
    if (k === "pencil" || k === "brush" || k === "eraser") {
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.01, p.y); ctx.stroke();
    }
    if (k === "airbrush") {
      sprayAt(p, color);
      spray = setInterval(function () { if (drawing) sprayAt(drawing.last, color); }, 20);
    }
  });

  layer.addEventListener("pointermove", function (e) {
    var p = pos(e);
    xy.textContent = Math.round(p.x / dpr) + "," + Math.round(p.y / dpr);
    if (!drawing) return;
    var k = state.tool;
    if (k === "pencil" || k === "brush" || k === "eraser") {
      stroke(drawing.color);
      ctx.beginPath(); ctx.moveTo(drawing.last.x, drawing.last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    } else if (k === "airbrush") {
      sprayAt(p, drawing.color);
    } else if (k === "polygon") {
      ctx.putImageData(poly.base, 0, 0);
      stroke(poly.color); shape("line", poly.last, p);
    } else if (k === "curve" && drawing.bend) {
      ctx.putImageData(curve.base, 0, 0);
      stroke(curve.color);
      ctx.beginPath(); ctx.moveTo(curve.a.x, curve.a.y);
      ctx.quadraticCurveTo(2 * p.x - (curve.a.x + curve.b.x) / 2, 2 * p.y - (curve.a.y + curve.b.y) / 2, curve.b.x, curve.b.y);
      ctx.stroke();
    } else if (k === "curve") {
      ctx.putImageData(drawing.base, 0, 0);
      stroke(drawing.color); shape("line", drawing.start, p);
    } else {
      ctx.putImageData(drawing.base, 0, 0);
      stroke(drawing.color); shape(k, drawing.start, p);
    }
    drawing.last = p;
  });

  function finish(e) {
    if (!drawing) return;
    var p = pos(e), k = state.tool;
    if (k === "polygon") {
      var f = poly.first;
      if (poly.last !== f && Math.hypot(p.x - f.x, p.y - f.y) < 8 * dpr) {
        ctx.putImageData(poly.base, 0, 0); stroke(poly.color); shape("line", poly.last, f); poly = null;
      } else {
        ctx.putImageData(poly.base, 0, 0); stroke(poly.color); shape("line", poly.last, p);
        poly.last = p; poly.base = snapshot();
      }
    } else if (k === "curve" && drawing.bend) {
      curve = null;
    } else if (k === "curve") {
      curve = { a: drawing.start, b: p, base: drawing.base, color: drawing.color };
    }
    clearInterval(spray);
    ctx.globalCompositeOperation = "source-over";
    drawing = null;
  }
  layer.addEventListener("pointerup", finish);
  layer.addEventListener("pointercancel", finish);
  layer.addEventListener("dblclick", function () {
    if (state.tool === "polygon" && poly) {
      ctx.putImageData(poly.base, 0, 0); stroke(poly.color); shape("line", poly.last, poly.first);
      ctx.globalCompositeOperation = "source-over";
      poly = null;
    }
  });
  main.addEventListener("pointerleave", function () { xy.innerHTML = "&nbsp;"; });

  // remember which drawing tool to return to after Pick Color
  win.querySelector(".toolbox").addEventListener("click", function (e) {
    var b = e.target.closest("[data-tool]");
    if (b && b.dataset.tool !== "pick") state.prev = b.dataset.tool;
  }, true);

  // ----- window buttons and menu -----
  function closeScreen(minimized) {
    var screen = document.createElement("div");
    screen.className = "off";
    if (minimized) {
      screen.style.cursor = "default";
      screen.innerHTML = '<div class="taskbar"><button><span class="icon" style="width:14px;height:14px;background:conic-gradient(red 0 25%,yellow 0 50%,lime 0 75%,blue 0);border:1px solid #000"></span>' + file + " - Paint</button></div>";
      screen.querySelector("button").onclick = function () { screen.remove(); win.style.display = ""; };
    } else {
      screen.innerHTML = "It's now safe to close this tab.<small>Click anywhere to restart</small>";
      screen.onclick = function () { location.reload(); };
    }
    win.style.display = "none";
    document.body.appendChild(screen);
  }
  win.querySelector(".controls").addEventListener("click", function (e) {
    var act = e.target.dataset.act;
    if (act === "close") { window.close(); closeScreen(false); }
    if (act === "min") closeScreen(true);
    if (act === "max") {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    }
  });
  var saveBtn = win.querySelector('[data-act="save"]');
  // the drawing flattened onto its paper color, scaled down to at most maxW pixels wide
  function flatten(maxW) {
    var s = Math.min(1, (maxW || Infinity) / layer.width);
    var out = document.createElement("canvas");
    out.width = Math.round(layer.width * s); out.height = Math.round(layer.height * s);
    var o = out.getContext("2d");
    o.fillStyle = getComputedStyle(main).backgroundColor || "#ffffff";
    o.fillRect(0, 0, out.width, out.height);
    o.drawImage(layer, 0, 0, out.width, out.height);
    return out;
  }
  window.Paint = {
    flatten: flatten,
    isBlank: function () { return !drawn || !layer.width; },
    say: function (msg) { hint.textContent = msg; },
    window: win
  };
  if (saveBtn) saveBtn.addEventListener("click", function () {
    var out = flatten();
    var a = document.createElement("a");
    a.download = "untitled.png";
    a.href = out.toDataURL("image/png");
    a.click();
  });
  win.querySelectorAll(".menubar button").forEach(function (b) {
    b.addEventListener("mouseenter", function () { hint.dataset.prev = hint.textContent; hint.textContent = b.title; });
    b.addEventListener("mouseleave", function () { if (hint.dataset.prev) hint.textContent = hint.dataset.prev; });
  });
  win.querySelector('[data-act="clear"]').addEventListener("click", function () {
    save();
    ctx.clearRect(0, 0, layer.width, layer.height);
    drawn = false;
    main.style.background = "";
    main.style.zoom = state.zoom = 1;
  });

  setTool(page === "draw" ? "pencil" : "select");
  state.prev = page === "draw" ? "pencil" : null;
  setWidth(0);
  showColors();
})();
