import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Chef Code Ramsay',
  description: 'Brutally honest AI code reviews powered by Claude',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        background: '#ffffff',
        color: '#1a1a1a',
      }}>
        {children}
      </body>
    </html>
  )
}
