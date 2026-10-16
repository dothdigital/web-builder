import assert from 'node:assert/strict'
import sharp from 'sharp'
import { extractLogoColors } from '@awb/shared'
import { paletteFromLogoColors, hexToHsl, paletteAlternatives } from '@awb/ai'
import { defaultTokens } from '@awb/component-registry'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="600" height="400" fill="#01481c"/><rect x="600" width="200" height="400" fill="#f8b800"/><rect width="200" height="400" fill="#01571c"/></svg>`
const colors = await extractLogoColors(await sharp(Buffer.from(svg)).png().toBuffer())
const hues = colors.map(color => hexToHsl(color.hex).h)
assert.ok(hues.some(hue => hue > 100 && hue < 160), 'Green detected')
assert.ok(hues.some(hue => hue > 35 && hue < 65), 'Gold detected')
assert.equal(colors.length, 2, 'Similar green shades are grouped')
const palette = paletteFromLogoColors(['#01481c', '#01571c', '#f8b800'], defaultTokens).palette
assert.equal(palette.primary, '#01481c', 'Original primary colour retained')
assert.equal(palette.accent, '#f8b800', 'Accent is the distinct gold rather than a second green')
for (const fill of ['#ffffff', '#000000']) {
  const bytes = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="${fill}"/></svg>`)).png().toBuffer()
  assert.equal((await extractLogoColors(bytes))[0]?.hex, fill, 'Monochrome logos still produce a palette')
}
const empty = await sharp({ create: { width: 40, height: 40, channels: 4, background: '#00000000' } }).png().toBuffer()
assert.deepEqual(await extractLogoColors(empty), [])
assert.ok(paletteAlternatives(defaultTokens, []).length > 0)
console.log('PASS: distinct logo hues, gradient grouping, original brand colours, monochrome and transparent logo handling.')
