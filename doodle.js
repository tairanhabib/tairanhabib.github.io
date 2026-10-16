// Doodle submissions (Doodle page) and the approved-doodle gallery (Gallery page).
// Talks to Supabase's REST and Storage APIs directly, so no library is needed.
(function () {
  var db = window.DOODLE_DB || {};
  var ready = !!(db.url && db.key);
  var headers = { apikey: db.key };
  // legacy anon keys are JWTs and also go in Authorization; new sb_publishable_ keys don't
  if (/^eyJ/.test(db.key || "")) headers.Authorization = "Bearer " + db.key;

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16);
    });
  }

  // ----- Win98-style dialog -----
  function dialog(title, bodyHtml, buttons) {
    var shade = document.createElement("div");
    shade.className = "dialog-shade";
    shade.innerHTML =
      '<div class="dialog" role="dialog" aria-label="' + title + '">' +
        '<div class="titlebar"><span class="title">' + title + '</span><span class="controls"><button data-x aria-label="Close">×</button></span></div>' +
        '<div class="dialog-body">' + bodyHtml + '</div>' +
        '<div class="dialog-buttons">' + buttons.map(function (b, i) { return '<button class="btn" data-i="' + i + '">' + b.label + "</button>"; }).join("") + "</div>" +
      "</div>";
    function close() { shade.remove(); }
    shade.querySelector("[data-x]").onclick = close;
    shade.addEventListener("click", function (e) { if (e.target === shade) close(); });
    shade.querySelectorAll("[data-i]").forEach(function (el) {
      el.onclick = function () { var b = buttons[+el.dataset.i]; if (!b.run || b.run(shade) !== false) close(); };
    });
    document.body.appendChild(shade);
    var input = shade.querySelector("input");
    if (input) input.focus();
    return shade;
  }
  function alertBox(title, msg) { dialog(title, "<p>" + msg + "</p>", [{ label: "OK" }]); }

  // ----- submitting (Doodle page) -----
  function submit(name, shade) {
    var btn = shade.querySelector('[data-i="0"]');
    btn.disabled = true; btn.textContent = "Sending…";
    var path = uuid() + ".png";
    window.Paint.flatten(1200).toBlob(function (blob) {
      fetch(db.url + "/storage/v1/object/doodles/" + path, {
        method: "POST",
        headers: Object.assign({ "Content-Type": "image/png" }, headers),
        body: blob
      }).then(function (r) {
        if (!r.ok) throw new Error("upload " + r.status);
        return fetch(db.url + "/rest/v1/doodles", {
          method: "POST",
          headers: Object.assign({ "Content-Type": "application/json", Prefer: "return=minimal" }, headers),
          body: JSON.stringify({ name: name || null, path: path })
        });
      }).then(function (r) {
        if (!r.ok) throw new Error("save " + r.status);
        shade.remove();
        alertBox("Submitted!", "Thanks for the doodle! It'll show up in the <a href=\"gallery.html\">Gallery</a> once it's approved.");
        window.Paint.say("Doodle submitted. Thanks!");
      }).catch(function () {
        btn.disabled = false; btn.textContent = "Submit";
        shade.querySelector(".dialog-error").textContent = "Couldn't send it. Check your connection and try again.";
      });
    }, "image/png");
  }

  var submitBtn = document.querySelector('[data-act="submit"]');
  if (submitBtn) submitBtn.addEventListener("click", function () {
    if (!ready) return alertBox("Submit", "Submissions open soon. In the meantime, use Save Image to keep your doodle.");
    if (window.Paint.isBlank()) return alertBox("Submit", "Your canvas is empty. Draw something first!");
    dialog("Submit Doodle",
      '<p>Send this doodle to the gallery? It shows up after a quick review.</p>' +
      '<label>Sign it (optional)<br><input type="text" maxlength="40" placeholder="Your name or initials"></label>' +
      '<p class="dialog-error"></p>',
      [{ label: "Submit", run: function (shade) { submit(shade.querySelector("input").value.trim(), shade); return false; } },
       { label: "Cancel" }]);
  });

  // ----- gallery page -----
  var grid = document.querySelector(".gallery");
  if (grid) {
    if (!ready) { grid.outerHTML = '<p class="lead">The gallery opens soon. <a href="draw.html">Go doodle something</a> in the meantime.</p>'; return; }
    fetch(db.url + "/rest/v1/doodles?select=name,path,created_at&approved=eq.true&order=created_at.desc&limit=120", { headers: headers })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (rows) {
        if (!rows.length) { grid.outerHTML = '<p class="lead">No doodles yet. <a href="draw.html">Be the first!</a></p>'; return; }
        rows.forEach(function (d) {
          var fig = document.createElement("figure");
          var img = document.createElement("img");
          img.src = db.url + "/storage/v1/object/public/doodles/" + encodeURIComponent(d.path);
          img.alt = d.name ? "Doodle by " + d.name : "Anonymous doodle";
          img.loading = "lazy";
          var cap = document.createElement("figcaption");
          cap.textContent = d.name || "Anonymous";
          fig.appendChild(img); fig.appendChild(cap);
          grid.appendChild(fig);
        });
      })
      .catch(function () { grid.outerHTML = '<p class="lead">Couldn\'t load the gallery right now. Try again later.</p>'; });
  }
})();
