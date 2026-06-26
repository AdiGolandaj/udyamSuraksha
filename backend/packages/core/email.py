"""
Email Notification Service

Sends HTML alert emails via SMTP (Gmail App Password supported).
Uses stdlib smtplib run in a thread so it doesn't block the async event loop.
"""
import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from packages.core.config import settings
from packages.core.logger import get_logger

logger = get_logger(__name__)

_SEVERITY_COLOUR = {
    "LOW":      ("#2563eb", "#dbeafe", "LOW"),
    "MEDIUM":   ("#d97706", "#fef3c7", "MEDIUM"),
    "HIGH":     ("#dc2626", "#fee2e2", "HIGH"),
    "CRITICAL": ("#7f1d1d", "#fca5a5", "CRITICAL"),
}


def _build_html(
    *,
    shop_name: str,
    district: str,
    alert_title: str,
    severity: str,
    category: str,
    summary: str,
    weather: dict,
    action_steps: list[str],
    affected_items: list[str],
    alert_url: str,
    recipient_name: str,
) -> str:
    colour, bg, label = _SEVERITY_COLOUR.get(severity.upper(), ("#dc2626", "#fee2e2", severity))

    steps_html = "".join(
        f"""
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">
            <span style="display:inline-block;width:22px;height:22px;border-radius:50%;
                         background:#f3f4f6;text-align:center;line-height:22px;
                         font-size:11px;font-weight:700;color:#374151;margin-right:8px;">{i}</span>
            {step}
          </td>
        </tr>"""
        for i, step in enumerate(action_steps, 1)
    )

    items_html = "".join(
        f'<span style="display:inline-block;margin:3px;padding:4px 10px;'
        f'background:#fef3c7;border:1px solid #fde68a;border-radius:12px;'
        f'font-size:12px;color:#92400e;">{item}</span>'
        for item in affected_items
    ) or '<span style="color:#6b7280;font-size:13px;">No specific items identified</span>'

    weather_html = f"""
        <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">Rainfall</td>
            <td style="padding:4px 0;font-weight:600;font-size:13px;">
              {weather.get('rainfall_mm_per_hour', 0)} mm/hr ({weather.get('rainfall_type','rain')})
            </td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">Wind</td>
            <td style="padding:4px 0;font-weight:600;font-size:13px;">
              {weather.get('wind_speed_kmph', 0)} km/h {weather.get('wind_direction','N')}
            </td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">Temperature</td>
            <td style="padding:4px 0;font-weight:600;font-size:13px;">
              {weather.get('temperature_c', 0)}°C
            </td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">Conditions</td>
            <td style="padding:4px 0;font-weight:600;font-size:13px;">
              {weather.get('summary', 'Heavy rain')}
            </td></tr>
    """

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>DisasterShield Alert</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

  <!-- Header -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="background:#1e293b;padding:20px 32px;">
      <span style="color:#f8fafc;font-size:18px;font-weight:700;letter-spacing:-0.3px;">
        &#x26A1; DisasterShield
      </span>
      <span style="color:#94a3b8;font-size:12px;margin-left:12px;">Emergency Alert System</span>
    </td></tr>
  </table>

  <!-- Severity Banner -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="background:{colour};padding:12px 32px;">
      <span style="color:#fff;font-size:13px;font-weight:700;letter-spacing:1px;">
        &#x26A0;&#xFE0F; {label} ALERT &nbsp;|&nbsp; {category.replace('_',' ')}
      </span>
    </td></tr>
  </table>

  <!-- Body -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:32px;">

      <p style="margin:0 0 6px;color:#6b7280;font-size:13px;">Dear {recipient_name},</p>
      <h1 style="margin:0 0 24px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">
        {alert_title}
      </h1>

      <!-- Shop + Summary card -->
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:20px;">
        <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;">
          Shop at Risk
        </p>
        <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#111827;">
          {shop_name} &mdash; {district}
        </p>
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">{summary}</p>
      </div>

      <!-- Weather conditions -->
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:20px;">
        <p style="margin:0 0 12px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;">
          Current Weather Conditions
        </p>
        <table cellpadding="0" cellspacing="0" width="100%">
          {weather_html}
        </table>
      </div>

      <!-- Affected stock -->
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:20px;">
        <p style="margin:0 0 12px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;">
          Your At-Risk Stock Items
        </p>
        {items_html}
      </div>

      <!-- Action steps -->
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
        <div style="background:#f8fafc;padding:14px 20px;border-bottom:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;">
            &#x2705; Immediate Action Steps
          </p>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0">
          {steps_html if steps_html else
           '<tr><td style="padding:12px;color:#6b7280;font-size:13px;">See app for recommended steps.</td></tr>'}
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:32px;">
        <a href="{alert_url}"
           style="display:inline-block;background:{colour};color:#fff;
                  text-decoration:none;padding:12px 28px;border-radius:6px;
                  font-size:14px;font-weight:600;">
          View Full Alert &amp; Mark Actions Done &rarr;
        </a>
      </div>

      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
        You received this because your shop is registered with DisasterShield.<br>
        Stay safe. This alert was generated by DisasterShield AI.
      </p>

    </td></tr>
  </table>

  <!-- Footer -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="background:#1e293b;padding:16px 32px;text-align:center;">
      <span style="color:#64748b;font-size:11px;">
        &copy; 2025 DisasterShield &nbsp;|&nbsp; Protecting MSMEs across Maharashtra
      </span>
    </td></tr>
  </table>

</body>
</html>"""


def _send_smtp(to_email: str, subject: str, html_body: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASS)
        server.sendmail(msg["From"], [to_email], msg.as_string())


async def send_alert_email(
    *,
    to_email: str,
    recipient_name: str,
    shop_name: str,
    district: str,
    alert_id: str,
    alert_title: str,
    severity: str,
    category: str,
    summary: str,
    weather: dict,
    action_steps: list[str],
    affected_items: list[str],
    user_id: str,
) -> bool:
    """Send an HTML alert email. Returns True on success, False on failure."""
    if not settings.SMTP_USER or not settings.SMTP_PASS:
        logger.warning("SMTP not configured — skipping email for alert %s", alert_id)
        return False

    alert_url = f"{settings.APP_BASE_URL}/msme/{user_id}/alerts/{alert_id}"
    severity_upper = severity.upper()
    subject = f"[{severity_upper} ALERT] {alert_title} — {shop_name}"

    html = _build_html(
        shop_name=shop_name,
        district=district,
        alert_title=alert_title,
        severity=severity_upper,
        category=category,
        summary=summary,
        weather=weather,
        action_steps=action_steps,
        affected_items=affected_items,
        alert_url=alert_url,
        recipient_name=recipient_name,
    )

    try:
        await asyncio.to_thread(_send_smtp, to_email, subject, html)
        logger.info("Alert email sent to %s for alert %s", to_email, alert_id)
        return True
    except Exception as exc:
        logger.error("Failed to send alert email to %s: %s", to_email, exc)
        return False
