import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StellarLend - Lending on Stellar",
    short_name: "StellarLend",
    display: "standalone",
    theme_color: "#5eead4",
    background_color: "#070b14",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
