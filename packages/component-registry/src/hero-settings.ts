export function normalizeHeroSettings(values: Record<string, unknown>): Record<string, unknown> {
  if (values.imageLayout === 'background') return { ...values, sectionBackgroundMode: 'original' }
  if (values.sectionBackgroundMode !== 'image') return values
  return {
    ...values, imageLayout: 'background', sectionBackgroundMode: 'original',
    ...(values.sectionBackgroundImageUrl ? {
      imageUrl: values.sectionBackgroundImageUrl, imageAlt: '',
      overlayColor: values.sectionBackgroundColor, overlayOpacity: values.sectionBackgroundOpacity,
      imageOpacity: values.sectionBackgroundImageOpacity, imagePosition: values.sectionBackgroundPosition,
      imageBlend: values.sectionBackgroundBlend, overlayStyle: values.sectionBackgroundTreatment,
      textColor: values.sectionBackgroundTextColor,
    } : {}),
  }
}
