export * from './contracts'
export * from './models'
export * from './provider'
export * from './color'
export * from './random'
export { StubAiProvider } from './stub'
export { OpenAiProvider } from './openai'

import type { AiProvider, AiProviderConfig } from './provider'
import { StubAiProvider } from './stub'
import { OpenAiProvider } from './openai'

/// Defaults to the deterministic stub so the product is fully runnable without
/// an OpenAI account, but asking for "openai" without a key is an error rather
/// than a silent downgrade to placeholder content and gradient images.
export function createAiProvider(config: AiProviderConfig = {}): AiProvider {
  const provider = process.env['AI_PROVIDER'] ?? 'stub'
  const apiKey = (config.apiKey ?? process.env['OPENAI_API_KEY'] ?? '').trim()

  if (provider === 'openai') {
    if (!apiKey) {
      throw new Error('AI_PROVIDER=openai requires OPENAI_API_KEY to be set')
    }

    return new OpenAiProvider({ ...config, apiKey })
  }

  return new StubAiProvider(config)
}
