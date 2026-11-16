/* Đọc sách Khoa học Giáo dục — JS thuần, chạy hoàn toàn trong trình duyệt */
(function () {
  "use strict";
  var ROOT = (document.currentScript && document.currentScript.src || "").replace(/js\/site\.js.*$/, "");
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function readSet() { try { return JSON.parse(store("dsgd-read") || "{}"); } catch (e) { return {}; } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---- công cụ: theme, cỡ chữ, menu điện thoại ---- */
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var act = b.getAttribute("data-act"), html = document.documentElement;
    if (act === "theme") {
      var dark = html.getAttribute("data-theme") ? html.getAttribute("data-theme") === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      var t = dark ? "light" : "dark"; html.setAttribute("data-theme", t); store("dsgd-theme", t);
    } else {
      var cur = parseFloat(getComputedStyle(html).fontSize) || 18;
      var n = Math.max(14, Math.min(24, cur + (act === "font+" ? 1 : -1)));
      html.style.setProperty("--fs", n + "px"); store("dsgd-font", n);
    }
  });
  var side = document.getElementById("side"), menuBtn = document.getElementById("menuBtn");
  if (menuBtn && side) {
    menuBtn.addEventListener("click", function () { side.classList.toggle("show"); });
    document.addEventListener("click", function (e) { if (side.classList.contains("show") && !side.contains(e.target) && e.target !== menuBtn) side.classList.remove("show"); });
    var cur = side.querySelector("li.current"); if (cur) cur.scrollIntoView({ block: "center" });
  }

  /* ---- tiến độ đọc ---- */
  var key = document.body.getAttribute("data-key"), done = readSet();
  function paintTree() { document.querySelectorAll(".tree a[data-key]").forEach(function (a) { a.classList.toggle("read", !!done[a.getAttribute("data-key")]); }); }
  paintTree();
  var mark = document.querySelector("[data-mark]");
  function paintMark() { if (!mark) return; var d = !!done[key]; mark.classList.toggle("done", d); mark.textContent = d ? "✓ Đã đọc trang này (bấm để bỏ đánh dấu)" : "Đánh dấu đã đọc trang này"; }
  if (mark) {
    paintMark();
    mark.addEventListener("click", function () { if (done[key]) delete done[key]; else done[key] = Date.now(); store("dsgd-read", JSON.stringify(done)); paintMark(); paintTree(); });
  }
  document.querySelectorAll(".bar[data-keys]").forEach(function (bar) {
    var keys = bar.getAttribute("data-keys").trim().split(/\s+/), n = keys.filter(function (k) { return done[k]; }).length;
    bar.querySelector("i").style.width = (100 * n / keys.length) + "%";
    var lab = bar.nextElementSibling; if (lab && n) lab.textContent = "Đã đọc " + n + "/" + keys.length + " trang";
  });

  /* ---- trắc nghiệm: phản hồi tức thì, luôn có giải thích, làm lại được ---- */
  document.querySelectorAll(".quiz").forEach(function (box) {
    var dataEl = box.nextElementSibling, items;
    try { items = JSON.parse(dataEl.textContent); } catch (e) { box.textContent = "Không đọc được dữ liệu câu hỏi."; return; }
    var qkey = "dsgd-quiz-" + box.getAttribute("data-quiz");
    function saved() { try { return JSON.parse(store(qkey) || "{}"); } catch (e) { return {}; } }
    function render() {
      var ans = saved(), html = '<div class="quiz-bar"><span class="score"></span><button type="button" data-reset>Làm lại tất cả</button></div>';
      items.forEach(function (it, i) {
        html += '<div class="q" data-i="' + i + '"><p class="q-stem">Câu ' + (i + 1) + ". " + esc(it.q) + (it.src ? ' <span class="q-src">(' + esc(it.src) + ")</span>" : "") + '</p><div class="q-opts">';
        it.opts.forEach(function (o, j) { html += '<button type="button" class="q-opt" data-j="' + j + '">' + String.fromCharCode(65 + j) + ". " + esc(o) + "</button>"; });
        html += "</div></div>";
      });
      box.innerHTML = html;
      Object.keys(ans).forEach(function (i) { show(+i, ans[i]); });
      score();
    }
    function show(i, j) {
      var q = box.querySelector('.q[data-i="' + i + '"]'), it = items[i]; if (!q) return;
      q.querySelectorAll(".q-opt").forEach(function (b, k) { b.disabled = true; if (k === it.a) b.classList.add("ok"); else if (k === j) b.classList.add("no"); });
      var p = document.createElement("p"); p.className = "q-exp";
      p.innerHTML = "<b>" + (j === it.a ? "Đúng." : "Chưa đúng. Đáp án: " + String.fromCharCode(65 + it.a) + ".") + "</b> " + esc(it.exp);
      q.appendChild(p);
    }
    function score() {
      var ans = saved(), n = Object.keys(ans).length, ok = Object.keys(ans).filter(function (i) { return ans[i] === items[i].a; }).length;
      box.querySelector(".score").textContent = n ? ("Đã làm " + n + "/" + items.length + " câu · đúng " + ok) : (items.length + " câu hỏi");
    }
    box.addEventListener("click", function (e) {
      if (e.target.closest("[data-reset]")) { store(qkey, "{}"); render(); return; }
      var b = e.target.closest(".q-opt"); if (!b || b.disabled) return;
      var i = +b.closest(".q").getAttribute("data-i"), j = +b.getAttribute("data-j"), ans = saved();
      ans[i] = j; store(qkey, JSON.stringify(ans)); show(i, j); score();
    });
    render();
  });

  /* ---- tìm kiếm toàn văn (bỏ dấu để gõ không dấu vẫn ra) ---- */
  function fold(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase(); }
  var results = document.getElementById("results");
  if (results) {
    var qIn = document.getElementById("q"), info = document.getElementById("searchInfo"), idx = null;
    var params = new URLSearchParams(location.search); qIn.value = params.get("q") || "";
    fetch(ROOT + "index.json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
      idx = d.map(function (p) { p.ft = fold(p.t + " " + p.en); p.fx = fold(p.x); return p; }); run();
    }).catch(function () { info.textContent = "Không tải được chỉ mục tìm kiếm. Hãy tải lại trang."; });
    document.getElementById("searchForm").addEventListener("submit", function (e) { e.preventDefault(); run(); history.replaceState(null, "", "?q=" + encodeURIComponent(qIn.value)); });
    qIn.addEventListener("input", function () { clearTimeout(qIn._t); qIn._t = setTimeout(run, 150); });
    function run() {
      if (!idx) return;
      var raw = qIn.value.trim(), q = fold(raw);
      if (!q) { info.textContent = "Nhập từ khoá để tìm trong " + idx.length + " trang."; results.innerHTML = ""; return; }
      var words = q.split(/\s+/).filter(Boolean), hits = [];
      idx.forEach(function (p) {
        var s = 0;
        if (p.ft.indexOf(q) >= 0) s += 50; if (p.fx.indexOf(q) >= 0) s += 20;
        var all = words.every(function (w) { var a = p.ft.indexOf(w) >= 0, b = p.fx.indexOf(w) >= 0; if (a) s += 8; if (b) s += 2; return a || b; });
        if (all && s) hits.push({ p: p, s: s });
      });
      hits.sort(function (a, b) { return b.s - a.s; });
      info.textContent = hits.length ? ("Tìm thấy " + hits.length + " trang cho “" + raw + "”.") : ("Không tìm thấy trang nào cho “" + raw + "”.");
      results.innerHTML = hits.slice(0, 60).map(function (h) {
        var p = h.p, at = p.fx.indexOf(words[0]), start = Math.max(0, at - 90), snip = at >= 0 ? p.x.substr(start, 240) : p.x.substr(0, 200);
        var re = new RegExp("(" + words.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")", "gi");
        snip = snip.normalize("NFC");
        var folded = fold(snip), out = "", last = 0;
        // tô sáng trên bản gốc theo vị trí của bản bỏ dấu (chữ NFC dựng sẵn: bỏ dấu không đổi độ dài)
        var marks = [], mm; while ((mm = re.exec(folded))) { marks.push([mm.index, mm.index + mm[0].length]); if (mm[0].length === 0) re.lastIndex++; }
        marks.forEach(function (r) { out += esc(snip.slice(last, r[0])) + "<mark>" + esc(snip.slice(r[0], r[1])) + "</mark>"; last = r[1]; }); out += esc(snip.slice(last));
        return '<li><a href="' + ROOT + p.u.replace(/^\//, "") + '"><b>' + esc(p.t) + "</b></a><div class=\"r-meta\">" + esc([p.b, p.c].filter(Boolean).join(" › ")) + "</div><div>…" + out + "…</div></li>";
      }).join("");
    }
  }

  /* ---- lọc bảng thuật ngữ ---- */
  var gl = document.getElementById("gl");
  if (gl) {
    var glq = document.getElementById("glq"), glb = document.getElementById("glbook"), cnt = document.getElementById("glcount");
    var rows = Array.prototype.slice.call(gl.tBodies[0].rows);
    rows.forEach(function (r) { r._f = fold(r.textContent); });
    function filt() {
      var q = fold(glq.value.trim()), b = glb.value, n = 0;
      rows.forEach(function (r) { var ok = (!q || r._f.indexOf(q) >= 0) && (!b || r.getAttribute("data-book") === b); r.hidden = !ok; if (ok) n++; });
      cnt.textContent = n + " / " + rows.length + " thuật ngữ";
    }
    glq.addEventListener("input", filt); glb.addEventListener("change", filt); filt();
  }
})();
