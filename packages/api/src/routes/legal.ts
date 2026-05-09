import { Hono } from "hono";

const contactEmail = process.env.PRIVACY_CONTACT_EMAIL ?? "privacy@gharkharcha.app";
const deletionSubject = encodeURIComponent("Ghar Kharcha account deletion request");
const deletionHref = `mailto:${contactEmail}?subject=${deletionSubject}`;

function page(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} | Ghar Kharcha</title>
    <style>
      :root { color-scheme: light; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1f2933; background: #f8f5ef; }
      body { margin: 0; }
      main { max-width: 760px; margin: 0 auto; padding: 48px 20px 72px; line-height: 1.65; }
      h1 { margin: 0 0 8px; font-size: clamp(32px, 5vw, 48px); line-height: 1.05; }
      h2 { margin-top: 32px; font-size: 22px; }
      p, li { font-size: 16px; }
      a { color: #0f766e; font-weight: 700; }
      .updated { color: #667085; margin-bottom: 28px; }
      .panel { border: 1px solid #e3d8c4; border-radius: 8px; background: #fffaf1; padding: 18px 20px; }
    </style>
  </head>
  <body>
    <main>
      ${body}
    </main>
  </body>
</html>`;
}

export const legal = new Hono();

legal.get("/privacy", (c) =>
  c.html(
    page(
      "Privacy Policy",
      `<h1>Privacy Policy</h1>
      <p class="updated">Last updated: May 9, 2026</p>
      <p>Ghar Kharcha helps you import grocery invoice PDFs, parse order details, and understand household spending. This policy explains what data we collect, why we use it, and how you can control it.</p>

      <h2>Data we collect</h2>
      <ul>
        <li>Google account profile details used for sign-in, such as name, email address, and avatar.</li>
        <li>Uploaded grocery invoice PDFs and parsed order details, including merchant, dates, item names, quantities, prices, taxes, fees, and totals.</li>
        <li>Household profile information you choose to enter, app settings, consent timestamps, token metadata, audit events, and basic service logs.</li>
      </ul>

      <h2>How we use data</h2>
      <p>We use your data to authenticate your account, process invoice uploads, generate grocery analytics, provide account export and deletion controls, protect the service, troubleshoot issues, and meet legal obligations.</p>

      <h2>AI processing and subprocessors</h2>
      <p>When you upload an invoice, the app may process the document with an AI provider to extract grocery order details. We require your in-app consent before upload processing. We do not sell your personal data.</p>

      <h2>Retention and deletion</h2>
      <p>We keep account and invoice data while your account is active. Deleting an order removes that order and its stored PDF. Deleting your account removes your account, refresh tokens, orders, items, uploads, and stored PDFs, except where limited retention is required for security, fraud prevention, dispute handling, or legal compliance.</p>

      <h2>Your choices</h2>
      <p>You can export your data, delete individual orders, delete your account from Profile, sign out, or request account and data deletion from the <a href="/delete-account">Delete Account</a> page.</p>

      <h2>Contact</h2>
      <p>Privacy and grievance contact: <a href="mailto:${contactEmail}">${contactEmail}</a></p>`,
    ),
  ),
);

legal.get("/terms", (c) =>
  c.html(
    page(
      "Terms of Service",
      `<h1>Terms of Service</h1>
      <p class="updated">Last updated: May 9, 2026</p>
      <p>These terms govern your use of Ghar Kharcha. By using the app, you agree to these terms and to our Privacy Policy.</p>

      <h2>Use of the app</h2>
      <p>Ghar Kharcha is for personal grocery and household expense tracking. You are responsible for uploading documents you have the right to use and for keeping your device and Google account secure.</p>

      <h2>Age and household use</h2>
      <p>You should be 18 or older to use the app. If a minor uses it, a parent or guardian must manage the account and consent to the data processing.</p>

      <h2>Accuracy</h2>
      <p>Invoice parsing and AI-generated extraction can make mistakes. Review imported data before relying on it for budgeting, tax, reimbursement, or any financial decision.</p>

      <h2>Availability</h2>
      <p>We may update, suspend, or discontinue parts of the service. We may also limit or remove accounts that abuse the service, violate these terms, or create security risk.</p>

      <h2>Contact</h2>
      <p>Questions or complaints: <a href="mailto:${contactEmail}">${contactEmail}</a></p>`,
    ),
  ),
);

legal.get("/delete-account", (c) =>
  c.html(
    page(
      "Delete Account",
      `<h1>Delete Account</h1>
      <p class="updated">Last updated: May 9, 2026</p>
      <div class="panel">
        <p>To delete your Ghar Kharcha account in the app, open <strong>Profile</strong>, choose <strong>Delete account</strong>, and confirm deletion.</p>
        <p>If you no longer have access to the app, request deletion by emailing <a href="${deletionHref}">${contactEmail}</a> from the Google account email used for Ghar Kharcha.</p>
      </div>

      <h2>What gets deleted</h2>
      <p>Account deletion removes your account, refresh tokens, grocery orders, parsed order items, upload records, and stored invoice PDFs. Some limited records may be retained only where needed for security, fraud prevention, dispute handling, or legal compliance.</p>

      <h2>Verification</h2>
      <p>We may ask you to verify ownership of the account before completing deletion. Temporary deactivation is not treated as account deletion.</p>`,
    ),
  ),
);
