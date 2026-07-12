# SearchBar consolidation

Deprecate `components/shared/common/Searchbar` in favour of the molecules
`SearchBar`. Migration steps:

1. Update imports to `@/components/molecules/SearchBar`
2. Remove duplicate debounce logic from the legacy component
3. Delete the old file once Storybook stories reference the molecule

Track remaining call sites with `rg "shared/common/Searchbar"`.
