import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'A3 Core Example',
  description: 'Example application for @genui-a3/core',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
