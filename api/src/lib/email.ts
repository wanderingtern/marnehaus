import { Resend } from 'resend';

function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY env var is required');
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendInvoiceEmail(opts: {
  to: string;
  tenantName: string;
  landlordName: string;
  amountCents: number;
  dueDate: Date;
  paymentUrl: string;
  invoiceId: string;
}) {
  const amount = (opts.amountCents / 100).toFixed(2);
  const due = opts.dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? 'MarneHaus <noreply@marnehaus.com>',
    to: [opts.to],
    subject: `Rent Invoice Due ${due} — $${amount}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #0f172a;">Rent Invoice</h2>
        <p>Hi ${opts.tenantName},</p>
        <p>Your landlord <strong>${opts.landlordName}</strong> has sent you a rent invoice.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Amount Due</td>
            <td style="padding: 8px 0; font-weight: 700; font-size: 1.25rem;">$${amount}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Due Date</td>
            <td style="padding: 8px 0;">${due}</td>
          </tr>
        </table>
        <a href="${opts.paymentUrl}"
           style="display: inline-block; background: #0f172a; color: #fff; padding: 12px 28px;
                  border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 1rem;">
          Pay Now
        </a>
        <p style="margin-top: 32px; color: #94a3b8; font-size: 0.85rem;">
          Invoice #${opts.invoiceId.slice(-8).toUpperCase()} · Powered by MarneHaus
        </p>
      </div>
    `,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}

export async function sendMagicLinkEmail(opts: {
  to: string;
  tenantName: string;
  magicLinkUrl: string;
}) {
  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? 'MarneHaus <noreply@marnehaus.com>',
    to: [opts.to],
    subject: 'Your MarneHaus Tenant Portal Login Link',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #0f172a;">Tenant Portal Access</h2>
        <p>Hi ${opts.tenantName},</p>
        <p>Click the button below to log in to your MarneHaus tenant portal. This link expires in 1 hour.</p>
        <a href="${opts.magicLinkUrl}"
           style="display: inline-block; background: #0f172a; color: #fff; padding: 12px 28px;
                  border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 1rem;">
          Log In to Tenant Portal
        </a>
        <p style="margin-top: 32px; color: #94a3b8; font-size: 0.85rem;">
          If you did not request this link, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}

export async function sendMaintenanceRequestEmail(opts: {
  to: string;
  landlordName: string;
  tenantName: string;
  unitAddress: string;
  category: string;
  description: string;
  requestId: string;
  appUrl: string;
}) {
  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? 'MarneHaus <noreply@marnehaus.com>',
    to: [opts.to],
    subject: `New Maintenance Request — ${opts.category} at ${opts.unitAddress}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #0f172a;">New Maintenance Request</h2>
        <p>Hi ${opts.landlordName},</p>
        <p>Your tenant <strong>${opts.tenantName}</strong> has submitted a maintenance request.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Property</td>
            <td style="padding: 8px 0;">${opts.unitAddress}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Category</td>
            <td style="padding: 8px 0; font-weight: 600;">${opts.category}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Description</td>
            <td style="padding: 8px 0;">${opts.description}</td>
          </tr>
        </table>
        <a href="${opts.appUrl}/maintenance"
           style="display: inline-block; background: #0f172a; color: #fff; padding: 12px 28px;
                  border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 1rem;">
          View in Dashboard
        </a>
        <p style="margin-top: 32px; color: #94a3b8; font-size: 0.85rem;">
          Request #${opts.requestId.slice(-8).toUpperCase()} · Powered by MarneHaus
        </p>
      </div>
    `,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}
