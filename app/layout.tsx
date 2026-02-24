import type { Metadata } from 'next'
import { DM_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'LBS GenAI Chatbot',
  description: 'LBS Buddy - MAM Teaching Assistant powered by Claude',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body style={{
        fontFamily: 'var(--font-dm-sans), sans-serif',
        background: '#ffffff',
        color: '#1a1a1a',
      }}>
        {children}
      </body>
    </html>
  )
}
