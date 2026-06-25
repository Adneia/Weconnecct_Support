"""
Módulo de envio de e-mail via AWS SES (SMTP).

Configuração via variáveis de ambiente:
  SMTP_HOST     → email-smtp.us-east-1.amazonaws.com
  SMTP_PORT     → 587
  SMTP_USER     → usuário SMTP da AWS SES
  SMTP_PASSWORD → senha SMTP da AWS SES
  SMTP_FROM     → remetente (atendimento@wct360.com.br)
  SMTP_REPLY_TO → reply-to (atendimento@weconnect360.com.br)
"""
import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "email-smtp.us-east-1.amazonaws.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "atendimento@wct360.com.br")
SMTP_REPLY_TO = os.getenv("SMTP_REPLY_TO", "atendimento@weconnect360.com.br")


def send_email(
    to: list[str],
    subject: str,
    html_body: str,
    plain_body: str = None,
    reply_to: str = None,
) -> bool:
    """
    Envia e-mail via AWS SES SMTP.

    Args:
        to: lista de destinatários
        subject: assunto do e-mail
        html_body: corpo em HTML
        plain_body: corpo em texto puro (fallback)
        reply_to: endereço de reply-to (padrão: SMTP_REPLY_TO do env)

    Returns:
        True se enviado com sucesso, False em caso de erro.
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("SMTP não configurado — SMTP_USER ou SMTP_PASSWORD ausentes.")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"WeConnect ELO <{SMTP_FROM}>"
        msg["To"] = ", ".join(to)
        msg["Reply-To"] = reply_to or SMTP_REPLY_TO

        # Parte texto puro (fallback)
        if plain_body:
            msg.attach(MIMEText(plain_body, "plain", "utf-8"))

        # Parte HTML (preferida pelos clientes de e-mail)
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, to, msg.as_string())

        logger.info(f"E-mail enviado para {to} | Assunto: {subject}")
        return True

    except Exception as e:
        logger.error(f"Erro ao enviar e-mail para {to}: {e}")
        return False
