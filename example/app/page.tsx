'use client'

import { Chat } from '@organisms/Chat'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">A3 Example</h1>
      </header>
      <div className="flex flex-1 min-h-0 p-6">
        <div className="w-full max-w-2xl mx-auto h-[600px]">
          <Chat />
        </div>
      </div>
    </main>
  )
}
