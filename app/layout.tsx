import type React from "react"
import type { Metadata, Viewport } from "next" 
import { Outfit } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import AuthListener  from "@/components/auth-listener" 
import SecurityGuard from "@/components/security-guard"
import RealTimeListener from "@/components/real-time-listener"
import "./globals.css"

const outfit = Outfit({ 
  subsets: ["latin"], 
  variable: "--font-outfit",
  weight: ["300","400","500","600","700","800"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: 'Recorrido Escolar',
    template: '%s | Recorrido Escolar',
  },
  description: "Aplicación para la gestión de gastos de un recorrido escolar",
  manifest: "/manifest.json", 
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: "#151355",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`${outfit.variable} font-sans antialiased`}>
        
        {/* Componentes invisibles de lógica global */}
        <SecurityGuard />
        <AuthListener />
        <RealTimeListener />
        
        {/* Contenido de la página */}
        {children}
        
        {/* Utilidades visuales */}
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}