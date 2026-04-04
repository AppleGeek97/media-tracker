import { useEffect, useRef, useState } from 'react'

interface AnsiCell {
  fg: string
  bg: string
}

interface Props {
  src: string
  // width in characters; each char = 1px wide, 2px tall (half-block ▄ technique)
  width?: number
  height?: number
  className?: string
}

export function AnsiArt({ src, width = 32, height = 24, className = '' }: Props) {
  const [rows, setRows] = useState<AnsiCell[][]>([])
  const [loading, setLoading] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    setLoading(true)
    setRows([])

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!

      canvas.width = width
      canvas.height = height * 2  // 2 source pixels per displayed row
      ctx.drawImage(img, 0, 0, width, height * 2)

      let imageData: ImageData
      try {
        imageData = ctx.getImageData(0, 0, width, height * 2)
      } catch {
        // Canvas tainted by cross-origin image (CORS not supported by source)
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

      setRows(result)
      setLoading(false)
    }

    img.onerror = () => setLoading(false)
    img.src = src
  }, [src, width, height])

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
      ) : rows.length === 0 ? null : (
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
          {rows.map((row, ri) => (
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
      )}
    </div>
  )
}
