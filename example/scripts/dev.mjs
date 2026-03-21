import { exec, spawn } from 'node:child_process'

function openBrowser(url) {
  const quoted = encodeURI(url)
  const cmd =
    process.platform === 'win32'
      ? `cmd.exe /c start ${quoted}`
      : process.platform === 'darwin'
        ? `open '${quoted}'`
        : `xdg-open '${quoted}'`
  exec(cmd)
}

const child = spawn('next', ['dev'], {
  stdio: ['inherit', 'pipe', 'inherit'],
  shell: process.platform === 'win32', // required for Windows PATH resolution
})

function onData(data) {
  process.stdout.write(data)
  const match = data.toString().match(/Local:\s+(https?:\/\/localhost:\d+)/)
  if (match) {
    child.stdout.off('data', onData)

    // Do not ignore development console.log output
    child.stdout.on('data', (d) => process.stdout.write(d))

    openBrowser(match[1])
  }
}

child.stdout.on('data', onData)
child.on('exit', (code) => process.exit(code ?? 0))
