import type { DesignTokens } from '@awb/website-model'

export function mobileMenuColors(props: Record<string, unknown>, tokens: DesignTokens) {
  const candidate = props.sectionBackgroundMode === 'colour' || props.sectionBackgroundMode === 'image'
    ? props.sectionBackgroundColor : props.customBackground ? props.backgroundColor : tokens.palette.background
  const background = typeof candidate === 'string' && /^#[\da-f]{6}$/i.test(candidate) ? candidate : '#ffffff'
  const rgb = [1, 3, 5].map((offset) => parseInt(background.slice(offset, offset + 2), 16) / 255)
  const linear = rgb.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  const luminance = linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722
  const automatic = luminance > 0.179 ? '#000000' : '#ffffff'
  return { background, color: typeof props.mobileMenuIconColor === 'string' && /^#[\da-f]{6}$/i.test(props.mobileMenuIconColor) ? props.mobileMenuIconColor : automatic }
}
