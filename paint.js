// Builds the shared Paint window chrome around the page's <main> content,
// and lets the color palette recolor headings (remembered per visitor).
(function () {
  var LINKS = {
    linkedin: "https://www.linkedin.com/in/tairanhabib",
    twitter: "https://x.com/tairanhabib",
    github: "https://github.com/tairanhabib"
  };
  var COLORS = ["#000000", "#808080", "#800000", "#808000", "#008000", "#008080", "#000080",
    "#800080", "#808040", "#004040", "#0080ff", "#004080", "#8000ff", "#804000",
    "#ffffff", "#c0c0c0", "#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff",
    "#ff00ff", "#ffff80", "#00ff80", "#80ffff", "#8080ff", "#ff0080", "#ff8040"];
  var TOOLS = ["✂", "⬚", "⌫", "🪣", "💉", "🔍", "✏", "🖌", "💨", "A", "╲", "∿", "▭", "⬠", "◯", "▢"];

  var page = document.body.dataset.page;
  var file = page === "projects" ? "projects.bmp" : "tairan_habib.bmp";
  var main = document.querySelector("main");

  function nav(href, label, key) {
    var ext = /^http/.test(href) ? ' target="_blank" rel="noopener"' : "";
    return '<a href="' + href + '"' + ext + (key === page ? ' class="active"' : "") + ">" + label + "</a>";
  }

  var win = document.createElement("div");
  win.className = "window";
  win.innerHTML =
    '<div class="titlebar"><span class="title"><span class="icon"></span>' + file + ' - Paint</span>' +
    '<span class="controls"><span>_</span><span>□</span><span>×</span></span></div>' +
    '<nav class="menubar">' +
      nav("index.html", "About", "about") +
      nav("projects.html", "Projects", "projects") +
      nav(LINKS.linkedin, "LinkedIn") +
      nav(LINKS.twitter, "Twitter") +
      nav(LINKS.github, "GitHub") +
      nav("mailto:thabib@mit.edu", "Email") +
    "</nav>" +
    '<div class="workspace"><div class="toolbox">' +
      TOOLS.map(function (t, i) { return '<button aria-label="tool"' + (i === 6 ? ' class="on"' : "") + ">" + t + "</button>"; }).join("") +
      '<div class="well"></div></div>' +
      '<div class="canvas-frame"></div></div>' +
    '<div class="palette"><div class="current"><span class="fg"></span><span class="bg"></span></div><div class="swatches">' +
      COLORS.map(function (c) { return '<button style="background:' + c + '" data-c="' + c + '" aria-label="color ' + c + '"></button>'; }).join("") +
    "</div></div>" +
    '<div class="statusbar"><div>For Help, click a color to repaint the page.</div><div>&nbsp;</div><div>&nbsp;</div></div>';

  main.classList.add("canvas");
  win.querySelector(".canvas-frame").appendChild(main);
  document.body.appendChild(win);

  function setInk(c) {
    if (c === "#ffffff" || c === "#c0c0c0" || c === "#ffff00" || c === "#ffff80" || c === "#00ffff" || c === "#80ffff" || c === "#00ff00" || c === "#00ff80") return;
    document.documentElement.style.setProperty("--ink", c);
  }
  try { var saved = localStorage.getItem("ink"); if (saved) setInk(saved); } catch (e) {}

  win.querySelector(".swatches").addEventListener("click", function (e) {
    var c = e.target.dataset && e.target.dataset.c;
    if (!c) return;
    setInk(c);
    try { localStorage.setItem("ink", c); } catch (err) {}
  });

  win.querySelector(".toolbox").addEventListener("click", function (e) {
    if (e.target.tagName !== "BUTTON") return;
    win.querySelectorAll(".toolbox button").forEach(function (b) { b.classList.remove("on"); });
    e.target.classList.add("on");
  });
})();
