import assert from 'node:assert/strict'
import React, { act, useState } from 'react'
import { JSDOM } from 'jsdom'
import { ChipInput, mergeChipValues } from '../apps/web/src/app/onboarding/chip-input'

async function main() {
  const dom = new JSDOM('<div id="root"></div>')
  Object.assign(globalThis, { React, window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  const { createRoot } = await import('react-dom/client')
  let editDraft: (value: string) => void = () => {}
  let selected: string[] = []
  function Form() {
    const [values, setValues] = useState<string[]>([])
    const [draft, setDraft] = useState('warm')
    editDraft = setDraft
    selected = values
    return <ChipInput id="tones" label="Tone" values={values} draft={draft} onValuesChange={setValues} onDraftChange={setDraft} placeholder="Enter tone" />
  }
  const root = createRoot(document.getElementById('root')!)
  await act(async () => root.render(<Form />))
  const press = async (key: string) => {
    await act(async () => document.querySelector('input')!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })))
  }
  await press('Enter')
  assert.deepEqual(selected, ['warm'])
  assert.equal(document.querySelector('input')!.value, '')
  await act(async () => editDraft('premium'))
  await press(',')
  assert.deepEqual(selected, ['warm', 'premium'])
  await act(async () => editDraft(' WARM '))
  await press('Enter')
  assert.deepEqual(selected, ['warm', 'premium'], 'Duplicate tones are ignored')
  await act(async () => document.querySelector('button')!.click())
  assert.deepEqual(selected, ['premium'])
  assert.deepEqual(mergeChipValues(selected, 'direct, friendly\nconfident'), ['premium', 'direct', 'friendly', 'confident'])
  await act(async () => root.unmount())
  dom.window.close()
  console.log('PASS: Enter and comma create chips, drafts clear, duplicates are ignored, × removes chips, and comma/newline lists split correctly.')
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
