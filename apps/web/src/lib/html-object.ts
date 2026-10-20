import { objectScope } from './object-editing'
import { getAtPointer } from './json-pointer'
export function htmlObjectTarget(props: Record<string,unknown>, path: string) {
  const scope=objectScope(props,path)
  const root=scope.path.match(/^\/items\/\d+/)?.[0]
  const value=root?getAtPointer(scope.props,root):undefined
  return root && value && typeof value==='object' && !Array.isArray(value) && 'kind' in value && value.kind==='embed' ? {pointer:`${scope.prefix}${root}`,value:value as Record<string,unknown>} : undefined
}
