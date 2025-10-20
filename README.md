# FieldTack WA

A comprehensive piecework management and payroll application for Washington state labor laws, built with Next.js and Firebase.

## Features

- 📱 **Fully Responsive Design** - Optimized for mobile, tablet, and desktop devices
- 🔐 **Simple Authentication** - Login with credentials (Demo: David / 1234)
- 👥 **Employee Management** - Track supervisors and workers
- 💼 **Client Management** - Manage company clients and contracts
- ✅ **Task Management** - Organize work tasks and projects by client
- ⏰ **Time Tracking** - QR code scanner and manual entry for clock in/out
- 💰 **Payroll System** - Generate payroll reports with WA state compliance
- 📄 **Invoicing** - Create detailed invoices for client billing
- 🔍 **Global Search** - Search functionality across the application

## Getting Started

To get started with development:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Login

Default credentials:
- Username: `David`
- Password: `1234`

## Mobile Responsiveness

The application is fully responsive and works seamlessly on:
- 📱 Mobile phones (320px and up)
- 📱 Tablets (768px and up)
- 💻 Desktop computers (1024px and up)

Key mobile features:
- Collapsible sidebar with toggle button
- Responsive tables that adapt to screen size
- Touch-optimized buttons and inputs
- Proper viewport scaling
- Mobile-friendly navigation

## Tech Stack

- **Framework**: Next.js 15
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **Components**: Radix UI
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **TypeScript**: Full type safety

## Project Structure

```
src/
├── app/              # Next.js app directory
│   ├── (app)/       # Protected routes
│   │   ├── dashboard/
│   │   ├── employees/
│   │   ├── clients/
│   │   ├── tasks/
│   │   ├── time-tracking/
│   │   ├── payroll/
│   │   └── invoicing/
│   └── login/       # Public login page
├── components/      # Reusable UI components
│   ├── layout/     # Header and sidebar
│   └── ui/         # Base UI components
├── contexts/       # React contexts (Auth)
├── firebase/       # Firebase configuration
└── lib/            # Utility functions
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## License

Private project for FieldTack WA.
