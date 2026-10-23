// ============================================================
// PetMatch — Mejoras de experiencia (UX), compartidas por todas las páginas.
// Todo es opcional y aislado: si algo falla, la página sigue funcionando igual.
//  · Barra superior fija + botones Ingresar/Salir según la sesión
//  · Preguntas con iconos, numeración, progreso y avance automático
//  · Aparición suave al hacer scroll
//  · Vibración y huellitas al dar «me interesa»; atajos ← → en Descubrir
//  · App instalable (PWA)
// ============================================================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
const cfgEl = document.querySelector('script[src$="ux.js"]');
const cfg = cfgEl ? cfgEl.dataset : {};

function vibrar(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
function safeStore(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }

// ---------- 1. Barra superior ----------
function initNav() {
  const nav = $(".nav");
  if (!nav) return;
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 6);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  // La altura real cambia al cargar logo/fuentes o al girar el teléfono: se mantiene al día
  const medir = () => document.documentElement.style.setProperty("--ux-nav-h", nav.offsetHeight + "px");
  medir();
  if ("ResizeObserver" in window) new ResizeObserver(medir).observe(nav);
  else window.addEventListener("resize", medir);
}

function initAuthNav(fb) {
  const right = $(".nav .right");
  if (!right || !fb) return;
  const root = document.documentElement;
  root.classList.add("ux-pending");
  const reveal = () => root.classList.remove("ux-pending");
  setTimeout(reveal, 1500); // por si Firebase tarda: nunca dejamos los botones ocultos

  fb.onAuthStateChanged(fb.auth, async (user) => {
    if (user) {
      let role = null;
      try {
        const s = await fb.getDoc(fb.doc(fb.db, "users", user.uid));
        role = s.exists() ? s.data().role : null;
      } catch (e) {}
      const destino = role === "shelter" ? "shelter.html" : "swipe.html";
      const etiqueta = role === "shelter" ? "Mi panel" : "Descubrir";
      right.innerHTML =
        `<a href="${destino}"><button class="btn-nav" type="button">${etiqueta}</button></a>` +
        `<button class="btn-nav outline btn-logout" type="button">Salir</button>`;
      $(".btn-logout", right).onclick = () => fb.signOut(fb.auth).then(() => location.reload());
    }
    reveal();
  });
}

// ---------- 2. Preguntas ----------
const ICONOS = {
  especie: { perro: "🐕", gato: "🐈", cualquiera: "✨" },
  vivienda: { depto: "🏢", casa_sin_patio: "🏠", casa_patio_chico: "🏡", casa_patio_grande: "🌳" },
  tipovivienda: { propia: "🔑", renta_permitida: "📄" },
  acuerdofamiliar: { si: "👨‍👩‍👧", en_proceso: "💬" },
  planviajes: { familiares: "👪", pension: "🏨", viaja: "🧳" },
  ninos: { si: "👶", no: "🙂" },
  otrasmascotas: { si: "🐾", no: "🚫" },
  horassolo: { menos2: "⚡", "2a4": "🕑", "4a8": "🕗", mas8: "🌙" },
  energia: { bajo: "🛋️", medio: "🚶", alto: "🏃" },
  experiencia: { primera_vez: "🌱", algo: "🌿", mucha: "🌳" },
  tamano: { pequeno: "🧸", mediano: "🐕", grande: "🦮", cualquiera: "✨" },
};
function icono(grupo, valor) {
  const k = grupo.replace(/_/g, "").toLowerCase();
  const clave = Object.keys(ICONOS).find((x) => k.startsWith(x));
  return clave ? ICONOS[clave][valor] || "" : "";
}

function initQuestions() {
  if (!("questions" in cfg)) return;
  const groups = $$("[data-group]");
  if (!groups.length) return;
  document.body.classList.add("ux-q");

  const requeridas = cfg.required ? cfg.required.split(",").map((s) => s.trim()) : groups.map((g) => g.dataset.group);
  const req = groups.filter((g) => requeridas.includes(g.dataset.group));

  groups.forEach((g) => {
    const lab = g.previousElementSibling;
    if (lab && lab.tagName === "LABEL") {
      lab.classList.add("q-label");
      if (!requeridas.includes(g.dataset.group)) {
        lab.classList.add("q-optional");
        lab.insertAdjacentHTML("beforeend", '<span class="q-opt">opcional</span>');
      }
    }
    $$(".choice-chip", g).forEach((c) => {
      const ico = icono(g.dataset.group, c.dataset.value);
      if (ico && !$(".ci", c)) c.insertAdjacentHTML("afterbegin", `<span class="ci" aria-hidden="true">${ico}</span>`);
      c.setAttribute("role", "button");
      c.tabIndex = 0;
      c.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); c.click(); }
      });
    });
  });

  // Barra de progreso
  const panel = groups[0].closest(".panel") || groups[0].parentElement;
  const bar = document.createElement("div");
  bar.className = "q-progress";
  bar.innerHTML =
    '<div class="q-progress-top"><span id="qStep"></span><b id="qPct">0%</b></div>' +
    '<div class="q-track"><i id="qFill"></i></div><div class="q-live" id="qLive"></div>';
  panel.insertBefore(bar, panel.firstChild);

  const btnFinal = $("#btnVerMatches") || $("#btnGuardar");
  const respondida = (g) => !!$(".choice-chip.selected", g);
  let avisoListo = false;

  function actualizar() {
    const hechas = req.filter(respondida).length;
    const total = req.length;
    const pct = Math.round((hechas / total) * 100);
    $("#qStep").textContent = hechas === total ? "¡Listo! Ya puedes continuar" : `Pregunta ${hechas + 1} de ${total}`;
    $("#qPct").textContent = pct + "%";
    $("#qFill").style.width = pct + "%";
    groups.forEach((g) => {
      const lab = g.previousElementSibling;
      if (lab && lab.classList.contains("q-label")) lab.classList.toggle("q-done", respondida(g));
    });
    if (hechas === total && btnFinal && !avisoListo) { avisoListo = true; btnFinal.classList.add("ux-ready"); }
    document.dispatchEvent(new CustomEvent("pm:progress", { detail: { hechas, total } }));
    return { hechas, total };
  }

  function avanzar(desde) {
    const idx = req.indexOf(desde);
    const siguiente = req.slice(idx + 1).concat(req.slice(0, idx + 1)).find((g) => !respondida(g));
    const destino = siguiente ? siguiente.previousElementSibling : btnFinal;
    if (!destino) return;
    const r = destino.getBoundingClientRect();
    const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--ux-nav-h")) || 0;
    if (r.top > window.innerHeight * 0.7 || r.top < navH + 90) {
      destino.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    }
  }

  // Delegado en document: corre DESPUÉS de los manejadores propios de cada página
  document.addEventListener("click", (e) => {
    const chip = e.target.closest && e.target.closest(".choice-chip");
    if (!chip) return;
    const g = chip.closest("[data-group]");
    if (!g) return;
    vibrar(8);
    setTimeout(() => {
      actualizar();
      if (req.includes(g)) setTimeout(() => avanzar(g), 220);
    }, 0);
  });

  actualizar();
}

// ---------- 3. Aparecer al hacer scroll ----------
function initReveal() {
  if (reduce || !("IntersectionObserver" in window)) return;
  const items = $$(".section-head, .feature-card").filter((el) => !el.closest(".hero"));
  if (!items.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  items.forEach((el, i) => {
    el.classList.add("ux-reveal");
    el.style.transitionDelay = (i % 3) * 70 + "ms";
    io.observe(el);
  });
}

// ---------- 4. Vibración, huellitas y atajos ----------
function huellitas(x, y) {
  if (reduce) return;
  const set = ["🐾", "♥", "🐾", "♥", "🐾", "♥", "🐾"];
  set.forEach((txt, i) => {
    const s = document.createElement("span");
    s.className = "ux-paw";
    s.textContent = txt;
    const ang = (Math.PI * 2 * i) / set.length + Math.random() * 0.5;
    const dist = 50 + Math.random() * 50;
    s.style.left = x + "px"; s.style.top = y + "px";
    s.style.setProperty("--dx", Math.cos(ang) * dist + "px");
    s.style.setProperty("--dy", Math.sin(ang) * dist - 20 + "px");
    s.style.setProperty("--r", (Math.random() * 60 - 30) + "deg");
    s.style.color = txt === "♥" ? "#E8836B" : "#4F9D8D";
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 950);
  });
}

function initFeedback() {
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("#btnLike, #btnMatchAction");
    if (b) {
      vibrar([12, 40, 12]);
      const r = b.getBoundingClientRect();
      huellitas(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2);
    } else if (e.target.closest && e.target.closest("#btnPass")) {
      vibrar(8);
    }
  });
  // Atajos de teclado en Descubrir
  document.addEventListener("keydown", (e) => {
    if (/input|textarea|select/i.test((e.target.tagName || ""))) return;
    if (e.key === "ArrowRight") { const b = $("#btnLike"); if (b) b.click(); }
    if (e.key === "ArrowLeft") { const b = $("#btnPass"); if (b) b.click(); }
  });
}

// ---------- 5. App instalable ----------
function initPWA() {
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  let evt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    evt = e;
    const ultimo = Number(safeStore("pm_install_x") || 0);
    if (Date.now() - ultimo < 14 * 86400000) return;
    if ($(".ux-install")) return;
    const box = document.createElement("div");
    box.className = "ux-install";
    box.innerHTML = '<span>📲 Instala PetMatch</span><button class="go" type="button">Instalar</button><button class="x" type="button" aria-label="Cerrar">✕</button>';
    document.body.appendChild(box);
    $(".go", box).onclick = async () => { box.remove(); evt.prompt(); try { await evt.userChoice; } catch (e2) {} evt = null; };
    $(".x", box).onclick = () => { box.remove(); safeStore("pm_install_x", String(Date.now())); };
  });
}

// ---------- Arranque ----------
function arrancar() {
  try { initNav(); } catch (e) { console.warn(e); }
  try { initQuestions(); } catch (e) { console.warn(e); }
  try { initReveal(); } catch (e) { console.warn(e); }
  try { initFeedback(); } catch (e) { console.warn(e); }
  try { initPWA(); } catch (e) { console.warn(e); }
  // La parte que usa Firebase va aparte: si falla, lo demás sigue funcionando
  import("./firebase-config.js").then((fb) => initAuthNav(fb)).catch((e) => console.warn("UX sin sesión:", e));
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
else arrancar();
