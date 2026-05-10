// supabase/functions/send-email/index.ts
// Supabase Edge Function – sichere Brücke zwischen Frontend und Mailjet API
// Deployment: supabase functions deploy send-email

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ── Mailjet Template-IDs ─────────────────────────────────────────────────────
// Trage hier deine Mailjet-Template-IDs ein, nachdem du sie im Mailjet-Dashboard
// erstellt hast (E-Mail-Templates → Transactional Templates).
const TEMPLATE_ORDER_ADMIN  = 8006454; // ← Template: neue Bestellung (an Shop)
const TEMPLATE_ORDER_USER   = 8006459; // ← Template: Bestellbestätigung (an Käufer)
const TEMPLATE_STATUS_PAID      = 8006463; // ← Template: "Bezahlt"-Bestätigung
const TEMPLATE_STATUS_ORDERED   = 8006475; // ← Template: "Bestellt beim Lieferanten"
const TEMPLATE_STATUS_DELIVERED = 8006484; // ← Template: "Ausgeliefert"

const SHOP_EMAIL = "bestellung@merch.st-anna.de";
const SHOP_NAME  = "St. Anna Merch Shop";

// ── CORS-Header (GitHub Pages Domain + localhost für Entwicklung) ─────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // ← optional einschränken auf deine Domain
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Hilfsfunktion: Mailjet API aufrufen ──────────────────────────────────────
async function sendMailjetEmail(payload: object): Promise<void> {
  const MJ_PUBLIC  = Deno.env.get("MJ_APIKEY_PUBLIC")!;
  const MJ_PRIVATE = Deno.env.get("MJ_APIKEY_PRIVATE")!;

  const response = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Basic " + btoa(`${MJ_PUBLIC}:${MJ_PRIVATE}`),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Mailjet API-Fehler ${response.status}: ${errorBody}`);
  }
}

// ── Haupthandler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  // Preflight (CORS)
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
    // AKTION 1: "new_order"
    // Wird von script.js nach einer neuen Bestellung aufgerufen.
    // Sendet zwei E-Mails: eine an den Shop-Admin, eine Bestätigung an den Käufer.
    // ════════════════════════════════════════════════════════════════════
    if (action === "new_order") {
      const order = body.order as Record<string, string>;

      // Pflichtfelder prüfen
      if (!order?.customer_email || !order?.order_id) {
        return new Response(JSON.stringify({ error: "Fehlende Pflichtfelder" }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // Gemeinsame Template-Variablen
      const templateVars = {
        order_id:       order.order_id,
        product_name:   order.product_name   ?? "—",
        product_price:  order.product_price  ?? "—",
        size:           order.size           ?? "—",
        color:          order.color          ?? "—",
        gender:         order.gender         ?? "—",
        class_level:    order.class_level    ?? "—",
        class_letter:   order.class_letter   ?? "—",
        customer_name:  order.customer_name  ?? "—",
        customer_email: order.customer_email,
        note:           order.note           ?? "—",
        order_date:     order.order_date     ?? new Date().toLocaleString("de-DE"),
      };

      // ── Mail 1: Admin-Benachrichtigung ───────────────────────────────
      await sendMailjetEmail({
        Messages: [{
          From:            { Email: SHOP_EMAIL, Name: SHOP_NAME },
          To:              [{ Email: SHOP_EMAIL, Name: SHOP_NAME }],
          TemplateID:      TEMPLATE_ORDER_ADMIN,
          TemplateLanguage: true,
          Variables:       templateVars,
        }],
      });

      // ── Mail 2: Bestätigung an Käufer ───────────────────────────────
      await sendMailjetEmail({
        Messages: [{
          From:            { Email: SHOP_EMAIL, Name: SHOP_NAME },
          To:              [{ Email: order.customer_email, Name: order.customer_name ?? "Kunde" }],
          TemplateID:      TEMPLATE_ORDER_USER,
          TemplateLanguage: true,
          Variables:       templateVars,
        }],
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // AKTION 2: "status_update"
    // Wird von admin.html aufgerufen, wenn ein Status (paid/ordered/delivered)
    // geändert wird und der Admin die Benachrichtigung aktiviert hat.
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

      // Template je nach geändertem Feld wählen
      const templateMap: Record<string, number> = {
        paid:      TEMPLATE_STATUS_PAID,
        ordered:   TEMPLATE_STATUS_ORDERED,
        delivered: TEMPLATE_STATUS_DELIVERED,
      };

      const templateId = templateMap[field];
      if (!templateId) {
        return new Response(JSON.stringify({ error: `Kein Template für Feld '${field}'` }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      await sendMailjetEmail({
        Messages: [{
          From:            { Email: SHOP_EMAIL, Name: SHOP_NAME },
          To:              [{ Email: order.customer_email, Name: order.customer_name ?? "Kunde" }],
          TemplateID:      templateId,
          TemplateLanguage: true,
          Variables: {
            order_id:     order.order_id    ?? "—",
            product_name: order.product_name ?? "—",
            customer_name: order.customer_name ?? "Kunde",
            status_field: field,
            status_value: new_value ? "Ja" : "Nein",
          },
        }],
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Unbekannte Aktion
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
