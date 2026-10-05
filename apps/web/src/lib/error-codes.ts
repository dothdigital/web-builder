export const SUPPORT_EMAIL = 'support@webtummy.com'
export const ERROR_CODES = {
  'WT-BILLING-002': 'Payment history or invoice unavailable',
  'WT-BILLING-001': 'Subscription payment required',
  'WT-REQUEST-002': 'Page updated; reload required',
  'WT-REQUEST-001': 'Request could not complete',
  'WT-AUTH-001': 'Sign-in or account verification failed',
  'WT-UPLOAD-001': 'Image upload failed',
  'WT-EDITOR-001': 'Website edit or save failed',
  'WT-CONTENT-001': 'Content generation failed',
  'WT-ANALYTICS-001': 'Analytics request failed',
  'WT-INTEGRATION-001': 'Integration configuration failed',
  'WT-PUBLISH-001': 'Website publishing failed',
  'WT-NETWORK-001': 'Connection interrupted',
  'WT-FORM-001': 'Invalid form field',
  'WT-SYSTEM-500': 'Unexpected application failure',
  'WT-PAGE-404': 'Page not found',
} as const
export type ErrorCode = keyof typeof ERROR_CODES
