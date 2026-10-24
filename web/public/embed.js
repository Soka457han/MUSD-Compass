/* MUSD Compass widget. Usage: <script src="https://musd-compass.vercel.app/embed.js" data-amount="2000" async></script> */
(function () {
  var s = document.currentScript;
  if (!s) return;
  var url = new URL("/embed", s.src);
  var amount = s.getAttribute("data-amount");
  if (amount) url.searchParams.set("amount", amount);
  var f = document.createElement("iframe");
  f.src = url.href;
  f.title = "MUSD Compass: where Mezo MUSD earns the most after costs";
  f.loading = "lazy";
  f.style.cssText = "display:block;width:100%;max-width:420px;height:280px;border:1px solid #c3c9d0;border-radius:6px;background:#fff";
  s.parentNode.insertBefore(f, s.nextSibling);
})();
