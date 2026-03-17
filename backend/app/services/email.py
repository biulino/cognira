"""Email notification service — send async via SMTP."""
import asyncio
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _send_smtp(to_email: str, subject: str, body_html: str) -> None:
    """Synchronous SMTP send — run in thread pool via asyncio.to_thread."""
    if not settings.smtp_host or settings.smtp_host == "smtp.example.com":
        logger.info("SMTP not configured — skipping email to %s: %s", to_email, subject)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.ehlo()
            if settings.smtp_port in (587, 465):
                server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_from, [to_email], msg.as_string())
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to_email, exc)


async def send_estado_change(
    to_email: str,
    visita_id: int,
    estudo_nome: str,
    analista_nome: str,
    old_estado: str,
    new_estado: str,
) -> None:
    subject = f"[Cognira] Visita #{visita_id} — estado alterado para {new_estado}"
    body_html = f"""
    <html><body style="font-family:Inter,sans-serif;color:#111">
      <h2 style="color:#2D6BEE">Estado da visita alterado</h2>
      <table style="border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0"><b>Visita:</b></td><td>#{visita_id}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><b>Estudo:</b></td><td>{estudo_nome}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><b>Analista:</b></td><td>{analista_nome}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><b>Estado anterior:</b></td><td>{old_estado}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><b>Novo estado:</b></td>
            <td><b style="color:#2D6BEE">{new_estado}</b></td></tr>
      </table>
      <p style="margin-top:16px;color:#888;font-size:12px">Cognira CX Intelligence Platform</p>
    </body></html>
    """
    await asyncio.to_thread(_send_smtp, to_email, subject, body_html)


async def send_welcome(to_email: str, username: str, temp_password: str) -> None:
    subject = "[Cognira] Conta criada"
    body_html = f"""
    <html><body style="font-family:Inter,sans-serif;color:#111">
      <h2 style="color:#2D6BEE">Bem-vindo à plataforma</h2>
      <p>A tua conta foi criada com sucesso.</p>
      <table style="border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0"><b>Username:</b></td><td>{username}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><b>Password temporária:</b></td><td><code>{temp_password}</code></td></tr>
      </table>
      <p>Altera a password após o primeiro login.</p>
      <p style="margin-top:16px;color:#888;font-size:12px">Cognira CX Intelligence Platform</p>
    </body></html>
    """
    await asyncio.to_thread(_send_smtp, to_email, subject, body_html)
