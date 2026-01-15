# Contributing to Stellarlend

Thank you for your interest in contributing to Stellarlend! This document provides guidelines and instructions for contributing to the project.

## 🚀 Getting Started

1. **Fork the repository** and clone your fork
2. **Create a branch** for your feature or fix: `git checkout -b feature/your-feature-name`
3. **Install dependencies**: `npm install` (or `pnpm install`)
4. **Make your changes** following our coding standards
5. **Test your changes**: `npm test` and `npm run lint`
6. **Commit your changes** using conventional commits
7. **Push to your fork** and open a Pull Request

## 📝 Code Style

### TypeScript

- Use TypeScript strict mode (already enabled)
- Define types for all function parameters and return values
- Prefer `interface` for object shapes, `type` for unions/intersections
- Use meaningful, descriptive names

### React Components

- Use functional components with hooks
- Prefer named exports for components
- Keep components focused and single-purpose
- Use TypeScript for all component props

### File Naming

- Components: `PascalCase.tsx` (e.g., `LendingForm.tsx`)
- Utilities: `camelCase.ts` (e.g., `formatCurrency.ts`)
- Types: `PascalCase.ts` (e.g., `Transaction.ts`)
- Constants: `camelCase.ts` (e.g., `design-tokens.ts`)

### Component Structure

Follow this structure for new components:

```tsx
// 1. Imports (external, then internal)
import React from "react";
import { Button } from "@/components/shared/ui";

// 2. Types/Interfaces
interface ComponentProps {
  // ...
}

// 3. Component
export default function Component({ ... }: ComponentProps) {
  // ...
}

// 4. Exports (if needed)
```

## 🧪 Testing

- Write tests for new features and bug fixes
- Use Vitest for unit tests
- Use React Testing Library for component tests
- Aim for meaningful test coverage
- Test user interactions, not implementation details

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## 📦 Component Development

### Using Storybook

1. Create a `.stories.tsx` file for your component
2. Document all props and variants
3. Add examples for different states
4. Test accessibility with Storybook's a11y addon

```bash
# Start Storybook
npm run storybook

# Build Storybook
npm run build-storybook
```

### Generating Components

Use our Plop generator for consistent component structure:

```bash
npm run generate-component
```

## 🎨 Styling

- Use Tailwind CSS utility classes
- Follow the design tokens in `constants/design-tokens.ts`
- Use the `cn()` utility for conditional classes
- Keep styles co-located with components when possible
- Use CSS variables for theme values

## 📁 Project Structure

Follow the established structure:

- **`app/`**: Next.js App Router pages
- **`components/`**: React components organized by:
  - `atoms/`: Smallest reusable components
  - `molecules/`: Composite components
  - `organisms/`: Complex components
  - `features/`: Feature-specific components
  - `marketing/`: Marketing page components
  - `shared/`: Shared components (ui, layout, common)
- **`lib/`**: Utility libraries and helpers
- **`types/`**: TypeScript type definitions
- **`constants/`**: Application constants
- **`context/`**: React context providers

## 🔄 Git Workflow

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/updates

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Maintenance tasks

**Examples:**
```
feat(lending): add interest rate calculator
fix(dashboard): resolve transaction display issue
docs(readme): update setup instructions
refactor(components): reorganize shared components
```

### Pull Request Process

1. **Update documentation** if needed
2. **Add tests** for new features
3. **Ensure all tests pass**: `npm test`
4. **Ensure linting passes**: `npm run lint`
5. **Update CHANGELOG.md** (if applicable)
6. **Request review** from maintainers
7. **Address feedback** and update PR as needed

## 🐛 Reporting Bugs

When reporting bugs, please include:

1. **Description** of the bug
2. **Steps to reproduce**
3. **Expected behavior**
4. **Actual behavior**
5. **Screenshots** (if applicable)
6. **Environment** (browser, OS, Node version)
7. **Error messages** or console logs

## 💡 Feature Requests

For feature requests:

1. Check if the feature already exists or is planned
2. Open an issue with a clear description
3. Explain the use case and benefits
4. Provide examples or mockups if possible

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Conventional Commits](https://www.conventionalcommits.org/)

## ❓ Questions?

- Open an issue for questions
- Check existing issues and discussions
- Reach out to maintainers

Thank you for contributing to Stellarlend! 🎉

