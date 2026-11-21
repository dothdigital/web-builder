import catalogue from './layout-catalogue.json'
export const layoutCatalogue = catalogue
export type LayoutChoice = typeof layoutCatalogue[number]
export const isLayoutId = (value: string) => layoutCatalogue.some(layout => layout.id === value)

export const selectableLayouts = layoutCatalogue
export const isSelectableLayoutId = (value: string) => selectableLayouts.some(layout => layout.id === value)
