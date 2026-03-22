import * as ts from 'typescript'
import * as fs from 'fs'
import * as path from 'path'

const SKIP_FILES = new Set(['state.ts', 'registry.ts', 'index.ts'])

const cached = new Map<string, Map<string, string[]>>()

/**
 * Parse agent source files to extract transition targets using TypeScript's AST.
 * Results are cached per directory for the server lifecycle.
 *
 * For array transitions, extracts string elements directly.
 * For function transitions, walks the function body to collect string literals
 * from return statements and ternary expressions, then cross-references against
 * known agent IDs to filter out non-agent strings.
 *
 * @param agentsSubDir - Subdirectory under app/agents to scan (e.g. 'helloWorld')
 * @returns Map from agent ID to transition target agent IDs
 */
export function getTransitionTargetMap(agentsSubDir: string): Map<string, string[]> {
  const existing = cached.get(agentsSubDir)
  if (existing) return existing

  const result = new Map<string, string[]>()
  cached.set(agentsSubDir, result)

  const agentsDir = path.join(process.cwd(), 'app/agents', agentsSubDir)
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(agentsDir, { withFileTypes: true })
  } catch {
    return result
  }

  const fileNames = entries
    .filter((e) => e.isFile() && e.name.endsWith('.ts') && !SKIP_FILES.has(e.name))
    .map((e) => e.name)

  // First pass: parse all files and collect agent IDs
  const fileData: { agentId: string; transitionNode: ts.Node | null }[] = []
  const allAgentIds = new Set<string>()

  for (const fileName of fileNames) {
    try {
      const source = fs.readFileSync(path.join(agentsDir, fileName), 'utf-8')
      const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)
      const info = extractAgentInfo(sf)
      if (info) {
        allAgentIds.add(info.agentId)
        fileData.push(info)
      }
    } catch {
      // Skip unparseable files
    }
  }

  // Second pass: extract transition targets and cross-reference against known IDs
  for (const { agentId, transitionNode } of fileData) {
    if (!transitionNode) continue
    const targets = extractTargets(transitionNode, allAgentIds)
    if (targets.length > 0) {
      result.set(agentId, targets)
    }
  }

  return result
}

function extractAgentInfo(
  sf: ts.SourceFile
): { agentId: string; transitionNode: ts.Node | null } | null {
  let agentId: string | null = null
  let transitionNode: ts.Node | null = null

  function visit(node: ts.Node) {
    if (ts.isObjectLiteralExpression(node)) {
      let id: string | null = null
      let transition: ts.Node | null = null

      for (const prop of node.properties) {
        if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue
        if (prop.name.text === 'id' && ts.isStringLiteral(prop.initializer)) {
          id = prop.initializer.text
        }
        if (prop.name.text === 'transition') {
          transition = prop.initializer
        }
      }

      if (id) {
        agentId = id
        transitionNode = transition
      }
    }
    ts.forEachChild(node, visit)
  }

  ts.forEachChild(sf, visit)
  return agentId ? { agentId, transitionNode } : null
}

function extractTargets(node: ts.Node, allAgentIds: Set<string>): string[] {
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements
      .filter(ts.isStringLiteral)
      .map((el) => el.text)
      .filter((text) => allAgentIds.has(text))
  }

  if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
    const strings = new Set<string>()
    if (ts.isBlock(node.body)) {
      collectReturnStrings(node.body, strings)
    } else {
      // Expression body (arrow function without braces)
      collectStringLiterals(node.body, strings)
    }
    return Array.from(strings).filter((s) => allAgentIds.has(s))
  }

  return []
}

function collectReturnStrings(node: ts.Node, strings: Set<string>) {
  if (ts.isReturnStatement(node) && node.expression) {
    collectStringLiterals(node.expression, strings)
    return
  }
  ts.forEachChild(node, (child) => collectReturnStrings(child, strings))
}

function collectStringLiterals(node: ts.Node, strings: Set<string>) {
  if (ts.isStringLiteral(node)) {
    strings.add(node.text)
    return
  }
  if (ts.isConditionalExpression(node)) {
    collectStringLiterals(node.whenTrue, strings)
    collectStringLiterals(node.whenFalse, strings)
    return
  }
  ts.forEachChild(node, (child) => collectStringLiterals(child, strings))
}
