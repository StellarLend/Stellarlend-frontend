const fs = require("fs");
const path = require("path");

// Function to convert filename to PascalCase
const toPascalCase = (str) => {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
};

// Function to convert kebab-case to camelCase
const toCamelCase = (str) => {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
};

// Function to convert SVG attributes to React format
const convertSvgAttributes = (svgContent) => {
  // List of SVG attributes that need to be converted
  const attributes = [
    "strokeWidth",
    "strokeLinecap",
    "strokeLinejoin",
    "fillRule",
    "clipRule",
    "stroke-miterlimit",
    "stroke-dasharray",
    "stroke-opacity",
    "fill-opacity",
  ];

  let result = svgContent;

  // Convert each attribute to camelCase
  attributes.forEach((attr) => {
    const regex = new RegExp(`${attr}="([^"]*)"`, "g");
    result = result.replace(regex, (match, value) => {
      return `${toCamelCase(attr)}="${value}"`;
    });
  });

  return result;
};

// Function to process SVG content
const processSvgContent = (content, fileName) => {
  // Remove XML declarations and comments
  content = content.replace(/<\?xml.*?\?>/, "");
  content = content.replace(/<!--.*?-->/g, "");

  // Extract SVG content
  const svgMatch = content.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  if (!svgMatch) return null;

  let svgContent = svgMatch[0];

  // Ensure SVG has fill="none" and stroke="currentColor"
  svgContent = svgContent.replace(/fill="[^"]*"/g, 'fill="none"');
  svgContent = svgContent.replace(/stroke="[^"]*"/g, 'stroke="currentColor"');

  // Add fill attribute if not present
  if (!svgContent.includes("fill=")) {
    svgContent = svgContent.replace("<svg", '<svg fill="none"');
  }

  // Convert attributes to camelCase
  svgContent = convertSvgAttributes(svgContent);

  // Extract SVG attributes
  const widthMatch = svgContent.match(/width="([^"]*)"/);
  const heightMatch = svgContent.match(/height="([^"]*)"/);
  const viewBoxMatch = svgContent.match(/viewBox="([^"]*)"/);

  const width = widthMatch ? widthMatch[1] : "24";
  const height = heightMatch ? heightMatch[1] : "24";
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 24 24";

  const componentName = toPascalCase(path.parse(fileName).name);

  // Create React component
  return `interface ${componentName}Props {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export const ${componentName} = ({ 
  className = "", 
  width = "${width}",
  height = "${height}"
}: ${componentName}Props) => {
  return (
    ${svgContent
      .replace("<svg", "<svg className={className}")
      .replace(/width="([^"]*)"/, "width={width}")
      .replace(/height="([^"]*)"/, "height={height}")}
  );
};`;
};

// Function to delete SVG file
const deleteSvgFile = (filePath) => {
  try {
    fs.unlinkSync(filePath);
    console.log(`🗑️  Deleted original SVG file: ${path.basename(filePath)}`);
    return true;
  } catch (error) {
    console.error(
      `❌ Failed to delete SVG file ${path.basename(filePath)}:`,
      error.message
    );
    return false;
  }
};

// Function to update or create barrel file
const updateBarrelFile = (componentDir, componentNames) => {
  const barrelPath = path.join(componentDir, "index.ts");
  const exports = componentNames
    .sort() // Sort alphabetically
    .map((name) => `export { ${name} } from './${name}';`)
    .join("\n");

  try {
    fs.writeFileSync(barrelPath, exports + "\n");
    console.log("📦 Updated barrel file (index.ts)");
    return true;
  } catch (error) {
    console.error("❌ Failed to update barrel file:", error.message);
    return false;
  }
};

// Main function to convert SVGs
const convertSvgsToComponents = () => {
  const svgDir = path.join(process.cwd(), "public", "images");
  const componentDir = path.join(process.cwd(), "components", "ui", "icons");
  const convertedComponents = [];

  // Create components directory if it doesn't exist
  if (!fs.existsSync(componentDir)) {
    fs.mkdirSync(componentDir, { recursive: true });
  }

  // Read all SVG files
  fs.readdirSync(svgDir)
    .filter((file) => file.endsWith(".svg"))
    .forEach((fileName) => {
      const filePath = path.join(svgDir, fileName);
      const componentName = toPascalCase(path.parse(fileName).name);
      const componentPath = path.join(componentDir, `${componentName}.tsx`);

      try {
        // Read SVG content
        const svgContent = fs.readFileSync(filePath, "utf8");
        const componentContent = processSvgContent(svgContent, fileName);

        if (componentContent) {
          // Write the component
          fs.writeFileSync(componentPath, componentContent);
          console.log(`✅ Converted ${fileName} to ${componentName}.tsx`);

          // Add component name to the list
          convertedComponents.push(componentName);

          // Delete original SVG file only if conversion was successful
          deleteSvgFile(filePath);
        } else {
          console.error(
            `❌ Failed to convert ${fileName}: Invalid SVG content`
          );
        }
      } catch (error) {
        console.error(`❌ Error processing ${fileName}:`, error.message);
      }
    });

  // Update barrel file with all components
  if (convertedComponents.length > 0) {
    updateBarrelFile(componentDir, convertedComponents);
  }

  console.log(
    "\n✨ Conversion completed! Check the components/ui/icons directory for the results."
  );
};

// Run the conversion
convertSvgsToComponents();
