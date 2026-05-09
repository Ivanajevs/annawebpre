/* ═══════════════════════════════════════════════════════════════════
   St. Anna Merch Shop – script.js
   ═══════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────────────
   ① EMAILJS KONFIGURATION
   ───────────────────────────────────────────────────────────────────── */
const EMAILJS_PUBLIC_KEY   = "Dud4-yGPgxrJfb0ny";
const EMAILJS_SERVICE_ID   = "service_n850bzk";
const EMAILJS_ADMIN_TPL_ID = "template_8qh2y65";
const EMAILJS_USER_TPL_ID  = "template_giifnmo";

/* ─────────────────────────────────────────────────────────────────────
   ② SUPABASE KONFIGURATION
   ▶ Ersetze die beiden Platzhalter mit deinen echten Werten aus:
     Supabase Dashboard → Project Settings → API
   ───────────────────────────────────────────────────────────────────── */
const SUPABASE_URL      = "https://ilbfdcwlmucsyqepurcp.supabase.co";   // ← anpassen
const SUPABASE_ANON_KEY = "sb_publishable_cyQE2-XQdw1r8WzP6WnEkA_qjaDAfm1";                   // ← anpassen

// Supabase-Client initialisieren (CDN-Import – siehe index.html)
const { createClient } = supabase;
const supabaseClient   = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ─────────────────────────────────────────────────────────────────────
   ③ PRODUKTDATEN
   ───────────────────────────────────────────────────────────────────── */
const products = [
  {
    id: 1,
    name: "Polo Shirt",
    price: "24,99 €",
    desc: "Unser in der EU gefertigter Polo-Klassiker aus 100 % Baumwolle.",
    badge: "First edition",
    img: "polo.jpeg",
    colors: [
      { hex: "#000670", name: "Blau" },
      { hex: "#ffffff", name: "Weiß" },
      { hex: "#000000", name: "Schwarz" },
    ],
  },
  {
    id: 2,
    name: "T-Shirt",
    price: "19,99 €",
    desc: "Leichtes 100 % Baumwoll-Shirt für jeden Tag.",
    badge: "NEU",
    img: "tshirt.jpeg",
    colors: [
      { hex: "#000564", name: "Blau" },
      { hex: "#ffffff", name: "Weiß" },
      { hex: "#000000", name: "Schwarz" },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────────────
   ④ STATE
   ───────────────────────────────────────────────────────────────────── */
let currentProduct = null;

/* ─────────────────────────────────────────────────────────────────────
   ⑤ EINDEUTIGE BESTELL-ID GENERIEREN
   Format: SA-<Zeitstempel Base36>-<4 Zufallszeichen>
   Beispiel: SA-LR8K2A-F3TQ
   ───────────────────────────────────────────────────────────────────── */
function generateOrderId() {
  const ts   = Date.now().toString(36).toUpperCase();          // zeitbasiert
  const rand = Math.random().toString(36).substr(2, 4).toUpperCase(); // zufällig
  return `SA-${ts}-${rand}`;
}

/* ─────────────────────────────────────────────────────────────────────
   ⑥ PRODUKTE RENDERN
   ───────────────────────────────────────────────────────────────────── */
function renderProducts() {
  const grid = document.getElementById("productsGrid");
  grid.innerHTML = "";

  products.forEach((p, idx) => {
    const colorDots = p.colors
      .map(c => `<span class="color-dot" style="background:${c.hex}" title="${c.name}"
                   ${c.hex === "#ffffff" ? 'style="background:#fff;border-color:#bbb"' : ""}></span>`)
      .join("");

    const badgeHTML = p.badge
      ? `<span class="card-badge">${p.badge}</span>`
      : "";

    const card = document.createElement("article");
    card.className = "product-card";
    card.style.animationDelay = `${idx * 0.07}s`;
    card.setAttribute("data-id", p.id);
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `${p.name} bestellen`);

    card.innerHTML = `
      <div class="card-img-wrap">
        ${badgeHTML}
        <img src="${p.img}" alt="${p.name}" loading="lazy"
             onerror="this.src='https://placehold.co/400x400/12131f/e8a020?text=${encodeURIComponent(p.name)}'">
      </div>
      <div class="card-body">
        <h3 class="card-name">${p.name}</h3>
        <p class="card-desc">${p.desc}</p>
        <div class="card-colors">${colorDots}</div>
        <div class="card-footer">
          <span class="card-price">${p.price}</span>
          <button class="card-btn">Bestellen</button>
        </div>
      </div>`;

    card.addEventListener("click", () => openModal(p));
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") openModal(p);
    });

    grid.appendChild(card);
  });
}

/* ─────────────────────────────────────────────────────────────────────
   ⑦ FARB-PICKER
   ───────────────────────────────────────────────────────────────────── */
function buildColorPicker(colors) {
  const row    = document.getElementById("colorSwatchRow");
  const hidden = document.getElementById("fieldColor");
  const label  = document.getElementById("colorSelectedLabel");

  row.innerHTML = "";
  hidden.value  = "";
  label.textContent = "";

  colors.forEach(c => {
    const btn = document.createElement("button");
    btn.type  = "button";
    btn.className = "color-swatch";
    btn.setAttribute("aria-label", c.name);
    btn.setAttribute("title", c.name);
    btn.style.setProperty("--swatch-color", c.hex);
    if (c.hex === "#ffffff" || c.hex === "#fff") {
      btn.classList.add("color-swatch--light");
    }

    btn.addEventListener("click", () => {
      row.querySelectorAll(".color-swatch").forEach(b => b.classList.remove("is-selected"));
      btn.classList.add("is-selected");
      hidden.value      = c.name;
      label.textContent = c.name;
    });

    row.appendChild(btn);
  });
}

/* ─────────────────────────────────────────────────────────────────────
   ⑧ MODAL – ÖFFNEN / SCHLIESSEN
   ───────────────────────────────────────────────────────────────────── */
function openModal(product) {
  currentProduct = product;

  const img = document.getElementById("modalImg");
  img.src   = product.img;
  img.alt   = product.name;
  img.onerror = function () {
    this.src = `https://placehold.co/100x100/12131f/e8a020?text=${encodeURIComponent(product.name)}`;
  };
  document.getElementById("modalTitle").textContent = product.name;
  document.getElementById("modalPrice").textContent  = product.price;

  buildColorPicker(product.colors);

  document.getElementById("orderForm").reset();
  document.getElementById("fieldColor").value = "";
  document.getElementById("colorSelectedLabel").textContent = "";
  document.getElementById("colorSwatchRow")
    .querySelectorAll(".color-swatch")
    .forEach(b => b.classList.remove("is-selected"));

  document.getElementById("orderForm").hidden   = false;
  document.getElementById("modalSuccess").hidden = true;
  document.getElementById("formError").textContent = "";
  document.getElementById("submitLabel").textContent = "Bestellung absenden";
  document.getElementById("submitSpinner").hidden    = true;
  document.getElementById("submitBtn").disabled      = false;

  document.getElementById("modalOverlay").classList.add("active");
  document.body.style.overflow = "hidden";
  setTimeout(() => document.getElementById("modalClose").focus(), 350);
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("active");
  document.body.style.overflow = "";
  currentProduct = null;
}

document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("modalOverlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
});
document.getElementById("successClose").addEventListener("click", closeModal);

/* ─────────────────────────────────────────────────────────────────────
   ⑨ FORMULAR-VALIDIERUNG
   ───────────────────────────────────────────────────────────────────── */
function validateForm() {
  const fields = [
    { id: "fieldSize",        label: "Größe" },
    { id: "fieldColor",       label: "Farbe" },
    { id: "fieldGender",      label: "Geschlecht" },
    { id: "fieldClassLevel",  label: "Klassenstufe" },
    { id: "fieldClassLetter", label: "Klassenbuchstabe" },
    { id: "fieldName",        label: "Vollständiger Name" },
    { id: "fieldEmail",       label: "E-Mail" },
  ];

  for (const f of fields) {
    const el = document.getElementById(f.id);
    if (!el.value.trim()) return `Bitte das Feld „${f.label}" ausfüllen.`;
  }

  const email = document.getElementById("fieldEmail").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Bitte eine gültige E-Mail-Adresse eingeben.";
  }

  return null;
}

/* ─────────────────────────────────────────────────────────────────────
   ⑩ BESTELLUNG ABSENDEN
   Ablauf:
     1. Bestell-ID generieren
     2. Daten in Supabase speichern
     3. Zwei E-Mails via EmailJS versenden (inkl. order_id)
   ───────────────────────────────────────────────────────────────────── */
document.getElementById("orderForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const error = validateForm();
  if (error) {
    document.getElementById("formError").textContent = error;
    return;
  }
  document.getElementById("formError").textContent = "";

  // UI: Lade-Status
  document.getElementById("submitLabel").textContent = "Wird gesendet…";
  document.getElementById("submitSpinner").hidden    = false;
  document.getElementById("submitBtn").disabled      = true;

  // ── Bestell-ID ────────────────────────────────────────────────────
  const orderId = generateOrderId();

  // ── Daten sammeln ─────────────────────────────────────────────────
  const orderData = {
    order_id:       orderId,
    product_name:   currentProduct.name,
    product_price:  currentProduct.price,
    product_img:    window.location.origin + "/" + currentProduct.img,
    size:           document.getElementById("fieldSize").value,
    color:          document.getElementById("fieldColor").value,
    gender:         document.getElementById("fieldGender").value,
    class_level:    document.getElementById("fieldClassLevel").value,
    class_letter:   document.getElementById("fieldClassLetter").value,
    customer_name:  document.getElementById("fieldName").value.trim(),
    customer_email: document.getElementById("fieldEmail").value.trim(),
    note:           document.getElementById("fieldNote").value.trim() || "—",
    order_date:     new Date().toLocaleDateString("de-DE", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    }),
    reply_to: document.getElementById("fieldEmail").value.trim(),
  };

  try {
    // ── Schritt 1: In Supabase speichern ──────────────────────────
    const { error: dbError } = await supabaseClient
      .from("orders")
      .insert({
        order_id:       orderData.order_id,
        product_name:   orderData.product_name,
        product_price:  orderData.product_price,
        size:           orderData.size,
        color:          orderData.color,
        gender:         orderData.gender,
        class_level:    orderData.class_level,
        class_letter:   orderData.class_letter,
        customer_name:  orderData.customer_name,
        customer_email: orderData.customer_email,
        note:           orderData.note,
      });

    if (dbError) throw new Error("Supabase: " + dbError.message);

    // ── Schritt 2: Mail an den Shop ────────────────────────────────
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_ADMIN_TPL_ID, {
      ...orderData,
      to_email: "bestellung@merch.st-anna.de",
    });

    // ── Schritt 3: Bestätigungsmail an den Käufer ─────────────────
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_USER_TPL_ID, {
      ...orderData,
      to_email: orderData.customer_email,
    });

    // ── Erfolg anzeigen ───────────────────────────────────────────
    // Bestell-ID im Erfolgs-Panel anzeigen
    const successPanel = document.getElementById("modalSuccess");
    const existingId   = successPanel.querySelector(".success-order-id");
    if (!existingId) {
      const idEl = document.createElement("p");
      idEl.className = "success-order-id";
      idEl.innerHTML = `Deine Bestell-ID: <strong>${orderId}</strong>`;
      successPanel.insertBefore(idEl, successPanel.querySelector(".success-note"));
    } else {
      existingId.innerHTML = `Deine Bestell-ID: <strong>${orderId}</strong>`;
    }

    document.getElementById("orderForm").hidden    = true;
    document.getElementById("modalSuccess").hidden = false;

  } catch (err) {
    console.error("Fehler:", err);
    document.getElementById("formError").textContent =
      "Beim Senden ist ein Fehler aufgetreten. Bitte versuche es erneut oder schreibe uns direkt an bestellung@merch.st-anna.de";
    document.getElementById("submitLabel").textContent = "Bestellung absenden";
    document.getElementById("submitSpinner").hidden    = true;
    document.getElementById("submitBtn").disabled      = false;
  }
});

/* ─────────────────────────────────────────────────────────────────────
   ⑪ APP STARTEN
   ───────────────────────────────────────────────────────────────────── */
(function init() {
  emailjs.init(EMAILJS_PUBLIC_KEY);
  renderProducts();
})();
