import type { Metadata } from "next";
import { Orbitron, Press_Start_2P, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-primary",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const pressStart2P = Press_Start_2P({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: "400",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Aventra - Generador de Historias Interactivas con IA",
  description: "Crea historias interactivas generadas por IA con memoria persistente y un mundo coherente. Toma decisiones que ramifican la historia en tiempo real.",
  keywords: "IA, historias interactivas, juego narrativo, RPG, aventura, inteligencia artificial",
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${orbitron.variable} ${pressStart2P.variable} ${jetBrainsMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
