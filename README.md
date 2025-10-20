# FieldTack WA

A Next.js application for piecework management and payroll for Washington state labor laws. This app helps manage QR code time tracking, piecework recording, offline data storage, automatic synchronization, WA payroll automation, and invoicing.

## Features

- **QR Code Time Tracking**: Scan employee QR codes for clocking in/out and breaks
- **Piecework Recording**: Track piece counts with QC notes
- **Offline Data Storage**: Local database for offline work
- **Automatic Synchronization**: Sync when connection is restored
- **WA Payroll Automation**: Automatic payroll calculations compliant with WA labor laws
- **Invoicing**: Generate PDF invoices and CSV exports
- **AI-Powered Reports**: Ensure compliance with WA labor law requirements

## Setup

### Prerequisites

- Node.js 18+ and npm
- Firebase project (for authentication and database)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd studio
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env.local`
   - Update the Firebase credentials with your project's values:
   
```bash
cp .env.example .env.local
```

Edit `.env.local` with your Firebase project credentials:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_ANONYMOUS=true
```

### Development

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building

Build the application for production:
```bash
npm run build
```

### Type Checking

Run TypeScript type checking:
```bash
npm run typecheck
```

### Linting

Run ESLint:
```bash
npm run lint
```

## Firebase Configuration

This project uses Firebase for:
- **Authentication**: Anonymous and email/password authentication
- **Firestore**: Real-time database for storing employees, clients, tasks, time tracking, and payroll data
- **Security Rules**: Located in `firestore.rules`

Make sure your Firebase project has:
1. Anonymous authentication enabled (or email/password)
2. Firestore database created
3. Security rules deployed

## Project Structure

- `/src/app` - Next.js app router pages
- `/src/components` - React components (UI components and layouts)
- `/src/firebase` - Firebase configuration and utilities
- `/src/lib` - Utility functions and types
- `/src/ai` - AI-powered report generation using Genkit
- `/docs` - Project documentation

## Tech Stack

- **Framework**: Next.js 15
- **UI**: React 18, Tailwind CSS, Radix UI
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **AI**: Google Genkit
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts

## License

Private project.
