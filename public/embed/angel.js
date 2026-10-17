/*! Angel A.I. Embed SDK — vanilla loader for FUN Ecosystem sites */
(function () {
  if (window.AngelEmbed) return;
  var s = document.currentScript;
  if (!s) {
    var all = document.getElementsByTagName("script");
    for (var i = all.length - 1; i >= 0; i--) {
      if (/angel\.js/.test(all[i].src)) { s = all[i]; break; }
    }
  }
  var clientId = s && s.getAttribute("data-client-id");
  var origin = location.origin;
  var host = (s && s.getAttribute("data-host")) || "https://angel-funrich.lovable.app";
  var tokenUrl = (s && s.getAttribute("data-token-url")) ||
    (host + "/functions/v1/assistant-embed-token");

  var iframe, wrap, opened = false;

  function fetchToken() {
    return fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, origin: origin }),
    }).then(function (r) { return r.json(); });
  }

  function mountIframe(token) {
    wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483646;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 32px);border-radius:16px;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,.18);background:#fff;display:none;";
    iframe = document.createElement("iframe");
    iframe.src = host + "/embed/chat?token=" + encodeURIComponent(token);
    iframe.style.cssText = "width:100%;height:100%;border:0;display:block;";
    iframe.title = "Angel A.I.";
    iframe.allow = "clipboard-write";
    wrap.appendChild(iframe);
    document.body.appendChild(wrap);

    window.addEventListener("message", function (e) {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "angel:resize" && typeof e.data.height === "number") {
        wrap.style.height = Math.min(e.data.height + 24, window.innerHeight - 32) + "px";
      }
      if (e.data.type === "angel:close") api.close();
    });
  }

  function mountButton() {
    var btn = document.createElement("button");
    btn.setAttribute("aria-label", "Open Angel A.I.");
    btn.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483645;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;background:linear-gradient(135deg,#b8860b,#daa520,#ffd700,#ffec8b);box-shadow:0 8px 24px rgba(184,134,11,.35);font-size:24px;";
    btn.textContent = "✦";
    btn.onclick = function () { api.open(); };
    document.body.appendChild(btn);
  }

  var api = {
    open: function () {
      if (!iframe) {
        fetchToken().then(function (res) {
          if (!res || !res.token) { console.error("[AngelEmbed] token error", res); return; }
          mountIframe(res.token);
          wrap.style.display = "block";
          opened = true;
        });
      } else {
        wrap.style.display = "block";
        opened = true;
      }
    },
    close: function () {
      if (wrap) wrap.style.display = "none";
      opened = false;
    },
    toggle: function () { opened ? api.close() : api.open(); },
    isOpen: function () { return opened; },
  };

  window.AngelEmbed = api;
  if (s && s.getAttribute("data-autobutton") !== "false") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mountButton);
    } else {
      mountButton();
    }
  }
})();
