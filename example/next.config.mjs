import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'

// Prioritize .env file over system environment variables
dotenv.config({ path: '.env', override: true })

// Check if we are running in the GenUI A3 monorepo
const isMonorepo = fs.existsSync(path.join(import.meta.dirname, '..', 'a3.code-workspace'))

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: isMonorepo ? path.join(import.meta.dirname, '..') : import.meta.dirname,
  },
}

export default nextConfig
