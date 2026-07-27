// stories/Foundations.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import designTokens, {
  colorGreen,
  colorNeutral,
  colorSemantic,
  colorSurface,
  colorText,
  colorBorder,
  borderRadius,
  boxShadow,
  fontSize,
  fontWeight,
} from "../constants/design-tokens";

// ── helpers ────────────────────────────────────────────────────────────────

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 6,
          background: value,
          border: "1px solid rgba(255,255,255,0.1)",
          flexShrink: 0,
        }}
      />
      <div>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
        <div style={{ fontSize: 12, opacity: 0.6, fontFamily: "monospace" }}>{value}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          paddingBottom: 8,
          marginBottom: 16,
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

// ── story component ─────────────────────────────────────────────────────────

function FoundationsPage() {
  return (
    <div
      style={{
        background: "#0A3D1E",
        color: "#fff",
        padding: 40,
        fontFamily: "Inter, sans-serif",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
        🎨 StellarLend Design Foundations
      </h1>
      <p style={{ opacity: 0.6, marginBottom: 40 }}>
        Single source of truth — <code>constants/design-tokens.ts</code>
      </p>

      {/* GREEN RAMP */}
      <Section title="Color — Green Ramp">
        {Object.entries(colorGreen).map(([shade, value]) => (
          <Swatch key={shade} name={`green-${shade}`} value={value} />
        ))}
      </Section>

      {/* NEUTRAL */}
      <Section title="Color — Neutral">
        {Object.entries(colorNeutral).map(([shade, value]) => (
          <Swatch key={shade} name={`neutral-${shade}`} value={value} />
        ))}
      </Section>

      {/* SEMANTIC */}
      <Section title="Color — Semantic / Feedback">
        {Object.entries(colorSemantic).map(([name, value]) => (
          <Swatch key={name} name={name} value={value} />
        ))}
      </Section>

      {/* SURFACE */}
      <Section title="Color — Surface">
        {Object.entries(colorSurface).map(([name, value]) => (
          <Swatch key={name} name={`surface-${name}`} value={value} />
        ))}
      </Section>

      {/* TEXT */}
      <Section title="Color — Text">
        {Object.entries(colorText).map(([name, value]) => (
          <Swatch key={name} name={`text-${name}`} value={value} />
        ))}
      </Section>

      {/* BORDER */}
      <Section title="Color — Border">
        {Object.entries(colorBorder).map(([name, value]) => (
          <Swatch key={name} name={`border-${name}`} value={value} />
        ))}
      </Section>

      {/* RADIUS */}
      <Section title="Border Radius">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          {Object.entries(borderRadius).map(([name, value]) => (
            <div key={name} style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  background: "#097C4C",
                  borderRadius: value,
                  marginBottom: 6,
                }}
              />
              <div style={{ fontSize: 11 }}>
                <strong>{name}</strong>
                <br />
                <span style={{ opacity: 0.6, fontFamily: "monospace" }}>{value}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* SHADOWS */}
      <Section title="Box Shadow">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          {Object.entries(boxShadow)
            .filter(([n]) => n !== "none")
            .map(([name, value]) => (
              <div key={name} style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: 80,
                    height: 80,
                    background: "#0D4F27",
                    boxShadow: value,
                    borderRadius: 8,
                    marginBottom: 6,
                  }}
                />
                <div style={{ fontSize: 11 }}>
                  <strong>shadow-{name}</strong>
                </div>
              </div>
            ))}
        </div>
      </Section>

      {/* TYPOGRAPHY */}
      <Section title="Font Size">
        {Object.entries(fontSize).map(([name, [size]]) => (
          <div
            key={name}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 16,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                width: 60,
                fontSize: 12,
                opacity: 0.6,
                fontFamily: "monospace",
              }}
            >
              {name}
            </span>
            <span style={{ fontSize: size }}>StellarLend</span>
            <span style={{ fontSize: 11, opacity: 0.4, fontFamily: "monospace" }}>
              {size}
            </span>
          </div>
        ))}
      </Section>

      <Section title="Font Weight">
        {Object.entries(fontWeight).map(([name, weight]) => (
          <div key={name} style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 8 }}>
            <span style={{ width: 80, fontSize: 12, opacity: 0.6, fontFamily: "monospace" }}>
              {name}
            </span>
            <span style={{ fontSize: 18, fontWeight: Number(weight) }}>StellarLend DeFi</span>
            <span style={{ fontSize: 11, opacity: 0.4, fontFamily: "monospace" }}>{weight}</span>
          </div>
        ))}
      </Section>
    </div>
  );
}

// ── Storybook meta ──────────────────────────────────────────────────────────

const meta: Meta = {
  title: "Foundations/Design Tokens",
  component: FoundationsPage,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "All design tokens defined in `constants/design-tokens.ts`. " +
          "These are the single source of truth for colors, typography, radii, and shadows.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const AllTokens: Story = {};