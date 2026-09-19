import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Caprasimo, Figtree, Archivo } from "next/font/google";
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

// Tema "Taller" (19-sep-2026) — solo el heading necesita fuente nueva;
// el body reusa --font-plex-sans (ya cargada arriba para Faena). Un solo
// peso (700): --font-ds-heading-weight es lo que decide si se usa acá o
// en Caprasimo (ver packages/design-tokens/src/build.ts).
const archivo = Archivo({
  variable: "--font-archivo",
  weight: "700",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bitácora",
  description: "Gestión para pymes de servicio en terreno.",
};

// Modo Nocturno (18-sep-2026): sin data-theme = automático por
// prefers-color-scheme (tokens.css). Un valor guardado en localStorage
// (ThemeToggle, en Configuración > Cuenta) le gana al sistema en los dos
// sentidos — se aplica ANTES del primer paint con este script inline
// (patrón oficial de Next: docs/01-app/02-guides/preventing-flash-
// before-hydration.md § Themes), no con un useEffect que se ve tarde.
const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem("bitacora:tema");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable} ${caprasimo.variable} ${figtree.variable} ${archivo.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
