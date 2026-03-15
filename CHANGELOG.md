# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-03-10

### Added
- UTM attribution engine with server-side visitor tracking
- Cloudflare-powered city detection (no API key needed)
- Campaign performance comparison dashboard
- Payment-visitor matching algorithm
- Google Sheet bidirectional sync

### Fixed
- Email deduplication for contacts with multiple entries
- Timezone handling for IST-based scheduling
- Mobile responsive layout for all dashboard pages

## [1.1.0] - 2026-02-20

### Added
- Payment recovery email sequence (3-step automated)
- Razorpay webhook integration with auto-tagging
- Contact lifecycle management (Lead → Paid → Booked → Purchased)
- Smart sequence stop rules on payment
- Email template engine with personalization tokens

### Fixed
- SMTP connection pooling for high-volume sending
- Sequence enrollment race condition

## [1.0.0] - 2026-01-30

### Added
- Initial release
- Email nurture sequences with multi-step automation
- Contact management with import/export
- Analytics dashboard with 9 pages
- Supabase Edge Functions for serverless webhooks
- React + Vite + TailwindCSS frontend
- MIT License
