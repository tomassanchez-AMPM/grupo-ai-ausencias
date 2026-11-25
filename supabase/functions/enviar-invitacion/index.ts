// Envía el correo de invitación/bienvenida de Pausa con las instrucciones de
// acceso y el manual adjunto.
// CANDADO: el destinatario y cada persona en copia deben ser empleados ACTIVOS
// registrados (evita que la clave pública se use para enviar correos arbitrarios).
// Desplegada en Supabase — este archivo es el espejo versionado.
// Invocación: POST /functions/v1/enviar-invitacion
//   { "para": "correo@empresa.com", "cc": ["otro@empresa.com"] }   (cc es opcional)

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const URL_PLATAFORMA = "https://tomassanchez-ampm.github.io/grupo-ai-ausencias/";
const URL_MANUAL = URL_PLATAFORMA + "Manual-Pausa.pdf";

const HTML = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F6F2;padding:24px 0;color-scheme:light;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border:1px solid #DFE6DF;border-radius:12px;">
      <tr>
        <td style="background-color:#0F3D3A;border-radius:12px 12px 0 0;padding:22px 32px;font-family:Arial,sans-serif;">
          <span style="font-size:22px;font-weight:bold;color:#FFFFFF;">❚❚ &nbsp;Pausa</span><br>
          <span style="font-size:12px;color:#A7DCCB;font-weight:bold;">Pedir. Aprobar. Desconectar.</span>
        </td>
      </tr>
      <tr>
        <td style="padding:30px 32px 10px;font-family:Arial,sans-serif;font-size:14px;color:#1E2326;line-height:1.65;">
          <p style="margin:0 0 14px 0;font-size:17px;font-weight:bold;color:#0F3D3A;">¡Hola! Desde hoy las vacaciones se piden en Pausa 🌅</p>
          <p style="margin:0 0 16px 0;">Estrenamos <b>Pausa</b>, nuestra plataforma para pedir vacaciones y permisos. Tu saldo ya está cargado y se calcula solo; tu aprobador recibe tu solicitud al instante y tú recibes la respuesta por correo. Adiós a las cadenas de correos y las hojas de Excel.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#E6ECE8;border-radius:10px;">
            <tr><td style="padding:16px 20px;font-family:Arial,sans-serif;font-size:13.5px;color:#1E2326;line-height:1.7;">
              <b style="color:#0F3D3A;">Cómo entrar (30 segundos, sin contraseñas):</b><br>
              1️⃣ Abre la plataforma con el botón de abajo.<br>
              2️⃣ Escribe <b>tu correo de trabajo</b> (el mismo donde recibiste este mensaje).<br>
              3️⃣ Te llegará un correo de Pausa con un <b>código de acceso</b>: escríbelo en la pantalla y listo.
            </td></tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto;">
            <tr>
              <td bgcolor="#0F3D3A" style="border-radius:26px;">
                <a href="${URL_PLATAFORMA}" target="_blank" style="display:inline-block;padding:14px 34px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;">Abrir Pausa</a>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 8px 0;"><b style="color:#0F3D3A;">Lo que puedes hacer:</b></p>
          <p style="margin:0 0 4px 0;">🏖️ &nbsp;Pedir vacaciones en 30 segundos indicando tu fecha de reintegro — Pausa calcula los días por ti.</p>
          <p style="margin:0 0 4px 0;">📊 &nbsp;Ver tu saldo siempre al día (los feriados de tu país no descuentan).</p>
          <p style="margin:0 0 16px 0;">🔔 &nbsp;Recibir la aprobación por correo, con todo registrado.</p>
          <p style="margin:0 0 6px 0;">📘 El <b>manual de usuario va adjunto</b> (5 minutos de lectura) — también puedes verlo aquí: <a href="${URL_MANUAL}" style="color:#0F3D3A;font-weight:bold;">Manual de Pausa</a>.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px;border-top:1px solid #DFE6DF;font-family:Arial,sans-serif;font-size:11px;color:#97A59D;">
          ¿Dudas o problemas para entrar? Escríbele a Tomás Sánchez. · Pedir. Aprobar. Desconectar.
        </td>
      </tr>
    </table>
  </td></tr>
</table>`;

const normalizar = (correo: unknown) => String(correo ?? "").trim().toLowerCase();

Deno.serve(async (req) => {
  try {
    const cuerpo = await req.json();
    const para = normalizar(cuerpo.para);
    if (!para) return new Response(JSON.stringify({ error: "falta 'para'" }), { status: 400 });
    const copias: string[] = Array.isArray(cuerpo.cc)
      ? [...new Set(cuerpo.cc.map(normalizar).filter((c: string) => c && c !== para))]
      : [];
    if (copias.length > 5) {
      return new Response(JSON.stringify({ error: "máximo 5 personas en copia" }), { status: 400 });
    }

    // Candado: destinatario y copias deben ser empleados activos registrados.
    const todos = [para, ...copias];
    const { data: activos, error } = await supabase
      .from("empleados")
      .select("email")
      .in("email", todos)
      .eq("activo", true);
    if (error) throw error;
    const permitidos = new Set((activos ?? []).map((e) => normalizar(e.email)));
    const ajenos = todos.filter((c) => !permitidos.has(c));
    if (ajenos.length > 0) {
      return new Response(
        JSON.stringify({ error: "Solo se puede enviar a empleados activos de Pausa", rechazados: ajenos }),
        { status: 403 },
      );
    }

    const respuestaPdf = await fetch(URL_MANUAL);
    if (!respuestaPdf.ok) throw new Error("No se pudo descargar el manual: " + respuestaPdf.status);
    const pdf = new Uint8Array(await respuestaPdf.arrayBuffer());

    const cliente = new SMTPClient({
      connection: {
        hostname: Deno.env.get("SMTP_HOST") ?? "ampmcomni.ipage.com",
        port: Number(Deno.env.get("SMTP_PORT") ?? "465"),
        tls: true,
        auth: { username: Deno.env.get("SMTP_USER") ?? "noreplay@ampm.com.ni", password: Deno.env.get("SMTP_PASS")! },
      },
    });
    try {
      await cliente.send({
        from: Deno.env.get("SMTP_FROM") ?? "Pausa <noreplay@ampm.com.ni>",
        to: para,
        ...(copias.length > 0 ? { cc: copias } : {}),
        subject: "Bienvenido a Pausa · Tus vacaciones desde hoy",
        html: HTML,
        attachments: [{
          filename: "Manual-Pausa.pdf",
          contentType: "application/pdf",
          encoding: "binary",
          content: pdf,
        }],
      });
    } finally {
      try { await cliente.close(); } catch { /* ya cerrada */ }
    }
    return new Response(JSON.stringify({ ok: true, para, cc: copias }), { status: 200 });
  } catch (error) {
    console.error("enviar-invitacion falló:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
