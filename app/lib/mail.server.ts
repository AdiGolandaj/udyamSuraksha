import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  return transporter.sendMail({
    from: `"DisasterShield Alerts" <${process.env.SMTP_FROM}>`,
    ...options,
  });
}

export async function sendAlertMail(params: {
  to: string;
  ownerName: string;
  alertTitle: string;
  severity: string;
  affectedItems: string[];
  actionSummary: string;
  alertId: string;
  userId: string;
}) {
  await sendMail({
    to: params.to,
    subject: `⚠️ DisasterShield Alert: ${params.alertTitle}`,
    text: `Hello ${params.ownerName}, a ${params.severity} alert has been issued for your shop.`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#1A6B4A;">DisasterShield — Disaster Alert</h2>
        <p>Hello <strong>${params.ownerName}</strong>,</p>
        <p>A <strong>${params.severity.toUpperCase()}</strong> alert has been issued relevant to your shop:</p>
        <h3>${params.alertTitle}</h3>
        <p><strong>Affected stock items:</strong> ${params.affectedItems.join(", ")}</p>
        <p><strong>Recommended action:</strong> ${params.actionSummary}</p>
        <a href="${process.env.APP_URL}/msme/${params.userId}/alerts/${params.alertId}"
           style="background:#1A6B4A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
          View Full Alert
        </a>
        <p style="color:#94A3B8;font-size:12px;margin-top:24px;">
          You are receiving this because email alerts are enabled in your DisasterShield settings.
        </p>
      </div>
    `,
  });
}

export async function sendBCPMail(params: {
  to: string;
  ownerName: string;
  userId: string;
}) {
  await sendMail({
    to: params.to,
    subject: "📋 Your Business Continuity Plan is Ready — DisasterShield",
    text: `Hello ${params.ownerName}, your personalized Business Continuity Plan has been generated.`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#1A6B4A;">Your Business Continuity Plan is Ready</h2>
        <p>Hello <strong>${params.ownerName}</strong>,</p>
        <p>Your personalized disaster continuity plan has been generated based on your shop profile and inventory.</p>
        <a href="${process.env.APP_URL}/msme/${params.userId}/bcp"
           style="background:#1A6B4A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
          View My Plan
        </a>
      </div>
    `,
  });
}

export async function sendRiskScoreMail(params: {
  to: string;
  ownerName: string;
  previousScore: number;
  newScore: number;
  topThreat: string;
  userId: string;
}) {
  const increased = params.newScore > params.previousScore;
  await sendMail({
    to: params.to,
    subject: `${increased ? "🔺" : "🔻"} Your Risk Score has Changed — DisasterShield`,
    text: `Hello ${params.ownerName}, your business risk score changed from ${params.previousScore} to ${params.newScore}.`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#1A6B4A;">Risk Score Update</h2>
        <p>Hello <strong>${params.ownerName}</strong>,</p>
        <p>Your business risk score has ${increased ? "increased" : "decreased"}
           from <strong>${params.previousScore}</strong> to <strong>${params.newScore}</strong>.</p>
        <p><strong>Top threat identified:</strong> ${params.topThreat}</p>
        <a href="${process.env.APP_URL}/msme/${params.userId}/risk"
           style="background:#1A6B4A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
          View Risk Profile
        </a>
      </div>
    `,
  });
}

export async function sendBroadcastMail(params: {
  recipients: Array<{ email: string; name: string; userId: string }>;
  subject: string;
  messageBody: string;
  officerName: string;
  region: string;
}) {
  const promises = params.recipients.map((recipient) =>
    sendMail({
      to: recipient.email,
      subject: `📢 ${params.subject} — DisasterShield`,
      text: params.messageBody,
      html: `
        <div style="font-family:sans-serif;max-width:600px;">
          <h2 style="color:#1A6B4A;">Official Notice — ${params.region}</h2>
          <p>Hello <strong>${recipient.name}</strong>,</p>
          <p>The following notice has been issued by <strong>${params.officerName}</strong>
             from the Local Disaster Resilience Body:</p>
          <blockquote style="border-left:4px solid #1A6B4A;padding-left:16px;color:#475569;">
            ${params.messageBody}
          </blockquote>
          <a href="${process.env.APP_URL}/msme/${recipient.userId}/alerts"
             style="background:#1A6B4A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
            View All Alerts
          </a>
        </div>
      `,
    })
  );
  await Promise.allSettled(promises);
}

export async function sendQueryStatusMail(params: {
  to: string;
  ownerName: string;
  queryType: string;
  newStatus: string;
  queryId: string;
  officerId: string;
}) {
  await sendMail({
    to: params.to,
    subject: `🔄 Query Update: ${params.queryType} — DisasterShield`,
    text: `Hello ${params.ownerName}, your query status has been updated to: ${params.newStatus}.`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#1A6B4A;">Query Status Update</h2>
        <p>Hello <strong>${params.ownerName}</strong>,</p>
        <p>Your support request regarding <strong>${params.queryType}</strong>
           has been updated to: <strong>${params.newStatus.toUpperCase()}</strong>.</p>
        <a href="${process.env.APP_URL}/msme/${params.ownerName}/queries/${params.queryId}"
           style="background:#1A6B4A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
          View Query
        </a>
      </div>
    `,
  });
}
