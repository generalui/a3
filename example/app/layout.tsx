import type { Metadata } from 'next'
import { ThemeProvider } from './ThemeProvider'

export const metadata: Metadata = {
  title: 'A3 Core Example',
  description: 'Example application for @genui-a3/core',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
