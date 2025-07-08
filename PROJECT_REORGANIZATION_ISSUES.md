# Stellarlend Frontend - Project Reorganization Issues

## Issue #1: Reorganize Component Structure and Implement Feature-Based Architecture

### Description
The current component structure is flat and lacks clear organization. Components are scattered across different directories without a clear hierarchy or feature-based organization.

### Current Problems
- Components are mixed between feature-specific and shared components
- No clear separation between UI components and business logic components
- Duplicate navigation components (`NavLink.tsx` exists in both root and `Navbar/` directory)
- Feature-specific components are not properly grouped (e.g., lending components are mixed with general components)

### Proposed Solution
Restructure components into a feature-based architecture:

```
components/
├── shared/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   └── icons/
│   ├── layout/
│   │   ├── Navbar/
│   │   ├── Sidebar/
│   │   ├── Footer.tsx
│   │   └── DashboardLayout.tsx
│   └── common/
│       ├── Searchbar.tsx
│       └── RecentTransactions.tsx
├── features/
│   ├── lending/
│   │   ├── components/
│   │   │   ├── LendingForm.tsx
│   │   │   ├── BorrowingForm.tsx
│   │   │   ├── InterestCalculator.tsx
│   │   │   ├── TransactionSummary.tsx
│   │   │   ├── ConfirmModal.tsx
│   │   │   └── TabSelector.tsx
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   ├── dashboard/
│   │   ├── components/
│   │   │   └── MetricsCards.tsx
│   │   ├── hooks/
│   │   └── services/
│   └── account/
│       ├── components/
│       │   └── ProfileForm.tsx
│       ├── hooks/
│       └── services/
└── marketing/
    ├── Hero.tsx
    ├── HowItWorks.tsx
    ├── ExploreFeatures.tsx
    ├── FastSecure.tsx
    └── testimonial.tsx
```

### Tasks
- [ ] Create new directory structure
- [ ] Move components to appropriate directories
- [ ] Update import paths across the project
- [ ] Remove duplicate components
- [ ] Create index files for easier imports
- [ ] Update TypeScript path mappings if needed

### Acceptance Criteria
- [ ] All components are properly organized by feature
- [ ] No duplicate components exist
- [ ] Import paths are updated and working
- [ ] Clear separation between shared and feature-specific components

---

## Issue #2: Consolidate and Organize Asset Management

### Description
Assets are currently scattered across multiple locations with inconsistent naming and organization. There are duplicate icon systems and unclear asset management patterns.

### Current Problems
- Icons exist in both `components/ui/icons/` and `public/icons/`
- Inconsistent file formats (SVG, PNG mixed)
- No clear naming convention for assets
- Large icon files (e.g., `FastSecure.tsx` is 241KB)
- Assets are not optimized or properly categorized

### Proposed Solution
Create a centralized asset management system:

```
public/
├── assets/
│   ├── icons/
│   │   ├── ui/          # UI-specific icons
│   │   ├── crypto/      # Cryptocurrency icons
│   │   ├── banking/     # Banking-related icons
│   │   └── branding/    # Brand-specific icons
│   ├── images/
│   │   ├── hero/        # Hero section images
│   │   ├── marketing/   # Marketing materials
│   │   └── avatars/     # User avatars
│   └── logos/
│       ├── primary/
│       └── variants/
```

### Tasks
- [ ] Audit all existing assets
- [ ] Optimize large files (especially the 241KB FastSecure icon)
- [ ] Consolidate duplicate icons
- [ ] Implement consistent naming convention
- [ ] Create asset manifest file
- [ ] Update all asset references in components
- [ ] Implement lazy loading for large assets

### Acceptance Criteria
- [ ] All assets are properly categorized
- [ ] No duplicate assets exist
- [ ] Large files are optimized
- [ ] Consistent naming convention is applied
- [ ] Asset manifest is created and maintained

---

## Issue #3: Implement Proper Type System and Data Models

### Description
The project lacks a proper TypeScript type system with empty `types/` directory and no clear data models for the lending platform.

### Current Problems
- Empty `types/` directory
- No TypeScript interfaces for business entities
- Missing type definitions for API responses
- No validation schemas
- Inconsistent prop typing across components

### Proposed Solution
Create comprehensive type system:

```
types/
├── api/
│   ├── requests.ts      # API request types
│   ├── responses.ts     # API response types
│   └── endpoints.ts     # API endpoint definitions
├── entities/
│   ├── user.ts          # User-related types
│   ├── lending.ts       # Lending/borrowing types
│   ├── transaction.ts   # Transaction types
│   └── account.ts       # Account types
├── components/
│   ├── shared.ts        # Shared component props
│   ├── forms.ts         # Form-related types
│   └── ui.ts           # UI component types
├── utils/
│   ├── validation.ts    # Validation schemas
│   └── helpers.ts       # Helper type utilities
└── index.ts            # Main type exports
```

### Tasks
- [ ] Define core business entity types (User, Loan, Transaction, etc.)
- [ ] Create API request/response type definitions
- [ ] Implement form validation schemas
- [ ] Add proper prop types for all components
- [ ] Create utility types for common patterns
- [ ] Add strict TypeScript configuration

### Acceptance Criteria
- [ ] All business entities have proper TypeScript definitions
- [ ] API types are comprehensive and up-to-date
- [ ] Form validation uses proper schemas
- [ ] All components have proper prop types
- [ ] TypeScript strict mode is enabled

---

## Issue #4: Establish Service Layer and API Management

### Description
The project lacks a proper service layer with empty `services/` directory and no centralized API management.

### Current Problems
- Empty `services/` directory
- No centralized API client
- Missing error handling patterns
- No request/response interceptors
- No caching strategy
- Inconsistent data fetching patterns

### Proposed Solution
Implement comprehensive service layer:

```
services/
├── api/
│   ├── client.ts        # Base API client
│   ├── config.ts        # API configuration
│   └── interceptors.ts  # Request/response interceptors
├── auth/
│   ├── authService.ts   # Authentication service
│   └── authGuard.ts     # Route protection
├── lending/
│   ├── lendingService.ts    # Lending operations
│   ├── borrowingService.ts  # Borrowing operations
│   └── transactionService.ts # Transaction management
├── user/
│   ├── userService.ts   # User management
│   └── profileService.ts # Profile operations
├── cache/
│   ├── cacheManager.ts  # Caching strategy
│   └── storage.ts       # Local storage utilities
└── utils/
    ├── errorHandler.ts  # Error handling utilities
    └── validators.ts    # API validation helpers
```

### Tasks
- [ ] Set up base API client with interceptors
- [ ] Implement authentication service
- [ ] Create lending/borrowing services
- [ ] Add proper error handling
- [ ] Implement caching strategy
- [ ] Add request/response validation
- [ ] Create service hooks for React components

### Acceptance Criteria
- [ ] Centralized API client is implemented
- [ ] All API calls go through service layer
- [ ] Proper error handling is in place
- [ ] Caching strategy is implemented
- [ ] Service hooks are available for components

---

## Issue #5: Implement State Management and Context Organization

### Description
The project has minimal state management with only a `SidebarContext.tsx` and empty `store/` directory. No proper global state management for the lending platform.

### Current Problems
- Only sidebar state is managed
- Empty `store/` directory
- No global state for user authentication
- Missing state for lending/borrowing operations
- No persistent state management
- No state synchronization between components

### Proposed Solution
Implement comprehensive state management:

```
store/
├── slices/
│   ├── auth/
│   │   ├── authSlice.ts     # Authentication state
│   │   └── authSelectors.ts  # Auth selectors
│   ├── lending/
│   │   ├── lendingSlice.ts   # Lending state
│   │   └── lendingSelectors.ts
│   ├── user/
│   │   ├── userSlice.ts      # User state
│   │   └── userSelectors.ts
│   └── ui/
│       ├── uiSlice.ts        # UI state
│       └── uiSelectors.ts
├── middleware/
│   ├── authMiddleware.ts     # Auth middleware
│   ├── cacheMiddleware.ts    # Cache middleware
│   └── loggerMiddleware.ts   # Logging middleware
├── hooks/
│   ├── useAuth.ts           # Auth hooks
│   ├── useLending.ts        # Lending hooks
│   └── useUser.ts           # User hooks
└── index.ts                 # Store configuration
```

### Tasks
- [ ] Set up state management library (Zustand/Redux Toolkit)
- [ ] Create authentication state slice
- [ ] Implement lending/borrowing state management
- [ ] Add user profile state management
- [ ] Create custom hooks for state access
- [ ] Implement persistent state storage
- [ ] Add state synchronization between tabs

### Acceptance Criteria
- [ ] Global state management is implemented
- [ ] Authentication state is properly managed
- [ ] Lending operations have proper state
- [ ] State persists across sessions
- [ ] Custom hooks provide easy state access
- [ ] State is synchronized between components

### Additional Considerations
- Consider using Zustand for lighter state management
- Implement optimistic updates for better UX
- Add state debugging tools for development
- Consider implementing real-time state updates for transactions

---

## Implementation Priority

1. **Issue #1** - Component Structure (High Priority)
   - Foundation for all other improvements
   - Affects development velocity immediately

2. **Issue #3** - Type System (High Priority)
   - Critical for code quality and developer experience
   - Should be done before service layer implementation

3. **Issue #4** - Service Layer (Medium Priority)
   - Depends on type system being in place
   - Enables proper API management

4. **Issue #2** - Asset Management (Medium Priority)
   - Can be done in parallel with other issues
   - Improves performance and maintainability

5. **Issue #5** - State Management (Lower Priority)
   - Can be implemented incrementally
   - Depends on service layer being established

## Notes
- Each issue should be tackled as a separate milestone
- Consider creating feature branches for each issue
- Update documentation as changes are implemented
- Ensure backward compatibility during transitions
- Add comprehensive testing for each reorganization 