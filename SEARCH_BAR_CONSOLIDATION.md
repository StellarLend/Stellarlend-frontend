# SearchBar Consolidation Documentation

## Overview

This document describes the consolidation of two search components (`components/molecules/SearchBar/SearchBar.tsx` and `components/shared/common/Searchbar.tsx`) into a single, unified, and accessible search component.

## Changes Made

### 1. New Consolidated Component

**Location:** `components/molecules/SearchBar/SearchBar.tsx`

The new SearchBar component consolidates functionality from both previous implementations with significant enhancements:

#### Features
- **Debounced Search Callback**: Optimizes performance by delaying `onSearch` callback execution (default: 300ms)
- **Clear Button**: X button that appears when the input has a value, clears on click
- **Keyboard Shortcuts**: Press `/` to focus the search input (can be disabled)
- **Keyboard Hint**: Visual hint showing `/` keyboard shortcut when input is empty
- **Focus States**: Visible focus ring with proper styling
- **Icon Alignment**: Proper placement of search icon and clear button
- **Accessibility**: Full ARIA support, keyboard navigation, proper labels
- **Type Safety**: TypeScript with comprehensive JSDoc documentation
- **Ref Forwarding**: Allows parent components to access the input element
- **Customization**: Multiple props for styling and behavior control

#### Props

```typescript
interface SearchBarProps {
  placeholder?: string;           // Placeholder text (default: "Search...")
  onSearch?: (value: string) => void;  // Debounced search callback
  debounceDelay?: number;         // Debounce delay in ms (default: 300)
  onClear?: () => void;           // Clear button callback
  className?: string;             // Additional CSS classes
  enableSlashShortcut?: boolean;  // Enable / keyboard shortcut (default: true)
  showClearButton?: boolean;      // Show clear button (default: true)
  showSearchIcon?: boolean;       // Show search icon (default: true)
  maxWidth?: 'sm' | 'md' | 'lg' | 'full';  // Max width (default: 'md')
  initialValue?: string;          // Initial input value (default: '')
  ariaLabel?: string;             // Aria label (default: 'Search input')
}
```

### 2. Component Exports

**Created:** `components/molecules/SearchBar/index.ts`

Exports the SearchBar component and its props interface for convenient imports.

### 3. Tests

**Location:** `components/molecules/SearchBar/SearchBar.test.tsx`

Comprehensive test suite with 60+ test cases covering:
- **Rendering**: Default and custom placeholders, icons, styles
- **Input Management**: Value changes, initial values, clear button visibility
- **Debounce Functionality**: Timing, cancellation, custom delays
- **Clear Button**: Functionality, focus behavior, callbacks
- **Keyboard Shortcuts**: Slash focus, modifier keys, disabling
- **Focus States**: Ring styles, hover styles
- **Ref Forwarding**: Ref manipulation and callbacks
- **Edge Cases**: Rapid changes, special characters, long input, cleanup
- **Accessibility**: ARIA labels, keyboard navigation, button types
- **Integration**: Form submission, multiple instances, all props together
- **Default Props**: Testing default behavior

**Coverage Target:** 95%+

### 4. Storybook Stories

**Location:** `stories/SearchBar.stories.tsx`

10+ interactive Storybook stories demonstrating:
- Default behavior
- Asset search use case
- Initial values
- Different widths (small, large, full)
- Icon visibility options
- Minimal variant
- Custom styling
- Controlled component pattern
- Form integration
- Multiple instances
- Accessibility features

### 5. Migration

#### Updated Files

1. **`components/shared/layout/TopNav.tsx`**
   - Changed import: `import SearchBar from "@/components/molecules/SearchBar"`
   - Updated usage: `<SearchBar placeholder="Search for token, asset, wallet address" />`

2. **`components/shared/common/Searchbar.tsx`**
   - Deprecated old component
   - Re-exports from new location for backward compatibility
   - Includes deprecation notice

3. **`components/shared/common/index.ts`**
   - Updated Searchbar export to re-export from new location
   - Added comment explaining consolidation
   - Maintains backward compatibility

4. **`components/molecules/SearchBar/index.ts`**
   - New file exporting SearchBar and SearchBarProps

## Backward Compatibility

The old `components/shared/common/Searchbar` component still exists as a re-export wrapper for backward compatibility. Any existing code using `import Searchbar from "@/components/shared/common/Searchbar"` will continue to work without changes.

**Migration Path (Optional):**
- Update imports to: `import SearchBar from "@/components/molecules/SearchBar"`
- Use new props like `onSearch`, `onClear`, `debounceDelay`, etc.

## Usage Examples

### Basic Usage

```tsx
import SearchBar from '@/components/molecules/SearchBar';

export default function MyComponent() {
  return (
    <SearchBar placeholder="Search for assets..." />
  );
}
```

### With Callbacks

```tsx
import { useState } from 'react';
import SearchBar from '@/components/molecules/SearchBar';

export default function AssetSearch() {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (query: string) => {
    console.log('Searching:', query);
    setSearchQuery(query);
    // Perform search API call
  };

  const handleClear = () => {
    setSearchQuery('');
  };

  return (
    <SearchBar
      placeholder="Search for token, asset, wallet address"
      onSearch={handleSearch}
      onClear={handleClear}
      debounceDelay={300}
    />
  );
}
```

### Controlled Component

```tsx
import { useState } from 'react';
import SearchBar from '@/components/molecules/SearchBar';

export default function ControlledSearch() {
  const [value, setValue] = useState('');

  return (
    <div>
      <SearchBar
        initialValue={value}
        onSearch={setValue}
        onClear={() => setValue('')}
      />
      <p>Current search: {value}</p>
    </div>
  );
}
```

### With Ref

```tsx
import { useRef } from 'react';
import SearchBar from '@/components/molecules/SearchBar';

export default function RefExample() {
  const searchRef = useRef<HTMLInputElement>(null);

  const handleFocus = () => {
    searchRef.current?.focus();
  };

  return (
    <>
      <SearchBar ref={searchRef} />
      <button onClick={handleFocus}>Focus Search</button>
    </>
  );
}
```

## Accessibility Features

- **ARIA Labels**: Proper `aria-label` on input and clear button
- **Keyboard Navigation**: Tab through input and clear button
- **Keyboard Shortcuts**: Press `/` to focus search (can be disabled)
- **Visual Focus State**: 2px focus ring with custom color
- **Hidden Icons**: Search icon has `aria-hidden="true"` since it's decorative
- **Button Types**: Clear button is properly typed as `button`
- **Titles**: Clear button has helpful `title` attribute

## Styling

The component uses Tailwind CSS and custom CSS variables for consistent styling:

- **Border Color**: `var(--New-outline, rgb(113,180,141))`
- **Focus Ring**: 2px ring with custom color
- **Hover Effect**: Border color changes on hover
- **Dark Mode**: Full dark mode support with appropriate color inversions
- **Responsive**: Adjusts padding and icon sizes for mobile

## Testing

To run the SearchBar tests:

```bash
npm test components/molecules/SearchBar/SearchBar.test.tsx
```

For coverage report:

```bash
npm test -- --coverage components/molecules/SearchBar/
```

## Storybook

To view interactive component stories:

```bash
npm run storybook
# Navigate to Components > SearchBar
```

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- iOS Safari
- Android Chrome

## Performance Considerations

- **Debouncing**: Reduces number of API calls (default 300ms)
- **Memoization**: Component uses `React.forwardRef` for ref stability
- **Event Listeners**: Keyboard listener cleanup on unmount
- **No External Dependencies**: Only uses React and Lucide icons (already in project)

## Migration Checklist

If you need to migrate existing code using the old Searchbar:

- [ ] Update import statement
- [ ] Add `onSearch` callback if needed
- [ ] Add `onClear` callback if needed
- [ ] Adjust debounce delay if needed (default 300ms)
- [ ] Test keyboard shortcut (/ key) functionality
- [ ] Verify styling matches your design
- [ ] Test accessibility with screen reader
- [ ] Update tests if component had tests

## Deprecation Notice

The old `components/shared/common/Searchbar.tsx` is now deprecated. While it continues to work for backward compatibility, new code should use the consolidated SearchBar component from `components/molecules/SearchBar/`.

The old component will be removed in a future major version release. Timeline: To be determined based on codebase migration progress.

## Questions & Support

For questions about the SearchBar component or consolidation process, refer to:
1. Component JSDoc in `SearchBar.tsx`
2. Storybook interactive documentation
3. Test cases for usage examples
4. This documentation

## Version History

### v1.0.0
- Initial consolidation of SearchBar and Searchbar components
- Added debounce, clear button, keyboard shortcuts
- Comprehensive test suite (60+ tests)
- Storybook documentation (10+ stories)
- Full accessibility support
- TypeScript support with JSDoc
