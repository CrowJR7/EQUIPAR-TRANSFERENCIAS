import type { Metadata, Viewport } from 'next'
import { Inter, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
})

export const viewport: Viewport = {
  themeColor: '#031635',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'Equipar | Controle de Transferências',
  description: 'Sistema integrado de controle de transferências e auditoria de mercadorias entre lojas da rede Equipar.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Equipar',
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icon-192x192.png',
  },
  openGraph: {
    title: 'Equipar | Controle de Transferências',
    description: 'Sistema integrado de controle de transferências e auditoria de mercadorias entre lojas.',
    url: 'https://transferencias.equipar.com',
    siteName: 'Equipar Acessórios e Latarias',
    images: [
      {
        url: '/logo.png',
        width: 800,
        height: 600,
      },
    ],
    locale: 'pt_BR',
    type: 'website',
  },
}

import { Toaster } from 'react-hot-toast'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} ${hanken.variable} ${jetbrains.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body suppressHydrationWarning className="font-sans antialiased bg-background text-foreground min-h-screen">
        <Toaster position="top-right" toastOptions={{
          style: {
            background: '#18181b', // zinc-900
            color: '#fff',
            border: '1px solid #27272a', // zinc-800
          }
        }} />
        {children}
      </body>
    </html>
  )
}
