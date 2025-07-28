#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const readline = require("readline");

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Questions
const questions = [
  'Component name (PascalCase, e.g., "PrimaryButton"): ',
  "Component type (atom/molecule/organism/template): ",
  "Generate Storybook file? (y/n): ",
  "Generate test file? (y/n): ",
];

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function generateComponent() {
  try {
    const [componentName, componentType, needsStorybook, needsTest] =
      await Promise.all(questions.map(askQuestion));

    // Validation
    if (!/^[A-Z][a-zA-Z]*$/.test(componentName)) {
      throw new Error("Component name must be PascalCase");
    }

    const validTypes = ["atom", "molecule", "organism", "template"];
    if (!validTypes.includes(componentType)) {
      throw new Error(
        `Component type must be one of: ${validTypes.join(", ")}`
      );
    }

    // Create paths
    const componentsDir = path.join(process.cwd(), "src", "components");
    const componentDir = path.join(
      componentsDir,
      `${componentType}s`,
      componentName
    );

    // Create directory
    await mkdir(componentDir, { recursive: true });

    // Files to generate
    const files = [
      {
        name: "index.ts",
        content: `export { ${componentName} } from './${componentName}';\n`,
      },
      {
        name: `${componentName}.tsx`,
        content:
          `import type { FC } from 'react';\n\n` +
          `interface ${componentName}Props {\n` +
          `  children?: React.ReactNode;\n` +
          `  className?: string;\n}\n\n` +
          `export const ${componentName}: FC<${componentName}Props> = ({\n` +
          `  children,\n` +
          `  className\n}) => {\n` +
          `  return (\n` +
          `    <div className={className}>\n` +
          `      {children}\n` +
          `    </div>\n` +
          `  );\n};\n`,
      },
      {
        name: `${componentName}.types.ts`,
        content:
          `export interface ${componentName}Props {\n` +
          `  children?: React.ReactNode;\n` +
          `  className?: string;\n}\n`,
      },
    ];

    // Optional files
    if (needsStorybook.toLowerCase() === "y") {
      files.push({
        name: `${componentName}.stories.tsx`,
        content:
          `import type { Meta, StoryObj } from '@storybook/react';\n` +
          `import { ${componentName} } from './${componentName}';\n\n` +
          `const meta: Meta<typeof ${componentName}> = {\n` +
          `  title: '${componentType}s/${componentName}',\n` +
          `  component: ${componentName},\n};\n\n` +
          `export default meta;\n\n` +
          `type Story = StoryObj<typeof ${componentName}>;\n\n` +
          `export const Primary: Story = {\n` +
          `  args: {\n` +
          `    children: '${componentName}',\n` +
          `  },\n};\n`,
      });
    }

    if (needsTest.toLowerCase() === "y") {
      files.push({
        name: `${componentName}.test.tsx`,
        content:
          `import { render, screen } from '@testing-library/react';\n` +
          `import { ${componentName} } from './${componentName}';\n\n` +
          `describe('${componentName}', () => {\n` +
          `  it('renders children', () => {\n` +
          `    render(<${componentName}>Test</${componentName}>);\n` +
          `    expect(screen.getByText('Test')).toBeInTheDocument();\n` +
          `  });\n` +
          `});\n`,
      });
    }

    // Write files
    await Promise.all(
      files.map((file) =>
        writeFile(path.join(componentDir, file.name), file.content)
      )
    );

    console.log(
      `\n✅ Successfully created ${componentName} component in ${componentType}s/${componentName}`
    );
    console.log(
      `Generated files:\n${files.map((f) => `- ${f.name}`).join("\n")}`
    );
  } catch (error) {
    console.error("\n❌ Error generating component:", error.message);
  } finally {
    rl.close();
  }
}

generateComponent();
