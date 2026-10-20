import assert from 'node:assert/strict'
import { imageCropSource } from '../apps/web/src/lib/image-crop-source'
assert.deepEqual(imageCropSource(800, 400, 200, 200, 'cover'), { x: 200, y: 0, width: 400, height: 400 })
assert.deepEqual(imageCropSource(800, 400, 200, 200, 'cover', '100% 50%'), { x: 400, y: 0, width: 400, height: 400 })
assert.deepEqual(imageCropSource(400, 800, 200, 200, 'cover', '50% 0%'), { x: 0, y: 0, width: 400, height: 400 })
assert.deepEqual(imageCropSource(800, 400, 200, 100, 'contain'), { x: 0, y: 0, width: 800, height: 400 })
assert.deepEqual(imageCropSource(800, 400, 100, 200, 'fill'), { x: 0, y: 0, width: 800, height: 400 })
console.log('PASS: inline crops map to full-resolution source pixels for centred and edge-focused cover, contain and stretch.')
