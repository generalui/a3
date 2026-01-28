'use client'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8 text-center">A3 Core Framework Example</h1>
        <p className="text-center text-lg mb-4">
          This is a Next.js example application demonstrating the @genui-a3/core package.
        </p>
        <div className="mt-8 p-4 border rounded-lg">
          <p className="text-sm text-gray-600">Install the core package and register your agents to get started.</p>
        </div>
      </div>
    </main>
  )
}
