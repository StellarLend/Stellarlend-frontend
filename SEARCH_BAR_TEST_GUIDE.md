# SearchBar Consolidation - Test & Verification Guide

## Automated Tests

### Running All Tests

```bash
# Run all SearchBar tests
npm test components/molecules/SearchBar/SearchBar.test.tsx

# Run with coverage report
npm test -- --coverage components/molecules/SearchBar/

# Watch mode (auto-rerun on changes)
npm test -- --watch components/molecules/SearchBar/SearchBar.test.tsx
```

### Test Suite Coverage

The test suite includes **60+ test cases** organized into 11 describe blocks:

1. **Rendering** (8 tests)
   - Default and custom placeholders
   - Icon rendering
   - Accessibility attributes
   - Custom styling

2. **Input Value Management** (5 tests)
   - Value updates
   - Initial values
   - Clear button visibility
   - Edge cases

3. **Search Callback with Debounce** (5 tests)
   - Debounce timing
   - Debounce cancellation
   - Custom delays
   - Search on clear

4. **Clear Button Functionality** (5 tests)
   - Value clearing
   - Callback invocation
   - Focus management
   - Button visibility

5. **Keyboard Shortcuts** (6 tests)
   - Slash focus
   - Modifier keys
   - Disabling shortcuts
   - Keyboard hint visibility
   - Protection from other inputs

6. **Focus State and Styling** (4 tests)
   - Focus ring styles
   - Hover styles
   - Border colors

7. **Ref Forwarding** (3 tests)
   - Ref creation
   - Direct manipulation
   - Callback refs

8. **Edge Cases** (7 tests)
   - Rapid input changes
   - Special characters
   - Long input (1000+ chars)
   - Unmount cleanup
   - Empty values
   - Undefined props
   - Whitespace and numeric input

9. **Accessibility** (5 tests)
   - ARIA labels
   - Input type
   - Keyboard navigation
   - Button attributes

10. **Integration** (3 tests)
    - Form submission
    - All props together
    - Multiple instances

11. **Default Props** (4 tests)
    - Debounce delay
    - Clear button visibility
    - Search icon visibility
    - Slash shortcut enablement

## Manual Verification Checklist

### Visual Testing

- [ ] Component renders without errors in browser
- [ ] Search icon appears on the left
- [ ] Clear (×) button appears only when input has value
- [ ] Focus ring is clearly visible (2px green ring)
- [ ] Placeholder text is visible and centered
- [ ] Dark mode styling works correctly
- [ ] Responsive design works on mobile (< 640px)
- [ ] Responsive design works on tablet (640px - 1024px)
- [ ] Responsive design works on desktop (> 1024px)

### Functionality Testing

- [ ] Can type in the search input
- [ ] Debounce delays the search callback (default 300ms)
- [ ] Clear button appears after typing
- [ ] Clicking clear button empties the input
- [ ] Clear button disappears after input is empty
- [ ] Focus is restored to input after clearing
- [ ] onSearch callback is called with current value
- [ ] onClear callback is called when clearing

### Keyboard Navigation Testing

- [ ] Tab key navigates to search input
- [ ] Tab key navigates from input to clear button (when visible)
- [ ] Shift+Tab navigates backwards
- [ ] Space/Enter activates clear button
- [ ] `/` key focuses the search input
- [ ] `Ctrl+/` does NOT focus the search input
- [ ] `Cmd+/` (Mac) does NOT focus the search input
- [ ] Alt+/ does NOT focus the search input
- [ ] Shift+/ does NOT focus the search input
- [ ] Keyboard hint (`/`) shows when empty
- [ ] Keyboard hint disappears when value is present

### Accessibility Testing

#### Screen Reader (NVDA, JAWS, VoiceOver)

- [ ] Screen reader announces "Search input" label correctly
- [ ] Input type is announced as "Edit text"
- [ ] Placeholder text is available to screen reader
- [ ] Clear button has label "Clear search input"
- [ ] Clear button is announced as a button
- [ ] Search icon is skipped (aria-hidden)
- [ ] Icons don't create noise in screen reader

#### Keyboard Only Navigation

- [ ] All functionality accessible via keyboard
- [ ] No keyboard traps
- [ ] Focus order is logical: Input → Clear button → Next element
- [ ] Focus indicator is visible at all times

#### Visual Accessibility

- [ ] Focus ring has sufficient contrast (WCAG AA)
- [ ] Text has sufficient contrast (WCAG AA)
- [ ] Component works at 200% zoom
- [ ] Component works with high contrast mode
- [ ] Font size adjustable (no fixed px on text)

### Integration Testing

#### In TopNav Component

- [ ] Appears in top navigation bar
- [ ] Styling matches the green header background
- [ ] Search functionality works in context
- [ ] Doesn't interfere with other header elements
- [ ] Responsive adjustments work in context

#### With Different Props

- [ ] Works with custom placeholder
- [ ] Works with initial value
- [ ] Works with debounce delay of 100ms
- [ ] Works with debounce delay of 500ms
- [ ] Works with slash shortcut disabled
- [ ] Works with clear button hidden
- [ ] Works with search icon hidden
- [ ] Works with different max-width options

### Performance Testing

- [ ] No memory leaks (check DevTools heap snapshots)
- [ ] Debounce prevents excessive function calls
- [ ] Cleanup on unmount is effective
- [ ] Multiple instances don't cause slowdown

### Browser Compatibility

Test in the following browsers:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Storybook Verification

```bash
npm run storybook
# Navigate to Components > SearchBar in the sidebar
```

Verify each story:

- [ ] **Default** - Basic search bar
- [ ] **AssetSearch** - Custom placeholder
- [ ] **WithInitialValue** - Pre-filled value
- [ ] **SmallWidth** - max-w-sm constraint
- [ ] **LargeWidth** - max-w-lg constraint
- [ ] **FullWidth** - Full width
- [ ] **NoClearButton** - Without clear button
- [ ] **NoSearchIcon** - Without search icon
- [ ] **Minimal** - No icons
- [ ] **NoSlashShortcut** - Slash shortcut disabled
- [ ] **FastDebounce** - 100ms debounce
- [ ] **SlowDebounce** - 500ms debounce
- [ ] **CustomStyling** - Additional CSS classes
- [ ] **Controlled** - Controlled component pattern
- [ ] **InForm** - Inside form element
- [ ] **Multiple** - Multiple instances
- [ ] **Accessibility** - A11y features demo

Each story should:
- Render without errors
- Be interactive
- Show correct styling
- Include documentation

## Test Output Format

When running tests, expect output like:

```
✓ SearchBar Component (60 tests)
  ✓ Rendering (8 tests)
    ✓ should render the search input with default placeholder
    ✓ should render with custom placeholder
    ... (6 more)
  ✓ Input Value Management (5 tests)
    ... (5 tests)
  ✓ Search Callback with Debounce (5 tests)
    ... (5 tests)
  ... (remaining describe blocks)

Test Files  1 passed (1)
     Tests  60 passed (60)
```

## Coverage Report

Expected coverage metrics:

- **Statements**: 95%+
- **Branches**: 95%+
- **Functions**: 95%+
- **Lines**: 95%+

Run with coverage:
```bash
npm test -- --coverage components/molecules/SearchBar/
```

## Known Limitations

None currently documented. Component should work in all modern browsers.

## Debugging

### Common Issues

**Issue:** Clear button not appearing
- [ ] Check if input has a value
- [ ] Check `showClearButton` prop is true
- [ ] Clear browser cache

**Issue:** Slash shortcut not working
- [ ] Check if user is already in another input
- [ ] Check if `enableSlashShortcut` prop is true
- [ ] Check browser console for errors

**Issue:** Styling looks different
- [ ] Check Tailwind CSS is loaded
- [ ] Check CSS variable `--New-outline` is defined
- [ ] Clear browser cache

### Enable Debug Mode

Add this to component for debugging:

```tsx
useEffect(() => {
  console.log('SearchBar value:', value);
  console.log('SearchBar props:', { 
    showClearButton, 
    showSearchIcon, 
    enableSlashShortcut 
  });
}, [value, showClearButton, showSearchIcon, enableSlashShortcut]);
```

## Performance Metrics to Monitor

After deployment, monitor:

1. **Component Load Time**: Should be < 50ms
2. **Search Callback Frequency**: Should match debounce delay
3. **Memory Usage**: No memory leaks on repeated mount/unmount
4. **Re-renders**: Only re-render on value change or prop change

## Continuous Integration

The test suite should be integrated into CI/CD:

```yaml
# Example GitHub Actions
- name: Run SearchBar Tests
  run: npm test components/molecules/SearchBar/SearchBar.test.tsx

- name: Generate Coverage
  run: npm test -- --coverage components/molecules/SearchBar/
```

## Rollback Plan

If issues are discovered:

1. Tests are failing:
   - Check test file syntax
   - Ensure all dependencies are installed
   - Clear npm cache: `npm cache clean --force`

2. Component is broken:
   - Revert to previous SearchBar implementation
   - Keep both components temporarily
   - Plan gradual migration

3. Styling issues:
   - Check CSS variable values
   - Verify Tailwind CSS is loaded
   - Check for CSS conflicts

## Sign-Off Checklist

Before considering the consolidation complete:

- [ ] All 60+ tests pass
- [ ] Coverage >= 95%
- [ ] All Storybook stories render
- [ ] Manual testing complete
- [ ] Accessibility testing complete
- [ ] Browser compatibility verified
- [ ] TopNav integration works
- [ ] Documentation complete
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Performance acceptable
- [ ] Ready for merge and deployment

## Next Steps

1. Run full test suite
2. Review test coverage report
3. Manual verification in browser
4. Deploy to staging
5. Final QA testing
6. Merge to main branch
7. Monitor in production
