import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import React, { useState } from 'react';
import SearchBar, { SearchBarProps } from '../components/molecules/SearchBar/SearchBar';

const meta = {
  title: 'Components/SearchBar',
  component: SearchBar,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A consolidated, accessible search component with debounce, clear button, and keyboard support.

**Features:**
- Debounced search callback to optimize performance
- Clear (x) button for quick input reset
- Slash (/) keyboard shortcut to focus the search input
- Visible focus state with ring indicator
- Proper icon alignment with search and close icons
- Full accessibility support (ARIA labels, keyboard navigation)
- TypeScript support with comprehensive JSDoc documentation

**Example Usage:**
\`\`\`tsx
const [searchQuery, setSearchQuery] = useState('');

return (
  <SearchBar
    placeholder="Search for token, asset, wallet address"
    onSearch={(value) => setSearchQuery(value)}
    onClear={() => setSearchQuery('')}
  />
);
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    placeholder: {
      control: 'text',
      description: 'Placeholder text for the search input',
      table: { defaultValue: { summary: 'Search...' } },
    },
    onSearch: {
      description: 'Callback function triggered when search value changes (debounced)',
      action: 'searched',
    },
    onClear: {
      description: 'Callback function triggered when clear button is clicked',
      action: 'cleared',
    },
    debounceDelay: {
      control: { type: 'number', min: 0, max: 1000, step: 100 },
      description: 'Debounce delay in milliseconds',
      table: { defaultValue: { summary: '300' } },
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes for the root container',
    },
    enableSlashShortcut: {
      control: 'boolean',
      description: 'If true, the slash key will focus the search input',
      table: { defaultValue: { summary: 'true' } },
    },
    showClearButton: {
      control: 'boolean',
      description: 'If true, the clear button will be shown',
      table: { defaultValue: { summary: 'true' } },
    },
    showSearchIcon: {
      control: 'boolean',
      description: 'If true, the search icon will be shown',
      table: { defaultValue: { summary: 'true' } },
    },
    maxWidth: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'full'],
      description: 'Maximum width of the search bar',
      table: { defaultValue: { summary: 'md' } },
    },
    initialValue: {
      control: 'text',
      description: 'Initial value for the search input',
      table: { defaultValue: { summary: '""' } },
    },
    ariaLabel: {
      control: 'text',
      description: 'Aria-label for the search input',
      table: { defaultValue: { summary: 'Search input' } },
    },
  },
  args: {
    onSearch: fn(),
    onClear: fn(),
  },
} satisfies Meta<typeof SearchBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default SearchBar with all features enabled
 */
export const Default: Story = {
  args: {
    placeholder: 'Search...',
  },
};

/**
 * SearchBar with custom placeholder for asset search
 */
export const AssetSearch: Story = {
  args: {
    placeholder: 'Search for token, asset, wallet address',
  },
};

/**
 * SearchBar with initial value
 */
export const WithInitialValue: Story = {
  args: {
    placeholder: 'Search...',
    initialValue: 'initial search',
  },
};

/**
 * SearchBar with small max-width
 */
export const SmallWidth: Story = {
  args: {
    placeholder: 'Search...',
    maxWidth: 'sm',
  },
};

/**
 * SearchBar with large max-width
 */
export const LargeWidth: Story = {
  args: {
    placeholder: 'Search...',
    maxWidth: 'lg',
  },
};

/**
 * SearchBar taking full width
 */
export const FullWidth: Story = {
  args: {
    placeholder: 'Search...',
    maxWidth: 'full',
  },
};

/**
 * SearchBar without clear button
 */
export const NoClearButton: Story = {
  args: {
    placeholder: 'Search...',
    showClearButton: false,
  },
};

/**
 * SearchBar without search icon
 */
export const NoSearchIcon: Story = {
  args: {
    placeholder: 'Search...',
    showSearchIcon: false,
  },
};

/**
 * SearchBar without both icons (minimal)
 */
export const Minimal: Story = {
  args: {
    placeholder: 'Search...',
    showSearchIcon: false,
    showClearButton: false,
  },
};

/**
 * SearchBar with slash shortcut disabled
 */
export const NoSlashShortcut: Story = {
  args: {
    placeholder: 'Search...',
    enableSlashShortcut: false,
  },
};

/**
 * SearchBar with custom debounce delay (faster)
 */
export const FastDebounce: Story = {
  args: {
    placeholder: 'Search...',
    debounceDelay: 100,
  },
};

/**
 * SearchBar with custom debounce delay (slower)
 */
export const SlowDebounce: Story = {
  args: {
    placeholder: 'Search...',
    debounceDelay: 500,
  },
};

/**
 * SearchBar with custom styling
 */
export const CustomStyling: Story = {
  args: {
    placeholder: 'Search...',
    className: 'rounded-full border-2',
  },
};

/**
 * SearchBar in a controlled component example
 * Demonstrates how to use the SearchBar with state management
 */
export const Controlled: Story = {
  render: (args) => {
    const [searchValue, setSearchValue] = useState('');

    const handleSearch = (value: string) => {
      setSearchValue(value);
      args.onSearch?.(value);
    };

    const handleClear = () => {
      setSearchValue('');
      args.onClear?.();
    };

    return (
      <div className="w-full max-w-md">
        <SearchBar
          {...args}
          initialValue={searchValue}
          onSearch={handleSearch}
          onClear={handleClear}
        />
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <p className="text-sm font-semibold text-gray-700">Current search value:</p>
          <p className="text-lg font-mono text-gray-900">{searchValue || '(empty)'}</p>
        </div>
      </div>
    );
  },
  args: {
    placeholder: 'Type to search...',
  },
};

/**
 * SearchBar in a form context
 * Demonstrates how to use the SearchBar in a form
 */
export const InForm: Story = {
  render: (args) => {
    const [results, setResults] = useState<string[]>([]);

    const handleSearch = (value: string) => {
      // Simulate search results
      if (value.length > 0) {
        setResults([
          `Result 1 for "${value}"`,
          `Result 2 for "${value}"`,
          `Result 3 for "${value}"`,
        ]);
      } else {
        setResults([]);
      }
      args.onSearch?.(value);
    };

    const handleClear = () => {
      setResults([]);
      args.onClear?.();
    };

    return (
      <div className="w-full max-w-md">
        <form onSubmit={(e) => e.preventDefault()}>
          <SearchBar
            {...args}
            onSearch={handleSearch}
            onClear={handleClear}
            ariaLabel="Search for results"
          />
        </form>

        {results.length > 0 && (
          <div className="mt-4 border rounded-lg overflow-hidden">
            <ul className="divide-y">
              {results.map((result, index) => (
                <li
                  key={index}
                  className="px-4 py-2 hover:bg-gray-50 text-sm text-gray-700 cursor-pointer"
                >
                  {result}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  },
  args: {
    placeholder: 'Search for assets...',
  },
};

/**
 * Multiple SearchBar instances
 * Demonstrates how to use multiple SearchBar components together
 */
export const Multiple: Story = {
  render: (args) => {
    const [search1, setSearch1] = useState('');
    const [search2, setSearch2] = useState('');

    return (
      <div className="w-full space-y-6">
        <div className="max-w-md">
          <p className="mb-2 text-sm font-semibold text-gray-700">Search 1:</p>
          <SearchBar
            {...args}
            placeholder="Search tokens..."
            initialValue={search1}
            onSearch={setSearch1}
            onClear={() => setSearch1('')}
          />
          <p className="mt-2 text-xs text-gray-500">Value: {search1 || '(empty)'}</p>
        </div>

        <div className="max-w-md">
          <p className="mb-2 text-sm font-semibold text-gray-700">Search 2:</p>
          <SearchBar
            {...args}
            placeholder="Search wallets..."
            initialValue={search2}
            onSearch={setSearch2}
            onClear={() => setSearch2('')}
          />
          <p className="mt-2 text-xs text-gray-500">Value: {search2 || '(empty)'}</p>
        </div>
      </div>
    );
  },
};

/**
 * Accessibility demonstration
 * Shows keyboard navigation and screen reader support
 */
export const Accessibility: Story = {
  render: (args) => (
    <div className="w-full max-w-md space-y-4">
      <SearchBar
        {...args}
        placeholder="Search..."
        ariaLabel="Accessible search input"
      />
      <div className="p-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
        <p className="font-semibold mb-2">Keyboard Navigation:</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Press <code className="bg-white px-1 rounded">/</code> to focus the search</li>
          <li>Press <code className="bg-white px-1 rounded">Tab</code> to navigate to clear button</li>
          <li>Press <code className="bg-white px-1 rounded">Enter</code> in a form to submit</li>
          <li>Press <code className="bg-white px-1 rounded">Escape</code> to blur (standard behavior)</li>
        </ul>
      </div>
    </div>
  ),
  args: {
    placeholder: 'Type to search... (or press / to focus)',
  },
};
