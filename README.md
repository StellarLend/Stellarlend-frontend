This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.


Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# SVG to React Component Converter

This project includes a powerful script to convert SVG files into reusable React components. Below you'll find detailed instructions on how to use it.

## SVG to React Component Converter Guide

### Prerequisites
- Node.js installed
- A Next.js project with TypeScript

### Setup

1. Place the conversion script in your project:
```bash
mkdir scripts
# Copy the svgToComponent.js file into the scripts folder
```

2. Add the script to your package.json:
```json
{
  "scripts": {
    "svg": "node scripts/svgToComponent.js"
  }
}
```

### Usage

1. Place your SVG files in the `public/images` directory
2. Run the conversion script:
```bash
npm run svg
```

The script will:
- Convert all SVG files to React components
- Create components in `components/ui/icons`
- Automatically generate/update the barrel file (index.ts)
- Delete the original SVG files after successful conversion
- Show progress and results in the console

### Example

Let's say you have this SVG file `dollar.svg`:
```svg
<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 3.33337V36.6667" stroke="#F8F8F8" stroke-width="2.5" stroke-linecap="round"/>
</svg>
```

After running the script, it will:

1. Create `Dollar.tsx`:
```tsx
interface DollarProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export const Dollar = ({ 
  className = "", 
  width = "40",
  height = "40"
}: DollarProps) => {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 40 40" fill="none">
      <path d="M20 3.33337V36.6667" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
};
```

2. Update `index.ts` automatically:
```tsx
export { Dollar } from './Dollar';
// ... other exports will be added automatically as you convert more SVGs
```

### Using the Converted Components

Simply import from the automatically generated barrel file:
```tsx
import { Dollar } from '@/components/ui/icons';

// Basic usage
<Dollar />

// With custom size
<Dollar width={32} height={32} />

// With color
<Dollar className="text-blue-500" />

// With hover effect
<Dollar className="text-gray-400 hover:text-blue-500 transition-colors" />
```

### Features

- ✨ Automatic conversion of SVG files to TypeScript components
- 🎨 Support for dynamic colors via currentColor
- 📏 Configurable dimensions through props
- 🧩 TypeScript interfaces for proper typing
- 🧹 Automatic cleanup of original SVG files
- 📦 Automatic barrel file (index.ts) generation and updates
- 🔄 Automatic conversion of kebab-case attributes to camelCase

### Best Practices

1. Use meaningful names for your SVG files
2. Keep your SVGs optimized (you can use tools like SVGO)
3. Use consistent dimensions in your SVGs when possible
4. Leverage Tailwind classes for styling when possible

### Troubleshooting

If you encounter issues:
1. Check that your SVG files are properly formatted
2. Ensure the SVGs are in the correct directory (`public/images`)
3. Check the console output for specific error messages
4. Verify that the SVG doesn't contain unsupported features

For more information, check the [CHANGELOG.md](./CHANGELOG.md) file.
