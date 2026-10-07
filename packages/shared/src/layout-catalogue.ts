import catalogue from './layout-catalogue.json'
export const layoutCatalogue = catalogue
export type LayoutChoice = typeof layoutCatalogue[number]
export const isLayoutId = (value: string) => layoutCatalogue.some(layout => layout.id === value)
