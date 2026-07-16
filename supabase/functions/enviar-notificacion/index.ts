// Envía por correo cada notificación de la plataforma (un correo por
// ejecución). Disparada por el trigger tg_correo_notificacion vía pg_net.
// SMTP corporativo (iPage); la contraseña vive en el secret SMTP_PASS.
// Desplegada en Supabase — este archivo es el espejo versionado.

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const URL_PLATAFORMA = "https://tomassanchez-ampm.github.io/grupo-ai-ausencias/";
const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "ampmcomni.ipage.com";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? "465");
const SMTP_USER = Deno.env.get("SMTP_USER") ?? "noreplay@ampm.com.ni";
const SMTP_FROM = Deno.env.get("SMTP_FROM") ?? "Ausencias GRUPO A/I <noreplay@ampm.com.ni>";

function plantillaCorreo(nombre: string, mensaje: string): string {
  // HTML a base de tablas y sin imágenes externas: lo único que Outlook
  // renderiza de forma confiable.
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F6F7FB;padding:24px 0;color-scheme:light;">
  <tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border:1px solid #E2E6F1;border-radius:12px;">
      <tr>
        <td style="background-color:#5B77D3;border-radius:12px 12px 0 0;padding:18px 28px;font-family:Arial,sans-serif;font-size:18px;font-weight:bold;color:#FFFFFF;">
          🌴 Ausencias · GRUPO A/I
        </td>
      </tr>
      <tr>
        <td style="padding:28px;font-family:Arial,sans-serif;font-size:14px;color:#21242E;line-height:1.6;">
          <p style="margin:0 0 12px 0;">Hola ${nombre},</p>
          <p style="margin:0 0 20px 0;">${mensaje}</p>
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td bgcolor="#5B77D3" style="border-radius:24px;">
                <a href="${URL_PLATAFORMA}" target="_blank"
                   style="display:inline-block;padding:12px 28px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none;">
                  Abrir la plataforma
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px;border-top:1px solid #E2E6F1;font-family:Arial,sans-serif;font-size:11px;color:#9AA1B8;">
          Este es un aviso automático de la plataforma de ausencias del GRUPO A/I. No respondas a este correo.
        </td>
      </tr>
    </table>
  </td></tr>
</table>`;
}

Deno.serve(async (req) => {
  try {
    const { id } = await req.json();
    if (!id) {
      return new Response(JSON.stringify({ error: "Falta el id de la notificación" }), { status: 400 });
    }

    // Reclamo idempotente: solo un proceso marca correo_enviado y envía.
    const { data: reclamadas, error: errorReclamo } = await supabase
      .from("notificaciones")
      .update({ correo_enviado: true })
      .eq("id", id)
      .eq("correo_enviado", false)
      .select("id, mensaje, para_id");
    if (errorReclamo) throw errorReclamo;
    if (!reclamadas || reclamadas.length === 0) {
      return new Response(JSON.stringify({ ok: true, detalle: "ya enviada u inexistente" }), { status: 200 });
    }
    const notificacion = reclamadas[0];

    const { data: empleado, error: errorEmpleado } = await supabase
      .from("empleados")
      .select("nombre, email, activo")
      .eq("id", notificacion.para_id)
      .single();
    if (errorEmpleado) throw errorEmpleado;
    if (!empleado?.activo || !empleado.email || empleado.email.endsWith("@ejemplo.ampm")) {
      return new Response(JSON.stringify({ ok: true, detalle: "destinatario sin correo real" }), { status: 200 });
    }

    const asunto = notificacion.mensaje.length > 70
      ? `Ausencias · ${notificacion.mensaje.slice(0, 67)}…`
      : `Ausencias · ${notificacion.mensaje}`;

    const cliente = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: true,
        auth: { username: SMTP_USER, password: Deno.env.get("SMTP_PASS")! },
      },
    });
    try {
      await cliente.send({
        from: SMTP_FROM,
        to: empleado.email,
        subject: asunto,
        html: plantillaCorreo(empleado.nombre.split(" ")[0], notificacion.mensaje),
      });
    } catch (errorEnvio) {
      // Revertir el reclamo para permitir reintento.
      await supabase.from("notificaciones").update({ correo_enviado: false }).eq("id", id);
      throw errorEnvio;
    } finally {
      try { await cliente.close(); } catch { /* conexión ya cerrada */ }
    }

    return new Response(JSON.stringify({ ok: true, para: empleado.email }), { status: 200 });
  } catch (error) {
    console.error("enviar-notificacion falló:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
