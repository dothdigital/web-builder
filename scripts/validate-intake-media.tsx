import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { intakeMediaSchema, videoSource } from '@awb/shared/intake-media'
import { getComponent, validateSectionProps } from '@awb/component-registry'
import { defaultTokens } from '@awb/component-registry'

assert.deepEqual(videoSource('https://youtu.be/abcdefghijk'), { kind: 'embed', url: 'https://www.youtube-nocookie.com/embed/abcdefghijk' })
assert.deepEqual(videoSource('https://www.youtube.com/watch?v=abcdefghijk&t=20'), { kind: 'embed', url: 'https://www.youtube-nocookie.com/embed/abcdefghijk' })
assert.deepEqual(videoSource('https://vimeo.com/123456/abc123'), { kind: 'embed', url: 'https://player.vimeo.com/video/123456?h=abc123' })
assert.equal(videoSource('https://cdn.example.com/demo.mp4?token=abc')?.kind, 'file')
for (const url of ['javascript:alert(1)', 'http://youtu.be/abcdefghijk', 'https://youtube.com.evil.example/watch?v=abcdefghijk', 'https://user:password@example.com/demo.mp4', 'https://example.com/page']) assert.equal(videoSource(url), undefined)
assert.equal(intakeMediaSchema.safeParse({ imageMode: 'upload', photos: [] }).success, false)
assert.equal(intakeMediaSchema.safeParse({ videos: Array.from({ length: 6 }, () => ({ url: 'https://youtu.be/abcdefghijk', title: 'Video' })) }).success, false)
Object.assign(globalThis, { React })
const media = intakeMediaSchema.parse({ imageMode: 'mixed', photos: [{ assetId: 'photo-1', purpose: 'personal', description: 'Our founder' }], videos: [{ url: 'https://youtu.be/abcdefghijk', title: 'Meet our team' }, { url: 'https://cdn.example.com/work.webm', title: 'Our work' }] })
const component = getComponent('IntakeVideos')!
const validation = validateSectionProps('videos', 'IntakeVideos', { heading: 'Our videos', videos: media.videos })
assert.equal(validation.ok, true)
if (!validation.ok) throw new Error(validation.error.message)
const props = validation.props
const html = renderToStaticMarkup(React.createElement(component.render as React.ComponentType<any>, { props, context: { tokens: defaultTokens, editing: false } }))
assert.match(html, /youtube-nocookie.com\/embed\/abcdefghijk/)
assert.match(html, /<video[^>]*controls=""/)
assert.match(html, /Meet our team/)
assert.doesNotMatch(html, /autoplay/i)
console.log('Intake media validation and video rendering passed.')
