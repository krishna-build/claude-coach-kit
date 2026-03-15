# Contributing to CoachKit

Thank you for your interest in contributing to CoachKit! This guide will help you get started.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/YOUR_USERNAME/coachkit/issues)
2. If not, create a new issue with:
   - A clear, descriptive title
   - Steps to reproduce the bug
   - Expected vs actual behavior
   - Screenshots if applicable
   - Your environment (OS, browser, Node version)

### Suggesting Features

1. Open an issue with the `enhancement` label
2. Describe the feature and its use case
3. Explain how it benefits coaches and solopreneurs

### Submitting Changes

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/YOUR_USERNAME/coachkit.git`
3. **Create a branch**: `git checkout -b feature/your-feature-name`
4. **Install dependencies**: `npm install`
5. **Make your changes**
6. **Test locally**: `npm run dev`
7. **Lint**: `npm run lint`
8. **Commit** with a clear message following [Conventional Commits](https://conventionalcommits.org):
   - `feat: add email template preview`
   - `fix: resolve contact deduplication issue`
   - `docs: update API configuration guide`
   - `style: improve mobile layout for dashboard`
9. **Push** to your fork: `git push origin feature/your-feature-name`
10. **Open a Pull Request** against the `main` branch

### Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Update documentation if your change affects usage
- Add screenshots for UI changes
- Ensure no client-specific data, API keys, or credentials are included
- All environment-specific values should use environment variables

## Development Setup

### Prerequisites

- Node.js 18+
- npm or pnpm
- A Supabase project (free tier works)

### Local Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
npm run dev
```

### Project Structure

```
src/
├── pages/        # Route-level page components
├── components/   # Reusable UI components
├── contexts/     # React context providers (Auth, Toast)
├── lib/          # Supabase client, utilities
└── types/        # TypeScript type definitions
```

### Coding Standards

- **TypeScript** — All new code should be TypeScript
- **Functional Components** — Use React hooks, no class components
- **TailwindCSS** — Use utility classes for styling
- **Naming** — PascalCase for components, camelCase for functions/variables
- **Files** — One component per file, named after the component

## Areas Where We Need Help

- 🌍 **i18n** — Multi-language support
- 💳 **Payment Providers** — Stripe, PayPal integrations
- 📱 **Mobile** — React Native companion app
- 🧪 **Testing** — Unit and e2e test coverage
- 📖 **Docs** — Tutorials, video guides, API documentation
- ♿ **Accessibility** — WCAG compliance improvements

## Questions?

Open an issue with the `question` label, or start a discussion in the Discussions tab.

---

Thank you for helping make CoachKit better! ⚡
