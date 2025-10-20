# Contributing to FieldTack WA

Thank you for considering contributing to FieldTack WA!

## Development Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd studio
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Edit `.env.local` with your Firebase project credentials

5. Run the development server:
```bash
npm run dev
```

## Code Quality Standards

### Before Committing

1. **Type Check**: Ensure no TypeScript errors
```bash
npm run typecheck
```

2. **Lint**: Run ESLint to check code style
```bash
npm run lint
```

3. **Build**: Verify the project builds successfully
```bash
npm run build
```

### Code Style

- Use TypeScript for all new files
- Follow the existing code structure and patterns
- Use functional components with hooks for React
- Add proper TypeScript types - avoid using `any`
- Use meaningful variable and function names
- Keep functions small and focused

### Component Guidelines

- Place reusable UI components in `src/components/ui/`
- Place layout components in `src/components/layout/`
- Use the Radix UI primitives from `@radix-ui/*` for accessible components
- Follow the Shadcn UI patterns for component composition

### Firebase Guidelines

- Never commit Firebase credentials to source control
- Use environment variables for all configuration
- Implement proper error handling for Firebase operations
- Use the Firebase hooks in `src/firebase/` for data access
- Follow the security rules defined in `firestore.rules`

### State Management

- Use React hooks for component state
- Use Firebase Firestore for persistent data
- Use the custom hooks in `src/firebase/` for Firebase data

## Git Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Commit with descriptive messages
4. Push to your branch
5. Create a Pull Request

### Commit Messages

Use clear, descriptive commit messages:

```
Add QR code scanner component
Fix payroll calculation for overtime
Update README with deployment instructions
```

## Testing

- Test your changes thoroughly before submitting
- Ensure the app works in offline mode
- Test Firebase authentication flows
- Verify Firestore security rules are working

## Questions?

If you have questions, please open an issue for discussion.
