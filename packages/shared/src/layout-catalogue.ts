import catalogue from './layout-catalogue.json'
export const layoutCatalogue = catalogue
export type LayoutChoice = typeof layoutCatalogue[number]
export const isLayoutId = (value: string) => layoutCatalogue.some(layout => layout.id === value)

// Limit new projects while retaining the full catalogue for existing websites.
export const selectableLayouts = layoutCatalogue.filter(layout => layout.id === 'finbiz-1')
export const isSelectableLayoutId = (value: string) => selectableLayouts.some(layout => layout.id === value)
