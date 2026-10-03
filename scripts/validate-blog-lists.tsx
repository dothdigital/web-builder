import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ArticleBody, parseArticleBody } from '../packages/component-registry/src/components/article-body'
import { formatListSelection } from '../apps/web/src/lib/text-lists'
const body = 'Introduction\n\n- First\n- Second\n\n3. Third\n4. Fourth\n\nConclusion'
assert.deepEqual(parseArticleBody(body).map(b=>b.type), ['paragraph', 'ul', 'ol', 'paragraph'])
const html = renderToStaticMarkup(<ArticleBody text={body + '\n<script>alert(1)</script>'} path="/blocks/0/body" />)
assert.ok(html.includes('<ul'))
assert.ok(html.includes('start="3"'))
assert.ok(html.includes('list-style-type:disc'))
assert.ok(!html.includes('<script>'))
assert.ok(html.includes('&lt;script&gt;'))
assert.equal(formatListSelection('Before\nFirst\nSecond\nAfter',7,20,'bullet').text,'Before\n- First\n- Second\nAfter')
assert.equal(formatListSelection('- First\n- Second',0,16,'number').text,'1. First\n2. Second')
assert.equal(formatListSelection('1. First\n2. Second',0,18,'plain').text,'First\nSecond')
assert.equal(formatListSelection('',0,0,'bullet').text,'- ')
assert.equal(parseArticleBody('Existing plain text')[0]?.lines[0],'Existing plain text')
console.log('PASS: mixed paragraphs/lists, list numbering, escaped HTML, selected-line formatting, and unchanged plain text.')

const single = renderToStaticMarkup(<ArticleBody text="One paragraph" path="/body" />)
assert.ok(single.includes('margin:0'), 'Single paragraphs must not have trailing spacing')
const multiple = renderToStaticMarkup(<ArticleBody text={"First\n\nSecond"} path="/body" />)
assert.ok(multiple.includes('margin:0 0 1em'), 'Spacing between paragraphs remains')
assert.ok(multiple.includes('margin:0">Second'), 'No spacing after the final paragraph')
const list = renderToStaticMarkup(<ArticleBody text={"- One\n- Two"} path="/body" />)
assert.ok(list.includes('margin-bottom:0">Two'), 'Final list item has no trailing gap')
console.log('PASS: trailing paragraph/list space removed; internal spacing preserved.')
