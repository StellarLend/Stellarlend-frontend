// SearchBar has been consolidated and moved to components/molecules/SearchBar
// For backward compatibility, re-export from the new location
export { default as Searchbar, type SearchBarProps as SearchbarProps } from '@/components/molecules/SearchBar';

export { RecentTransactions } from './RecentTransactions';
export { PageHeader } from './PageHeader';
export { AlertBanner } from './AlertBanner';
export type { PageHeaderProps, PageHeaderTone } from './PageHeader';
export type { AlertBannerSeverity, AlertBannerProps } from './AlertBanner';
