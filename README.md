# MarneHaus Platform

Property operations platform for independent landlords (2–20 residential units).

## Stack

- **API:** Node.js (TypeScript)
- **Frontend:** React (Vite)
- **Database:** PostgreSQL
- **Payments:** Stripe Billing + Stripe Connect
- **Auth (landlord):** Clerk
- **Auth (tenant):** Magic link (email)
- **Storage:** Cloudflare R2
- **Email:** Resend

## v1 Features

1. Tenant & unit management (CRUD)
2. Automated rent collection (Stripe)
3. Tenant portal (magic link, pay rent, view lease)
4. Maintenance request tracking
5. Lease document storage
6. Landlord dashboard
