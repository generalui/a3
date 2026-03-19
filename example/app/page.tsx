import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Box, Container } from '@mui/material'
import { MarkdownRenderer } from '@atoms'

export default function Home() {
  const readme = readFileSync(join(process.cwd(), 'docs/A3-README.md'), 'utf-8')

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ px: { xs: 1, sm: 2 } }}>
        <MarkdownRenderer content={readme} />
      </Box>
    </Container>
  )
}
