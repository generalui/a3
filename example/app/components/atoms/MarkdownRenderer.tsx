'use client'

import { styled, useTheme } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { REPO_URL } from '@constants/paths'

const MarkdownRoot = styled('div')(({ theme }) => ({
  '& > *:first-of-type': { marginTop: 0 },
  '& > *:last-child': { marginBottom: 0 },
  '& ul, & ol': {
    paddingLeft: theme.spacing(3),
    marginTop: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
  },
  '& li': {
    marginBottom: theme.spacing(0.25),
  },
  '& blockquote': {
    margin: theme.spacing(1, 0),
    padding: theme.spacing(0.5, 2),
    borderLeft: `4px solid ${theme.palette.primary.main}`,
    backgroundColor: theme.palette.action.hover,
  },
}))

function useMarkdownComponents(): Components {
  const theme = useTheme()

  return {
    p: ({ children }) => (
      <Typography variant="body2" sx={{ my: 0.5 }}>
        {children}
      </Typography>
    ),
    h1: ({ children }) => (
      <Typography variant="h5" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
        {children}
      </Typography>
    ),
    h2: ({ children }) => (
      <Typography variant="h6" sx={{ mt: 1.5, mb: 0.75, fontWeight: 600 }}>
        {children}
      </Typography>
    ),
    h3: ({ children }) => (
      <Typography variant="subtitle1" sx={{ mt: 1.5, mb: 0.5, fontWeight: 600 }}>
        {children}
      </Typography>
    ),
    h4: ({ children }) => (
      <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5, fontWeight: 600 }}>
        {children}
      </Typography>
    ),
    h5: ({ children }) => (
      <Typography variant="body1" sx={{ mt: 1, mb: 0.5, fontWeight: 600 }}>
        {children}
      </Typography>
    ),
    h6: ({ children }) => (
      <Typography variant="body2" sx={{ mt: 1, mb: 0.5, fontWeight: 600 }}>
        {children}
      </Typography>
    ),
    a: ({ href, children }) => {
      const resolvedHref = href?.match(/^\.?\/?docs\/.*\.md$/) ? `${REPO_URL}/${href.replace(/^\.\//, '')}` : href

      return (
        <Link href={resolvedHref} target="_blank" rel="noopener noreferrer">
          {children}
        </Link>
      )
    },
    code: ({ className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '')
      const codeString = String(children as string).replace(/\n$/, '')
      const isBlock = !!match || codeString.includes('\n')

      if (isBlock) {
        return (
          <SyntaxHighlighter
            style={oneLight}
            language={match?.[1] || 'text'}
            PreTag="div"
            customStyle={{
              margin: theme.spacing(1, 0),
              borderRadius: theme.shape.borderRadius,
              fontSize: '0.8125rem',
            }}
          >
            {codeString}
          </SyntaxHighlighter>
        )
      }

      return (
        <code
          style={{
            backgroundColor: theme.palette.action.hover,
            padding: '2px 6px',
            borderRadius: theme.shape.borderRadius,
            fontSize: '0.8125rem',
            fontFamily: 'monospace',
          }}
          {...props}
        >
          {children}
        </code>
      )
    },
  }
}

export function MarkdownRenderer({ content }: { content: string }) {
  const components = useMarkdownComponents()

  return (
    <MarkdownRoot>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </MarkdownRoot>
  )
}
