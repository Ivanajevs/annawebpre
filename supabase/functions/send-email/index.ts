// supabase/functions/send-email/index.ts
// Supabase Edge Function – E-Mail-Versand über Resend API
// Deployment: supabase functions deploy send-email --project-ref ilbfdcwlmucsyqepurcp

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ── Konfiguration ─────────────────────────────────────────────────────────────
const ADMIN_EMAIL = "st.anna.merch@protonmail.com";
const FROM_EMAIL  = "St. Anna Merch Shop <bestellung@merch.st-anna.de>";
const SHOP_NAME   = "St. Anna Merch Shop";

// ── CORS-Header ───────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Hilfsfunktion: Resend API aufrufen ───────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to:   [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend API-Fehler ${response.status}: ${errorBody}`);
  }
}

// ── HTML-Templates ────────────────────────────────────────────────────────────

function templateBase(content: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${SHOP_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#0e0f1a;font-family:'Segoe UI',Arial,sans-serif;color:#e8e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0f1a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:#12131f;border-radius:12px 12px 0 0;padding:28px 32px;border-bottom:2px solid #e8a020;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:28px;font-weight:900;letter-spacing:2px;color:#e8a020;text-transform:uppercase;">St. Anna</div>
                <div style="font-size:11px;color:#a0a0b8;letter-spacing:3px;text-transform:uppercase;margin-top:2px;">Merch Shop · Wuppertal</div>
              </td>
              <td align="right">
                <div style="background:#e8a020;color:#000;font-size:10px;font-weight:700;padding:5px 12px;border-radius:99px;letter-spacing:1.5px;text-transform:uppercase;display:inline-block;">2025</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Content -->
        <tr><td style="background:#1a1b2e;padding:32px;">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#12131f;border-radius:0 0 12px 12px;padding:20px 32px;border-top:1px solid rgba(232,160,32,0.15);">
          <p style="margin:0;font-size:11px;color:#60607a;text-align:center;line-height:1.6;">
            © 2025 St.-Anna-Gymnasium Wuppertal · SchülerAG · Kein kommerzieller Anbieter<br/>
            Bei Fragen: <a href="mailto:bestellung@merch.st-anna.de" style="color:#e8a020;text-decoration:none;">bestellung@merch.st-anna.de</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Template 1: Admin-Benachrichtigung bei neuer Bestellung
function templateAdminNewOrder(o: Record<string, string>): string {
  const content = `
    <div style="display:inline-block;background:rgba(232,160,32,0.12);border:1px solid rgba(232,160,32,0.3);border-radius:8px;padding:6px 14px;margin-bottom:20px;">
      <span style="color:#e8a020;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">🛒 Neue Bestellung</span>
    </div>
    <h2 style="margin:0 0 6px;font-size:22px;color:#ffffff;font-weight:700;">Bestellung eingegangen</h2>
    <p style="margin:0 0 24px;color:#a0a0b8;font-size:14px;">Bestell-ID: <strong style="color:#e8a020;font-family:monospace;">${o.order_id}</strong> · ${o.order_date}</p>

    <!-- Produkt -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#12131f;border-radius:10px;margin-bottom:20px;overflow:hidden;">
      <tr><td style="padding:14px 18px;border-bottom:1px solid rgba(232,160,32,0.1);">
        <p style="margin:0;font-size:11px;color:#60607a;text-transform:uppercase;letter-spacing:1.5px;">Produkt</p>
        <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#fff;">${o.product_name}</p>
        <p style="margin:2px 0 0;font-size:15px;color:#e8a020;font-weight:600;">${o.product_price}</p>
      </td></tr>
      <tr><td style="padding:14px 18px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:50%;padding-right:8px;">
              <p style="margin:0;font-size:11px;color:#60607a;text-transform:uppercase;letter-spacing:1px;">Größe</p>
              <p style="margin:3px 0 0;font-size:14px;color:#e8e8f0;font-weight:600;">${o.size}</p>
            </td>
            <td style="width:50%;padding-left:8px;">
              <p style="margin:0;font-size:11px;color:#60607a;text-transform:uppercase;letter-spacing:1px;">Farbe</p>
              <p style="margin:3px 0 0;font-size:14px;color:#e8e8f0;font-weight:600;">${o.color}</p>
            </td>
          </tr>
          <tr><td style="padding-top:12px;padding-right:8px;">
            <p style="margin:0;font-size:11px;color:#60607a;text-transform:uppercase;letter-spacing:1px;">Geschlecht</p>
            <p style="margin:3px 0 0;font-size:14px;color:#e8e8f0;font-weight:600;">${o.gender}</p>
          </td>
          <td style="padding-top:12px;padding-left:8px;">
            <p style="margin:0;font-size:11px;color:#60607a;text-transform:uppercase;letter-spacing:1px;">Klasse</p>
            <p style="margin:3px 0 0;font-size:14px;color:#e8e8f0;font-weight:600;">${o.class_level}${o.class_letter}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>

    <!-- Kunde -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#12131f;border-radius:10px;margin-bottom:20px;overflow:hidden;">
      <tr><td style="padding:14px 18px;border-bottom:1px solid rgba(232,160,32,0.1);">
        <p style="margin:0;font-size:11px;color:#60607a;text-transform:uppercase;letter-spacing:1.5px;">Kunde</p>
      </td></tr>
      <tr><td style="padding:14px 18px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:50%;padding-right:8px;">
              <p style="margin:0;font-size:11px;color:#60607a;text-transform:uppercase;letter-spacing:1px;">Name</p>
              <p style="margin:3px 0 0;font-size:14px;color:#e8e8f0;font-weight:600;">${o.customer_name}</p>
            </td>
            <td style="width:50%;padding-left:8px;">
              <p style="margin:0;font-size:11px;color:#60607a;text-transform:uppercase;letter-spacing:1px;">E-Mail</p>
              <p style="margin:3px 0 0;font-size:14px;color:#e8a020;">${o.customer_email}</p>
            </td>
          </tr>
          <tr><td colspan="2" style="padding-top:12px;">
            <p style="margin:0;font-size:11px;color:#60607a;text-transform:uppercase;letter-spacing:1px;">Anmerkung</p>
            <p style="margin:3px 0 0;font-size:14px;color:#e8e8f0;">${o.note || "—"}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>

    <p style="margin:0;font-size:13px;color:#60607a;text-align:center;">
      Die Bestellung wurde in der Supabase-Datenbank gespeichert.
    </p>
  `;
  return templateBase(content);
}

// Template 2: Bestellbestätigung an Käufer
function templateUserConfirmation(o: Record<string, string>): string {
  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="width:60px;height:60px;background:rgba(34,197,94,0.15);border:2px solid rgba(34,197,94,0.4);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:16px;">✓</div>
      <h2 style="margin:0 0 8px;font-size:24px;color:#ffffff;font-weight:700;">Bestellung bestätigt!</h2>
      <p style="margin:0;color:#a0a0b8;font-size:14px;line-height:1.6;">
        Hallo <strong style="color:#fff;">${o.customer_name}</strong>, deine Bestellung ist eingegangen.<br/>
        Wir melden uns, sobald alles fertig ist.
      </p>
    </div>

    <!-- Bestell-ID Box -->
    <div style="background:rgba(232,160,32,0.08);border:1px solid rgba(232,160,32,0.25);border-radius:10px;padding:16px;text-align:center;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;color:#60607a;text-transform:uppercase;letter-spacing:1.5px;">Deine Bestell-ID</p>
      <p style="margin:0;font-size:20px;font-weight:700;color:#e8a020;font-family:monospace;letter-spacing:2px;">${o.order_id}</p>
      <p style="margin:6px 0 0;font-size:12px;color:#60607a;">${o.order_date}</p>
    </div>

    <!-- Zusammenfassung -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#12131f;border-radius:10px;margin-bottom:24px;overflow:hidden;">
      <tr><td style="padding:14px 18px;border-bottom:1px solid rgba(232,160,32,0.1);">
        <p style="margin:0;font-size:12px;color:#a0a0b8;font-weight:600;text-transform:uppercase;letter-spacing:1px;">📦 Deine Bestellung</p>
      </td></tr>
      <tr><td style="padding:18px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td colspan="2" style="padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:18px;font-weight:700;color:#fff;">${o.product_name}</p>
              <p style="margin:4px 0 0;font-size:15px;color:#e8a020;font-weight:600;">${o.product_price}</p>
            </td>
          </tr>
          <tr><td style="padding-top:14px;width:50%;vertical-align:top;padding-right:8px;">
            <p style="margin:0;font-size:11px;color:#60607a;text-transform:uppercase;letter-spacing:1px;">Größe</p>
            <p style="margin:3px 0 12px;font-size:14px;color:#e8e8f0;font-weight:600;">${o.size}</p>
            <p style="margin:0;font-size:11px;color:#60607a;text-transform:uppercase;letter-spacing:1px;">Farbe</p>
            <p style="margin:3px 0 0;font-size:14px;color:#e8e8f0;font-weight:600;">${o.color}</p>
          </td>
          <td style="padding-top:14px;width:50%;vertical-align:top;padding-left:8px;">
            <p style="margin:0;font-size:11px;color:#60607a;text-transform:uppercase;letter-spacing:1px;">Geschlecht</p>
            <p style="margin:3px 0 12px;font-size:14px;color:#e8e8f0;font-weight:600;">${o.gender}</p>
            <p style="margin:0;font-size:11px;color:#60607a;text-transform:uppercase;letter-spacing:1px;">Klasse</p>
            <p style="margin:3px 0 0;font-size:14px;color:#e8e8f0;font-weight:600;">${o.class_level}${o.class_letter}</p>
          </td></tr>
          ${o.note && o.note !== "—" ? `
          <tr><td colspan="2" style="padding-top:14px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:11px;color:#60607a;text-transform:uppercase;letter-spacing:1px;">Anmerkung</p>
            <p style="margin:3px 0 0;font-size:14px;color:#e8e8f0;">${o.note}</p>
          </td></tr>` : ""}
        </table>
      </td></tr>
    </table>

    <div style="background:rgba(232,160,32,0.05);border-left:3px solid #e8a020;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#a0a0b8;line-height:1.6;">
        💡 <strong style="color:#e8a020;">Hinweis:</strong> Bitte überprüfe auch deinen Spam-Ordner. 
        Bei Fragen wende dich an <a href="mailto:bestellung@merch.st-anna.de" style="color:#e8a020;text-decoration:none;">bestellung@merch.st-anna.de</a>
      </p>
    </div>
  `;
  return templateBase(content);
}

// Template 3a: Status "Bezahlt"
function templateStatusPaid(o: Record<string, string>): string {
  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:48px;margin-bottom:12px;">💳</div>
      <h2 style="margin:0 0 8px;font-size:22px;color:#22c55e;font-weight:700;">Zahlung bestätigt</h2>
      <p style="margin:0;color:#a0a0b8;font-size:14px;line-height:1.6;">
        Hallo <strong style="color:#fff;">${o.customer_name}</strong>, deine Zahlung für Bestellung 
        <strong style="color:#e8a020;font-family:monospace;">${o.order_id}</strong> wurde erfolgreich verbucht.
      </p>
    </div>
    <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:10px;padding:20px;text-align:center;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#a0a0b8;">Produkt</p>
      <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#fff;">${o.product_name}</p>
      <div style="display:inline-block;background:#22c55e;color:#000;font-size:12px;font-weight:700;padding:4px 14px;border-radius:99px;margin-top:10px;text-transform:uppercase;letter-spacing:1px;">✓ Bezahlt</div>
    </div>
    <p style="margin:0;font-size:13px;color:#60607a;text-align:center;line-height:1.6;">
      Wir kümmern uns nun um die Bestellung beim Lieferanten.<br/>
      Du erhältst eine weitere Benachrichtigung, sobald dein Artikel versendet wurde.
    </p>
  `;
  return templateBase(content);
}

// Template 3b: Status "Bestellt beim Lieferanten"
function templateStatusOrdered(o: Record<string, string>): string {
  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:48px;margin-bottom:12px;">📦</div>
      <h2 style="margin:0 0 8px;font-size:22px;color:#60a5fa;font-weight:700;">Beim Lieferanten bestellt</h2>
      <p style="margin:0;color:#a0a0b8;font-size:14px;line-height:1.6;">
        Hallo <strong style="color:#fff;">${o.customer_name}</strong>, dein Artikel aus Bestellung 
        <strong style="color:#e8a020;font-family:monospace;">${o.order_id}</strong> wurde beim Lieferanten bestellt.
      </p>
    </div>
    <div style="background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.25);border-radius:10px;padding:20px;text-align:center;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#a0a0b8;">Dein Artikel</p>
      <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#fff;">${o.product_name}</p>
      <div style="display:inline-block;background:#60a5fa;color:#000;font-size:12px;font-weight:700;padding:4px 14px;border-radius:99px;margin-top:10px;text-transform:uppercase;letter-spacing:1px;">📦 In Bearbeitung</div>
    </div>

    <!-- Fortschrittsbalken -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td align="center" style="width:33%;">
          <div style="width:28px;height:28px;background:#22c55e;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#000;font-size:12px;font-weight:700;margin-bottom:6px;">✓</div>
          <p style="margin:0;font-size:10px;color:#22c55e;text-transform:uppercase;letter-spacing:1px;">Bezahlt</p>
        </td>
        <td align="center" style="width:33%;">
          <div style="width:28px;height:28px;background:#60a5fa;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#000;font-size:12px;font-weight:700;margin-bottom:6px;">✓</div>
          <p style="margin:0;font-size:10px;color:#60a5fa;text-transform:uppercase;letter-spacing:1px;">Bestellt</p>
        </td>
        <td align="center" style="width:33%;">
          <div style="width:28px;height:28px;background:#2d2e45;border:2px solid rgba(255,255,255,0.1);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#60607a;font-size:12px;margin-bottom:6px;">·</div>
          <p style="margin:0;font-size:10px;color:#60607a;text-transform:uppercase;letter-spacing:1px;">Abgeholt</p>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:#60607a;text-align:center;line-height:1.6;">
      Wir informieren dich, sobald dein Artikel abgeholt werden kann.
    </p>
  `;
  return templateBase(content);
}

// Template 3c: Status "Ausgeliefert / Abholbereit"
function templateStatusDelivered(o: Record<string, string>): string {
  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:48px;margin-bottom:12px;">🎉</div>
      <h2 style="margin:0 0 8px;font-size:24px;color:#e8a020;font-weight:700;">Dein Artikel ist da!</h2>
      <p style="margin:0;color:#a0a0b8;font-size:14px;line-height:1.6;">
        Hallo <strong style="color:#fff;">${o.customer_name}</strong>, dein Merch aus Bestellung 
        <strong style="color:#e8a020;font-family:monospace;">${o.order_id}</strong> ist angekommen und bereit zur Abholung.
      </p>
    </div>

    <div style="background:rgba(232,160,32,0.1);border:2px solid rgba(232,160,32,0.4);border-radius:12px;padding:22px;text-align:center;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#a0a0b8;">Dein Artikel</p>
      <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#fff;">${o.product_name}</p>
      <div style="display:inline-block;background:#e8a020;color:#000;font-size:12px;font-weight:700;padding:6px 18px;border-radius:99px;margin-top:12px;text-transform:uppercase;letter-spacing:1px;">🎉 Bereit zur Abholung</div>
    </div>

    <!-- Fortschrittsbalken komplett -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td align="center" style="width:33%;">
          <div style="width:28px;height:28px;background:#22c55e;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#000;font-size:12px;font-weight:700;margin-bottom:6px;">✓</div>
          <p style="margin:0;font-size:10px;color:#22c55e;text-transform:uppercase;letter-spacing:1px;">Bezahlt</p>
        </td>
        <td align="center" style="width:33%;">
          <div style="width:28px;height:28px;background:#22c55e;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#000;font-size:12px;font-weight:700;margin-bottom:6px;">✓</div>
          <p style="margin:0;font-size:10px;color:#22c55e;text-transform:uppercase;letter-spacing:1px;">Bestellt</p>
        </td>
        <td align="center" style="width:33%;">
          <div style="width:28px;height:28px;background:#e8a020;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#000;font-size:12px;font-weight:700;margin-bottom:6px;">✓</div>
          <p style="margin:0;font-size:10px;color:#e8a020;text-transform:uppercase;letter-spacing:1px;">Abholbereit</p>
        </td>
      </tr>
    </table>

    <div style="background:rgba(232,160,32,0.05);border-left:3px solid #e8a020;border-radius:0 8px 8px 0;padding:14px 16px;">
      <p style="margin:0;font-size:13px;color:#a0a0b8;line-height:1.6;">
        📍 Bitte sprich uns in der Schule an oder antworte auf diese Mail, um einen Abholtermin zu vereinbaren.<br/>
        Kontakt: <a href="mailto:bestellung@merch.st-anna.de" style="color:#e8a020;text-decoration:none;">bestellung@merch.st-anna.de</a>
      </p>
    </div>
  `;
  return templateBase(content);
}

// ── Haupthandler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ungültiges JSON" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const action = body.action as string;

  try {
    // ════════════════════════════════════════════════════════════════════
    // AKTION 1: "new_order" – Neue Bestellung
    // ════════════════════════════════════════════════════════════════════
    if (action === "new_order") {
      const order = body.order as Record<string, string>;

      if (!order?.customer_email || !order?.order_id) {
        return new Response(JSON.stringify({ error: "Fehlende Pflichtfelder" }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // Mail 1: Admin-Benachrichtigung
      await sendEmail(
        ADMIN_EMAIL,
        `🛒 Neue Bestellung ${order.order_id} – ${order.customer_name}`,
        templateAdminNewOrder(order),
      );

      // Mail 2: Bestätigung an Käufer
      await sendEmail(
        order.customer_email,
        `Bestellbestätigung – ${order.product_name} (${order.order_id})`,
        templateUserConfirmation(order),
      );

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // AKTION 2: "status_update" – Statusänderung
    // ════════════════════════════════════════════════════════════════════
    if (action === "status_update") {
      const { order, field, new_value } = body as {
        order:     Record<string, string>;
        field:     string;
        new_value: boolean;
      };

      if (!order?.customer_email) {
        return new Response(JSON.stringify({ error: "Keine Kunden-E-Mail vorhanden" }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // Nur bei Aktivierung (true) eine Mail senden
      if (!new_value) {
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const subjectMap: Record<string, string> = {
        paid:      `💳 Zahlung bestätigt – Bestellung ${order.order_id}`,
        ordered:   `📦 Dein Artikel wurde bestellt – ${order.order_id}`,
        delivered: `🎉 Dein Merch ist abholbereit! – ${order.order_id}`,
      };

      const templateMap: Record<string, (o: Record<string, string>) => string> = {
        paid:      templateStatusPaid,
        ordered:   templateStatusOrdered,
        delivered: templateStatusDelivered,
      };

      const templateFn = templateMap[field];
      if (!templateFn) {
        return new Response(JSON.stringify({ error: `Kein Template für Feld '${field}'` }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      await sendEmail(
        order.customer_email,
        subjectMap[field],
        templateFn(order),
      );

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unbekannte Aktion: ${action}` }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Edge Function Fehler:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
