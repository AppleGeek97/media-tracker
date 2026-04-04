import { useEffect, useRef, useState } from 'react'

// Characters ordered dark → light (suits dark background)
const ASCII_RAMP = ' .\'`^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'

interface AnsiCell {
  fg: string
  bg: string
}

interface Props {
  src: string
  mode?: 'ansi' | 'ascii'
  // width in characters; for ansi each char = 2px tall (half-block), for ascii = 1px tall
  width?: number
  height?: number
  className?: string
}

export function AnsiArt({ src, mode = 'ansi', width = 28, height = 26, className = '' }: Props) {
  const [ansiRows, setAnsiRows] = useState<AnsiCell[][]>([])
  const [asciiRows, setAsciiRows] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    setLoading(true)
    setAnsiRows([])
    setAsciiRows([])

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!

      if (mode === 'ansi') {
        canvas.width = width
        canvas.height = height * 2
        ctx.drawImage(img, 0, 0, width, height * 2)

        let imageData: ImageData
        try {
          imageData = ctx.getImageData(0, 0, width, height * 2)
        } catch {
          setLoading(false)
          return
        }
        const { data } = imageData

        const result: AnsiCell[][] = []
        for (let row = 0; row < height; row++) {
          const cols: AnsiCell[] = []
          for (let col = 0; col < width; col++) {
            const ti = ((row * 2) * width + col) * 4
            const bi = ((row * 2 + 1) * width + col) * 4
            cols.push({
              fg: `rgb(${data[ti]},${data[ti + 1]},${data[ti + 2]})`,
              bg: `rgb(${data[bi]},${data[bi + 1]},${data[bi + 2]})`,
            })
          }
          result.push(cols)
        }
        setAnsiRows(result)

      } else {
        // ASCII: monochrome, chars mapped to brightness
        // Monospace chars are ~0.6:1 w:h, so sample at half height to keep proportions
        const pw = width
        const ph = Math.round(height * 0.55)
        canvas.width = pw
        canvas.height = ph
        ctx.drawImage(img, 0, 0, pw, ph)

        let imageData: ImageData
        try {
          imageData = ctx.getImageData(0, 0, pw, ph)
        } catch {
          setLoading(false)
          return
        }
        const { data } = imageData

        const rows: string[] = []
        for (let row = 0; row < ph; row++) {
          let line = ''
          for (let col = 0; col < pw; col++) {
            const i = (row * pw + col) * 4
            const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
            const charIdx = Math.floor(brightness / 255 * (ASCII_RAMP.length - 1))
            line += ASCII_RAMP[charIdx]
          }
          rows.push(line)
        }
        setAsciiRows(rows)
      }

      setLoading(false)
    }

    img.onerror = () => setLoading(false)
    img.src = src
  }, [src, mode, width, height])

  const isEmpty = mode === 'ansi' ? ansiRows.length === 0 : asciiRows.length === 0

  return (
    <div className={className}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {loading ? (
        <div
          style={{ width: width * 5, height: height * 7 }}
          className="flex items-center justify-center text-dim text-xs"
        >
          loading...
        </div>
      ) : isEmpty ? null : mode === 'ansi' ? (
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: '7px',
            lineHeight: '7px',
            letterSpacing: 0,
            userSelect: 'none',
            display: 'inline-block',
          }}
        >
          {ansiRows.map((row, ri) => (
            <div key={ri} style={{ display: 'flex' }}>
              {row.map((cell, ci) => (
                <span
                  key={ci}
                  style={{
                    color: cell.fg,
                    backgroundColor: cell.bg,
                    display: 'inline-block',
                    width: '1ch',
                    lineHeight: '7px',
                    flexShrink: 0,
                  }}
                >
                  ▄
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <pre
          style={{
            fontFamily: 'monospace',
            fontSize: '7px',
            lineHeight: '8px',
            letterSpacing: '0.5px',
            userSelect: 'none',
            margin: 0,
            whiteSpace: 'pre',
          }}
        >
          {asciiRows.join('\n')}
        </pre>
      )}
    </div>
  )
}
