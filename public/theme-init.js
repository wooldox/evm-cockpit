// Runs before paint to apply the saved theme, avoiding a flash of the
// wrong theme on a static export. Loaded via <script src> (no inline HTML).
(function () {
  try {
    var t = localStorage.getItem("cc-theme");
    if (t === "light" || t === "dark") {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch (e) {}
})();
