// Aplica el tema antes de pintar (evita el destello). Archivo externo para que
// las páginas con CSP estricta (script-src 'self') no necesiten scripts inline.
// Ojo: nginx lo sirve con caché de 1 año; si lo cambias, cámbiale el nombre.
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var dark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (_) {}
})();
