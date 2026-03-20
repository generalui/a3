import { PROVIDER_META, providerDocName } from '@create-utils/providers'

// ── PROVIDER_META ─────────────────────────────────────────────────────────────

describe('PROVIDER_META', () => {
  it('has at least one provider entry', () => {
    expect(Object.keys(PROVIDER_META).length).toBeGreaterThan(0)
  })

  it('has unique file names across all providers', () => {
    const files = Object.values(PROVIDER_META).map((m) => m.file)
    expect(new Set(files).size).toBe(files.length)
  })

  it('has unique npm package names across all providers', () => {
    const packages = Object.values(PROVIDER_META).map((m) => m.npmPackage)
    expect(new Set(packages).size).toBe(packages.length)
  })

  it('has unique export names across all providers', () => {
    const exportNames = Object.values(PROVIDER_META).map((m) => m.exportName)
    expect(new Set(exportNames).size).toBe(exportNames.length)
  })

  describe.each(Object.entries(PROVIDER_META))('%s', (key, meta) => {
    it('has a non-empty label', () => {
      expect(meta.label).toMatch(/\S/)
    })

    it('has a non-empty exportName', () => {
      expect(meta.exportName).toMatch(/\S/)
    })

    it('has a file name ending in .ts', () => {
      expect(meta.file).toMatch(/\.ts$/)
    })

    it('has a scoped npm package name', () => {
      expect(meta.npmPackage).toMatch(/^@/)
    })
  })
})

// ── providerDocName ───────────────────────────────────────────────────────────

describe('providerDocName', () => {
  it.each(Object.keys(PROVIDER_META))('returns correct doc name for key "%s"', (key) => {
    expect(providerDocName(key)).toBe(`PROVIDER-${key.toUpperCase()}.md`)
  })

  it('uppercases an arbitrary key not in PROVIDER_META', () => {
    expect(providerDocName('myProvider')).toBe('PROVIDER-MYPROVIDER.md')
  })
})
