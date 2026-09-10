import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Caprasimo, Figtree } from "next/font/google";
import "./globals.css";

// Faena (en migración) — se quitan cuando ninguna pantalla use --font-sans/mono.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

// Sistema nuevo. Caprasimo: display, peso único (titulares + CTA grandes).
// Figtree: toda la UI. Ambas self-hosted por next/font, con display: swap.
// tokens.css referencia --font-caprasimo / --font-figtree.
const caprasimo = Caprasimo({
  variable: "--font-caprasimo",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const figtree = Figtree({
  variable: "--font-figtree",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bitácora",
  description: "Gestión para pymes de servicio en terreno.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${plexSans.variable} ${plexMono.variable} ${caprasimo.variable} ${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
