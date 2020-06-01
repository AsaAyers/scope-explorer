import * as chroma from "chroma-js"

export type Color = string

export function scrambleColors<T>(colors: readonly T[]): T[] {
  const sourceColors: Array<T | null> = [...colors]
  const step = 7
  let found = 0
  let index = 0

  const colorOutput = []
  while (found < sourceColors.length) {
    index = (index + step + sourceColors.length) % sourceColors.length

    if (sourceColors[index]) {
      found++
      colorOutput.push(sourceColors[index])
      sourceColors[index] = null
    }
  }
  return colorOutput.filter(function notEmpty(c): c is T {
    return c != null
  })
}

export default function generateColors(
  backgroundColor: string,
  diversity: number,
): Color[] {
  const colors: Color[] = []
  const saturation = 0.9
  const luminosity = 0.5
  const fade = 0.4
  for (let i = 0; i < diversity; i++) {
    const hue = i * (360 / diversity)
    const color = chroma.hsl(hue, saturation, luminosity)
    // color: contrast(@syntax-background-color, tint(@color, @fade), shade(@color, @fade)) !important;
    // chroma.contrast(backgroundColor, color.tint(fade));
    const shade = chroma.scale([color, "black"])
    const tint = chroma.scale([color, "white"])
    if (
      chroma.contrast(backgroundColor, shade(fade)) >
      chroma.contrast(backgroundColor, tint(fade))
    ) {
      colors.push(shade(fade).hex())
    } else {
      colors.push(tint(fade).hex())
    }
  }

  return scrambleColors(colors)
}
