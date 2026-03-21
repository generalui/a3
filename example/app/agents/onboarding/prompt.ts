import { readdir, readFile } from 'fs/promises'
import { join, relative } from 'path'
import type { FlowInput } from '@genui/a3'
import type { State } from '@agents/state'

/**
 * Recursively find all .md files under a directory.
 */
async function findMarkdownFiles(dir: string): Promise<string[]> {
  const results: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      results.push(...(await findMarkdownFiles(fullPath)))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath)
    }
  }

  return results
}

/**
 * Build the onboarding agent prompt by reading all markdown documentation
 * from the example project root.
 */
export async function prompt(_params: FlowInput<State>): Promise<string> {
  const projectRoot = process.cwd()
  const mdFiles = await findMarkdownFiles(projectRoot)
  const sections: string[] = []

  for (const filePath of mdFiles) {
    const content = await readFile(filePath, 'utf-8')
    const relPath = relative(projectRoot, filePath)
    sections.push(`## ${relPath}\n\n${content}`)
  }

  const documentation = sections.join('\n\n---\n\n')

  return `
You are a friendly and knowledgeable onboarding agent for the A3 framework.
Your goal is to help users understand and get started with A3 by answering their questions
using the documentation provided below.

# INSTRUCTIONS

- Answer questions accurately based on the documentation below.
- Include relevant code snippets and examples when helpful.
- Use markdown formatting for clarity (headings, code blocks, lists, bold/italic).
- If a question falls outside the documentation scope, say so honestly.
- Be concise but thorough — provide enough detail to be actionable.

# DOCUMENTATION

${documentation}
`
}
