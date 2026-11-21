import catalogue from './layout-catalogue.json'
export const layoutCatalogue = catalogue
export type LayoutChoice = typeof layoutCatalogue[number]
export const isLayoutId = (value: string) => layoutCatalogue.some(layout => layout.id === value)

export const selectableLayouts = layoutCatalogue
export const isSelectableLayoutId = (value: string) => selectableLayouts.some(layout => layout.id === value)

/** Pages whose purpose is enquiries: they use the template's contact layout and receive Contact links. */
export const isContactPath = (path: string) => /^\/(?:contact(?:-us)?|get-in-touch|enquir(?:e|y|ies)|inquir(?:e|y|ies)|(?:request-a-)?quote|book(?:ing)?(?:-[a-z-]+)?)$/.test(path)
