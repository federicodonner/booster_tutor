/* Booster Tutor — 15 cartas al azar de un cubo de CubeCobra, imágenes de Scryfall. */
(() => {
  "use strict";

  // ---------- Configuración ----------
  // ID (o nombre corto) del cubo en CubeCobra: https://cubecobra.com/cube/list/<ID>
  // También se puede pasar por URL: index.html?cube=<ID>
  const CUBE_ID = "85567503-33c0-4004-a138-a8b53187da83";
  const PACK_SIZE = 15;
  let MAG = 1.85;           // escala máxima del dock (se lee de --mag en CSS)
  const RADIUS = 2.6;       // cuántas cartas a cada lado se ven afectadas por la ampliación

  const cubeId = new URLSearchParams(location.search).get("cube") || CUBE_ID;

  // ---------- DOM ----------
  const $ = (s) => document.querySelector(s);
  const startEl = $("#start");
  const packEl = $("#pack");
  const openBtn = $("#open-btn");
  const statusEl = $("#status");
  const viewer = $("#viewer");
  const dock = $("#dock");
  const nameEl = $("#card-name");
  const idxEl = $("#idx");
  const flipBtn = $("#flip-btn");
  const resetBtn = $("#reset-btn");

  let cards = [];   // [{name, faces:[{normal, large}], big, thumb}]
  let current = -1;
  let step = 0;     // distancia entre centros de miniaturas
  let tw = 0;       // ancho de miniatura
  let raf = 0;

  // ---------- Datos ----------
  async function fetchCube(id) {
    const res = await fetch(`https://cubecobra.com/cube/api/cubeJSON/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(res.status === 404 ? "No se encontró el cubo en CubeCobra." : `CubeCobra respondió ${res.status}.`);
    const json = await res.json();
    const main = (json.cards && json.cards.mainboard) || [];
    // Sin repetir: una entrada por nombre de carta.
    const seen = new Set();
    const pool = [];
    for (const c of main) {
      const name = (c.details && c.details.name) || c.name || c.cardID;
      if (!c.cardID || seen.has(name)) continue;
      seen.add(name);
      pool.push({ id: c.cardID, name });
    }
    if (pool.length < PACK_SIZE) throw new Error(`El cubo tiene sólo ${pool.length} cartas.`);
    return { name: json.name || id, pool };
  }

  // Fisher–Yates parcial: saca n elementos al azar del arreglo (lo modifica).
  function draw(arr, n) {
    const out = [];
    for (let i = 0; i < n && arr.length; i++) {
      const j = Math.floor(Math.random() * arr.length);
      out.push(arr[j]);
      arr[j] = arr[arr.length - 1];
      arr.pop();
    }
    return out;
  }

  async function fetchScryfall(ids) {
    const res = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ identifiers: ids.map((id) => ({ id })) }),
    });
    if (!res.ok) throw new Error(`Scryfall respondió ${res.status}.`);
    const json = await res.json();
    return json.data || [];
  }

  function toCard(sc) {
    const uris = sc.image_uris
      ? [sc.image_uris]
      : (sc.card_faces || []).map((f) => f.image_uris).filter(Boolean);
    return {
      name: sc.name,
      faces: uris.map((u) => ({ normal: u.normal, large: u.large || u.normal })),
    };
  }

  async function buildPack() {
    const { name, pool } = await fetchCube(cubeId);
    const picked = [];
    // Si alguna carta no está en Scryfall, se reemplaza por otra del cubo.
    for (let tries = 0; picked.length < PACK_SIZE && tries < 4 && pool.length; tries++) {
      const batch = draw(pool, PACK_SIZE - picked.length);
      const data = await fetchScryfall(batch.map((b) => b.id));
      const byId = new Map(data.map((d) => [d.id, d]));
      for (const b of batch) {
        const sc = byId.get(b.id);
        if (sc) {
          const card = toCard(sc);
          if (card.faces.length) picked.push(card);
        }
      }
    }
    if (picked.length < PACK_SIZE) throw new Error("No se pudieron cargar las imágenes.");
    return { name, cards: picked };
  }

  function preload(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = img.onerror = () => resolve();
      img.src = src;
    });
  }

  // ---------- Render ----------
  function render() {
    viewer.textContent = "";
    dock.textContent = "";
    const fragV = document.createDocumentFragment();
    const fragD = document.createDocumentFragment();

    cards.forEach((c, i) => {
      const big = document.createElement("div");
      big.className = "big";
      const faces = document.createElement("div");
      faces.className = "faces";
      c.faces.forEach((f, k) => {
        const img = document.createElement("img");
        img.src = f.large;
        img.alt = k === 0 ? c.name : `${c.name} (reverso)`;
        img.decoding = "async";
        if (k === 1) img.className = "back";
        faces.appendChild(img);
      });
      big.appendChild(faces);
      c.big = big;
      fragV.appendChild(big);

      const t = document.createElement("button");
      t.className = "thumb";
      t.type = "button";
      t.style.setProperty("--i", i);
      t.setAttribute("role", "option");
      t.setAttribute("aria-label", c.name);
      const timg = document.createElement("img");
      timg.src = c.faces[0].normal;
      timg.alt = "";
      timg.decoding = "async";
      t.appendChild(timg);
      t.addEventListener("click", () => { if (i !== current) goTo(i); });
      c.thumb = t;
      fragD.appendChild(t);
    });

    viewer.appendChild(fragV);
    dock.appendChild(fragD);
  }

  function setCurrent(i) {
    if (i === current) return;
    const prev = cards[current];
    if (prev) {
      prev.big.classList.remove("is-on");
      prev.thumb.classList.remove("is-current");
      prev.thumb.setAttribute("aria-selected", "false");
    }
    current = i;
    const c = cards[i];
    c.big.classList.add("is-on");
    c.thumb.classList.add("is-current");
    c.thumb.setAttribute("aria-selected", "true");
    nameEl.textContent = c.name;
    idxEl.textContent = i + 1;
    flipBtn.hidden = c.faces.length < 2;
  }

  // ---------- Dock con ampliación ----------
  function measure() {
    const t = cards[0] && cards[0].thumb;
    if (!t) return;
    MAG = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--mag")) || 1.85;
    tw = t.offsetWidth;
    const t2 = cards[1] && cards[1].thumb;
    step = t2 ? t2.offsetLeft - t.offsetLeft : tw;
  }

  function bell(d) {
    const a = Math.abs(d);
    return a >= RADIUS ? 0 : (Math.cos((Math.PI * a) / RADIUS) + 1) / 2;
  }

  function updateDock() {
    raf = 0;
    if (!step) return;
    const n = cards.length;
    const f = Math.min(n - 1, Math.max(0, dock.scrollLeft / step));

    // Escalas y desplazamiento acumulado para que las cartas ampliadas no se pisen.
    const extra = new Array(n);
    const D = new Array(n);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const s = 1 + (MAG - 1) * bell(i - f);
      extra[i] = (s - 1) * tw;
      D[i] = acc + extra[i] / 2;
      acc += extra[i];
    }
    const lo = Math.floor(f);
    const hi = Math.min(n - 1, lo + 1);
    const C = D[lo] + (D[hi] - D[lo]) * (f - lo);

    for (let i = 0; i < n; i++) {
      const s = 1 + extra[i] / tw;
      cards[i].thumb.style.transform = `translate3d(${(D[i] - C).toFixed(2)}px,0,0) scale(${s.toFixed(4)})`;
      cards[i].thumb.style.zIndex = String(100 - Math.round(Math.abs(i - f) * 10));
    }

    setCurrent(Math.round(f));
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(updateDock);
  }

  function goTo(i, smooth = true) {
    i = Math.max(0, Math.min(cards.length - 1, i));
    dock.scrollTo({ left: i * step, behavior: smooth ? "smooth" : "auto" });
  }

  dock.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", () => {
    if (!cards.length) return;
    measure();
    goTo(current, false);
    schedule();
  });

  // Rueda vertical → scroll horizontal (desktop).
  dock.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      dock.scrollLeft += e.deltaY;
    }
  }, { passive: false });

  // Teclado.
  window.addEventListener("keydown", (e) => {
    if (!packEl.classList.contains("is-active")) return;
    if (e.key === "ArrowRight") goTo(current + 1);
    else if (e.key === "ArrowLeft") goTo(current - 1);
    else if (e.key === " " || e.key === "f") flip();
  });

  // Deslizar sobre la carta grande = siguiente / anterior. Tocar = girar (si tiene dos caras).
  let sx = 0, sy = 0, st = 0;
  viewer.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; st = performance.now(); });
  viewer.addEventListener("pointerup", (e) => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) goTo(current + (dx < 0 ? 1 : -1));
    else if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && performance.now() - st < 400) flip();
  });

  function flip() {
    const c = cards[current];
    if (c && c.faces.length > 1) c.big.classList.toggle("is-flipped");
  }
  flipBtn.addEventListener("click", flip);

  // ---------- Flujo ----------
  function show(el) {
    for (const s of [startEl, packEl]) s.classList.toggle("is-active", s === el);
  }

  function setStatus(msg, isError = false) {
    statusEl.textContent = msg;
    statusEl.classList.toggle("is-error", isError);
  }

  openBtn.addEventListener("click", async () => {
    if (!cubeId) {
      setStatus("Falta configurar el ID del cubo de CubeCobra (CUBE_ID en app.js).", true);
      return;
    }
    openBtn.classList.add("is-loading");
    setStatus("Buscando cartas…");
    try {
      const pack = await buildPack();
      cards = pack.cards;
      setStatus("Cargando imágenes…");
      // Miniaturas + primeras cartas grandes listas antes de mostrar; el resto sigue en segundo plano.
      const needed = [
        ...cards.map((c) => preload(c.faces[0].normal)),
        ...cards.slice(0, 3).map((c) => preload(c.faces[0].large)),
      ];
      await Promise.race([Promise.all(needed), new Promise((r) => setTimeout(r, 8000))]);

      current = -1;
      render();
      show(packEl);
      measure();
      dock.scrollLeft = 0;
      updateDock();
      setStatus("");
    } catch (err) {
      console.error(err);
      setStatus(err instanceof TypeError ? "Sin conexión con CubeCobra o Scryfall. Probá de nuevo." : err.message, true);
    } finally {
      openBtn.classList.remove("is-loading");
    }
  });

  resetBtn.addEventListener("click", () => {
    show(startEl);
    setTimeout(() => {
      cards = [];
      current = -1;
      viewer.textContent = "";
      dock.textContent = "";
    }, 400);
  });
})();
