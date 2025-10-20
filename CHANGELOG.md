# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2025-10-20

### Added
- `.env.example` file with Firebase configuration template
- `.env.local` file for local development (gitignored)
- ESLint configuration file (`.eslintrc.json`)
- `public/robots.txt` for SEO optimization
- Firebase Error Listener component integrated into app layout
- Comprehensive README.md with setup instructions, tech stack, and project structure
- Public directory structure

### Changed
- **SECURITY**: Firebase credentials moved from hardcoded values to environment variables
- Firebase config (`src/firebase/config.ts`) now uses `process.env` variables
- Next.js config (`next.config.ts`) no longer ignores TypeScript and ESLint errors
- PostCSS config now includes autoprefixer
- App metadata manifest path corrected from `/manifest.ts` to `/manifest.json`
- Package name updated from "nextn" to "fieldtack-wa"

### Removed
- Hardcoded Firebase credentials from source code
- `.modified` empty file (unused)
- TypeScript and ESLint error ignoring from build configuration

### Security
- CodeQL security analysis run: **0 vulnerabilities found**
- All Firebase credentials properly managed through environment variables
- Sensitive data no longer committed to version control

## Migration Guide

If you're upgrading from a previous version:

1. Copy `.env.example` to `.env.local`
2. Update `.env.local` with your Firebase credentials
3. Remove any local configuration that had hardcoded credentials
4. Run `npm install` to ensure all dependencies are up to date
5. Run `npm run typecheck` to verify TypeScript compilation
6. Run `npm run lint` to check for any ESLint issues

## Environment Variables Required

The following environment variables must be set in `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_ANONYMOUS=true
```
