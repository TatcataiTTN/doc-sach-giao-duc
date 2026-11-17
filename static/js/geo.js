/* Trang đọc có khóa: giải mã gói AES-256-GCM ngay trong trình duyệt (WebCrypto). Không gửi mật khẩu đi đâu cả. */
(function () {
  "use strict";
  var ROOT = (document.currentScript && document.currentScript.src || "").replace(/js\/geo\.js.*$/, "");
  var SKEY = "geo-pw", book = null;
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function sstore(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function b64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  var $ = function (id) { return document.getElementById(id); };

  var encP = null;
  function loadEnc() { return encP || (encP = fetch(ROOT + "geo/book.enc.json").then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })); }
  function decrypt(pw, enc) {
    var te = new TextEncoder();
    return crypto.subtle.importKey("raw", te.encode(pw), "PBKDF2", false, ["deriveKey"]).then(function (km) {
      return crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(enc.salt), iterations: enc.iter, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    }).then(function (key) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(enc.iv) }, key, b64(enc.ct));
    }).then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); });
  }

  function tryOpen(pw, silent) {
    var msg = $("gateMsg"), btn = $("gateBtn");
    if (!(window.crypto && crypto.subtle)) { msg.textContent = "Trình duyệt này không hỗ trợ giải mã (cần HTTPS hoặc localhost)."; return Promise.resolve(false); }
    if (!silent) { msg.textContent = "Đang giải mã…"; btn.disabled = true; }
    return loadEnc().then(function (enc) { return decrypt(pw, enc); }).then(function (data) {
      book = data; sstore(SKEY, pw); msg.textContent = ""; start(); return true;
    }).catch(function (e) {
      sstore(SKEY, null);
      if (!silent) msg.textContent = (e && e.name === "OperationError") ? "Mật khẩu chưa đúng." : "Không tải được dữ liệu. Hãy tải lại trang.";
      return false;
    }).then(function (ok) { btn.disabled = false; return ok; });
  }

  function start() {
    $("gate").hidden = true; $("reader").hidden = false;
    $("gSub").textContent = book.author + " · " + book.year;
    $("gTree").innerHTML = book.pages.map(function (p) {
      return '<li data-id="' + p.id + '"><a href="#' + p.id + '">' + esc(p.short) + "</a></li>";
    }).join("");
    window.addEventListener("hashchange", route); route();
  }
  function route() {
    var id = (location.hash || "").replace("#", ""), i = 0;
    book.pages.forEach(function (p, k) { if (p.id === id) i = k; });
    show(i);
  }
  function show(i) {
    var p = book.pages[i];
    $("gDoc").innerHTML = p.html;
    $("gCrumb").textContent = p.short; document.title = p.title + " · Địa chính trị của AI";
    Array.prototype.forEach.call($("gTree").children, function (li) { li.classList.toggle("current", li.getAttribute("data-id") === p.id); });
    var nav = "", prev = book.pages[i - 1], next = book.pages[i + 1];
    nav += prev ? '<a class="prev" href="#' + prev.id + '"><span>← Trước</span><b>' + esc(prev.short) + "</b></a>" : "<span></span>";
    nav += next ? '<a class="next" href="#' + next.id + '"><span>Tiếp →</span><b>' + esc(next.short) + "</b></a>" : "";
    $("pnTop").innerHTML = nav; $("pnBottom").innerHTML = nav;
    quiz($("gDoc").querySelector(".quiz"), p.quiz);
    var side = $("side"); if (side) side.classList.remove("show");
    window.scrollTo(0, 0);
  }

  function quiz(box, items) {
    if (!box || !items || !items.length) return;
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
      Object.keys(ans).forEach(function (i) { reveal(+i, ans[i]); });
      score();
    }
    function reveal(i, j) {
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
      ans[i] = j; store(qkey, JSON.stringify(ans)); reveal(i, j); score();
    });
    render();
  }

  $("gateForm").addEventListener("submit", function (e) { e.preventDefault(); tryOpen($("pw").value, false); });
  $("gLock").addEventListener("click", function (e) { e.preventDefault(); sstore(SKEY, null); book = null; location.hash = ""; location.reload(); });
  var saved = sstore(SKEY); if (saved) tryOpen(saved, true);
})();
