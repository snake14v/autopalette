document.documentElement.classList.add("js");

const WA = "918884471117";

function waUrl(text) {
  return "https://wa.me/" + WA + "?text=" + encodeURIComponent(text);
}

function sizeHeader() {
  const header = document.querySelector(".site-header");
  if (header) document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
}

function initMenu() {
  const btn = document.getElementById("nav-toggle");
  const nav = document.getElementById("nav-links");
  sizeHeader();
  window.addEventListener("resize", sizeHeader);
  if (!btn || !nav) return;
  const setOpen = (open) => {
    nav.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.style.overflow = open ? "hidden" : "";
  };
  btn.addEventListener("click", () => setOpen(!nav.classList.contains("open")));
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
}

function initReveal() {
  const nodes = document.querySelectorAll(".reveal");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    nodes.forEach((n) => n.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  nodes.forEach((n) => io.observe(n));
}

function initFaq() {
  const items = document.querySelectorAll(".faq-item");
  items.forEach((item) => {
    const btn = item.querySelector("button");
    const panel = item.querySelector(".faq-panel");
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") === "true";
      items.forEach((other) => {
        other.querySelector("button").setAttribute("aria-expanded", "false");
        other.querySelector(".faq-panel").hidden = true;
      });
      if (!open) {
        btn.setAttribute("aria-expanded", "true");
        panel.hidden = false;
      }
    });
  });
}

function initEstimator() {
  const prices = {
    hatchback: { ppf: "35,000", ceramic: "8,000", detailing: "3,500" },
    sedan: { ppf: "45,000", ceramic: "12,000", detailing: "5,000" },
    suv: { ppf: "65,000", ceramic: "18,000", detailing: "7,500" },
  };
  const durations = { ppf: "3–5 days", ceramic: "1–2 days", detailing: "1 day" };
  const labels = {
    hatchback: "Hatchback",
    sedan: "Sedan",
    suv: "SUV / luxury",
    ppf: "PPF",
    ceramic: "Ceramic coating",
    detailing: "Detailing",
  };
  let vehicle = "hatchback";
  let service = "ppf";
  const priceEl = document.getElementById("estimated-price");
  const durEl = document.getElementById("quote-duration");

  function paint() {
    if (priceEl) priceEl.textContent = prices[vehicle][service];
    if (durEl) durEl.textContent = durations[service];
  }

  function bind(group, key) {
    group.querySelectorAll(".opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        group.querySelectorAll(".opt").forEach((b) => {
          b.classList.remove("is-on");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("is-on");
        btn.setAttribute("aria-pressed", "true");
        if (key === "vehicle") vehicle = btn.dataset.value;
        else service = btn.dataset.value;
        paint();
      });
    });
  }

  const vGroup = document.getElementById("vehicle-type");
  const sGroup = document.getElementById("service-type");
  if (!vGroup || !sGroup) return;
  bind(vGroup, "vehicle");
  bind(sGroup, "service");
  paint();

  const wa = document.getElementById("quote-wa");
  if (wa) {
    wa.addEventListener("click", () => {
      const msg =
        "Auto Palette — quote request\n\n" +
        "Vehicle type: " + labels[vehicle] + "\n" +
        "Service: " + labels[service] + "\n" +
        "Typical starting price: ₹" + prices[vehicle][service] + "\n" +
        "Duration: " + durations[service] + "\n\n" +
        "I'd like to confirm this on inspection and book a slot.";
      window.open(waUrl(msg), "_blank", "noopener");
    });
  }
}

function initForm() {
  const form = document.getElementById("enquiry-form");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const msg =
      "New enquiry — Auto Palette website\n\n" +
      "Name: " + data.get("name") + "\n" +
      "Phone: " + data.get("phone") + "\n" +
      "Service: " + data.get("service") + "\n" +
      "Vehicle: " + (data.get("vehicle") || "Not specified") + "\n" +
      "Notes: " + (data.get("notes") || "None");
    window.open(waUrl(msg), "_blank", "noopener");
  });
}

function initPixelCar() {
  const canvas = document.getElementById("pixel-car");
  const track = canvas && canvas.parentElement;
  if (!canvas || !track) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rows = [
    ".............111111111111...............",
    "...........1113333333333111.............",
    "..........113333333333333311............",
    ".........11333333333333333311...........",
    "........1133333333333333333311..........",
    ".551111112222222222222222222222222444...",
    ".552222222222222222222222222222222244...",
    ".5522222222222222222222222222222222244..",
    "..122222226662222222222222266622222444..",
    "..1111111666661111111111116666611111....",
    "........6667666..........6667666........",
    "........6677766..........6677766........",
    "........6666666..........6666666........",
    ".........66666............66666.........",
    "..........666..............666..........",
  ];
  const dirty = [[6, 10], [6, 22], [7, 14], [7, 28]];
  const base = {
    1: [12, 12, 14],
    2: [236, 244, 250],
    3: [46, 110, 168],
    4: [255, 214, 60],
    5: [230, 42, 72],
    6: [52, 54, 62],
    7: [230, 232, 236],
  };
  const dusty = [150, 136, 118];
  const cleanBody = [236, 244, 250];
  const mud = [92, 72, 52];
  const sw = rows[0].length;
  const sh = rows.length;
  let cssW = 0;
  let scale = 3;
  let dpr = 1;
  let x = -80;
  let last = 0;
  let raf = 0;
  const bubbles = [];
  const sparkles = [];

  function resize() {
    cssW = track.clientWidth;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    scale = cssW < 520 ? 4 : 5;
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.floor(108 * dpr);
  }

  function mix(a, b, t) {
    return a.map((v, i) => Math.round(v + (b[i] - v) * t));
  }

  function fill(ctx, col, px, py, s) {
    ctx.fillStyle = "rgb(" + col[0] + "," + col[1] + "," + col[2] + ")";
    ctx.fillRect(px, py, s, s);
  }

  function drawCar(ctx, left, top, s, cleanT) {
    const body = mix(dusty, cleanBody, cleanT);
    for (let y = 0; y < sh; y++) {
      for (let x0 = 0; x0 < sw; x0++) {
        const ch = rows[y][x0];
        if (ch === "." || ch === "0") continue;
        let col = base[ch];
        if (ch === "2") col = body;
        fill(ctx, col, left + x0 * s, top + y * s, s);
      }
    }
    if (cleanT < 0.72) {
      dirty.forEach(([y, x0]) => {
        if (rows[y] && rows[y][x0] === "2") fill(ctx, mud, left + x0 * s, top + y * s, s);
      });
    }
  }

  function spawn(list, px, py, kind) {
    list.push({
      x: px + Math.random() * 24 - 8,
      y: py,
      vy: kind === "b" ? -(18 + Math.random() * 28) : -(10 + Math.random() * 16),
      life: 1,
      kind,
    });
  }

  function drawFx(ctx, list, s) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.y += p.vy * 0.016;
      p.life -= 0.012;
      if (p.life <= 0) { list.splice(i, 1); continue; }
      const col = p.kind === "b" ? [142, 230, 255] : [243, 239, 106];
      const px = Math.round(p.x);
      const py = Math.round(p.y);
      fill(ctx, col, px, py, s);
      if (p.kind === "s") {
        fill(ctx, col, px - s, py, s);
        fill(ctx, col, px + s, py, s);
        fill(ctx, col, px, py - s, s);
        fill(ctx, col, px, py + s, s);
      } else {
        fill(ctx, [255, 255, 255], px + s, py - s, s);
      }
    }
  }

  function frame(now) {
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = scale * dpr;
    const ground = Math.floor(96 * dpr);
    ctx.fillStyle = "#1c1c22";
    ctx.fillRect(0, ground, canvas.width, Math.max(4, 3 * dpr));
    const dt = Math.min(0.04, (now - last) / 1000 || 0.016);
    last = now;
    const speed = cssW < 520 ? 70 : 110;
    if (!reduce) x += speed * dt;
    const carPx = sw * scale;
    if (x > cssW + 20) {
      x = -carPx - 10;
      bubbles.length = 0;
      sparkles.length = 0;
    }
    const center = (x + carPx / 2) / cssW;
    let cleanT = 0;
    if (center < 0.22) cleanT = 0;
    else if (center < 0.58) cleanT = (center - 0.22) / 0.36;
    else cleanT = 1;
    const top = Math.floor((96 - sh * scale) * dpr);
    const left = Math.floor(x * dpr);
    if (!reduce && center > 0.18 && center < 0.5 && bubbles.length < 28 && Math.random() < 0.7) {
      spawn(bubbles, left + carPx * dpr * 0.45, top + 4 * s, "b");
    }
    if (!reduce && center > 0.55 && center < 0.86 && sparkles.length < 20 && Math.random() < 0.55) {
      spawn(sparkles, left + carPx * dpr * 0.7, top, "s");
    }
    drawFx(ctx, bubbles, Math.max(2, s / 2));
    drawCar(ctx, left, top, s, cleanT);
    drawFx(ctx, sparkles, Math.max(2, s / 2));
    if (!reduce) raf = requestAnimationFrame(frame);
  }

  resize();
  if (reduce) {
    x = Math.max(16, cssW * 0.5 - (sw * scale) / 2);
    frame(0);
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          last = performance.now();
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(frame);
        } else {
          cancelAnimationFrame(raf);
        }
      });
    });
    io.observe(track);
  }
  window.addEventListener("resize", () => {
    resize();
    if (reduce) {
      x = Math.max(16, cssW * 0.5 - (sw * scale) / 2);
      frame(0);
    }
  });
}

initMenu();
initReveal();
initFaq();
initEstimator();
initForm();
initPixelCar();
