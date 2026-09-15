import type { Metadata, Viewport } from "next";
import { Pixelify_Sans, Press_Start_2P, Spectral } from "next/font/google";
import "./globals.css";

const pixel = Press_Start_2P({ variable: "--font-pixel", subsets: ["latin"], weight: "400" });
const ui = Pixelify_Sans({ variable: "--font-ui", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const story = Spectral({ variable: "--font-story", subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Aventra — Rol narrativo con IA",
  description:
    "Un juego de rol narrativo donde una IA dirige la partida: dados d20 reales, memoria vectorial, estado del mundo con JSON Patch e ilustraciones de escena. Todo corre en tu navegador.",
  keywords: ["IA", "rol", "historias interactivas", "RPG", "OpenAI", "juego narrativo"],
  openGraph: {
    title: "Aventra — Rol narrativo con IA",
    description: "Dados reales, memoria a largo plazo y un mundo que recuerda tus decisiones.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0911",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${pixel.variable} ${ui.variable} ${story.variable}`}>
        <div id="app-root">{children}</div>
      </body>
    </html>
  );
}
