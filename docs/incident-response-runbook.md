# Incident Response Runbook

Last updated: 2026-05-05

This runbook is for suspected security incidents involving Ghar Kharcha systems, user accounts, invoice PDFs, grocery ledger data, credentials, or service providers.

## Owners

- Incident commander: founder/operator on call.
- Engineering lead: backend/mobile maintainer.
- Privacy/grievance contact: privacy@gharkharcha.app.
- Legal counsel: external counsel before public launch.

## Severity

- SEV-1: confirmed unauthorized access to user data, production secrets, database, uploads, or admin systems.
- SEV-2: suspected unauthorized access, credential exposure, broken access control, or provider breach affecting Ghar Kharcha data.
- SEV-3: security bug with limited exposure and no confirmed data access.
- SEV-4: low-risk vulnerability, dependency warning, or policy/process issue.

## First hour

1. Start an incident log with UTC and IST timestamps.
2. Assign an incident commander and one engineer.
3. Preserve evidence: logs, request IDs, deploy SHAs, provider alerts, screenshots, affected user IDs, and suspected time window.
4. Contain the issue: revoke exposed secrets, disable affected route/feature, block abusive IPs, rotate credentials, pause uploads, or force logout.
5. Avoid destructive cleanup until evidence is captured.
6. Decide whether this is a personal data breach or CERT-In reportable cyber incident.

## Investigation checklist

- What data types may be affected?
- Which users, households, uploads, orders, or tokens are affected?
- Did the attacker access PDFs, parsed invoice data, email/name/avatar, refresh tokens, or provider keys?
- Was data exfiltrated, modified, deleted, encrypted, or merely exposed?
- Which code version and infrastructure components were active?
- Are backups, logs, audit events, or provider logs intact?
- Is the incident ongoing?

## Notification

- CERT-In: report covered cyber incidents within 6 hours of noticing the incident or being notified, where applicable.
- DPDP/user notice: notify affected Data Principals and the Data Protection Board as required once a personal data breach is confirmed.
- App stores/providers: notify if their policies or credentials are implicated.
- Users: use plain language, describe affected data, time window, actions taken, and steps users should take.

## Recovery

- Patch and deploy the fix.
- Rotate affected secrets and invalidate affected refresh-token families.
- Verify access controls with regression tests.
- Restore data from backup only after understanding whether the backup contains compromised data.
- Monitor audit logs, auth failures, upload spikes, and provider alerts for at least 14 days.

## Post-incident

- Write a postmortem within 5 business days.
- Add or update tests, alerts, dashboards, and runbooks.
- Update the subprocessor/security documentation if a provider was involved.
- Record whether legal/user/CERT-In notices were sent, with timestamps.
