import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { GLTFLoader } from 'three-stdlib'
import { LoadingManager } from 'three'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const manifestPath = path.join(root, 'public/assets/archnova-asset-manifest.json')
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
const failures = []
let totalBytes = 0

// Node has no browser bitmap decoder. This shape-stable stand-in lets the real
// Three.js GLTFLoader validate JSON, binary buffers, scenes, materials and textures.
globalThis.self = globalThis
if (!globalThis.ProgressEvent) globalThis.ProgressEvent = class extends Event { constructor(type, init = {}) { super(type); Object.assign(this, init) } }
globalThis.createImageBitmap = async (blob) => ({ width: 2, height: 2, blobSize: blob.size, close() {} })

for (const record of [...manifest.models, ...manifest.materials]) {
  for (const file of record.files) {
    const absolute = path.join(root, file.path)
    const data = await fs.readFile(absolute)
    totalBytes += data.length
    const md5 = crypto.createHash('md5').update(data).digest('hex')
    if (md5 !== file.md5) failures.push(`${record.id}: checksum mismatch for ${file.path}`)
  }
}

for (const record of manifest.models) {
  try {
    const modelPath = path.join(root, record.modelFile)
    const modelFolder = path.dirname(modelPath)
    const json = JSON.parse(await fs.readFile(modelPath, 'utf8'))
    for (const buffer of json.buffers ?? []) {
      if (!buffer.uri || buffer.uri.startsWith('data:')) continue
      const bytes = await fs.readFile(path.join(modelFolder, buffer.uri))
      buffer.uri = `data:application/octet-stream;base64,${bytes.toString('base64')}`
    }
    for (const image of json.images ?? []) {
      if (!image.uri || image.uri.startsWith('data:')) continue
      const bytes = await fs.readFile(path.join(modelFolder, image.uri))
      const mime = path.extname(image.uri).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg'
      image.uri = `data:${mime};base64,${bytes.toString('base64')}`
    }
    const loader = new GLTFLoader(new LoadingManager())
    const gltf = await new Promise((resolve, reject) => loader.parse(json, '', resolve, reject))
    let meshCount = 0
    let triangles = 0
    gltf.scene.traverse((object) => {
      if (!object.isMesh) return
      meshCount += 1
      triangles += object.geometry.index ? object.geometry.index.count / 3 : object.geometry.attributes.position.count / 3
    })
    if (!meshCount || !triangles) failures.push(`${record.id}: loader produced an empty scene`)
    console.log(`LOAD OK ${record.id.padEnd(32)} meshes=${String(meshCount).padStart(3)} triangles=${Math.round(triangles).toLocaleString().padStart(9)} dims=${record.dimensionsM.join('×')}m`)
  } catch (error) {
    failures.push(`${record.id}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

console.log(`Verified ${manifest.models.length} GLTF models and ${manifest.materials.length} PBR sets; ${(totalBytes / 1e6).toFixed(1)} MB checked.`)
if (failures.length) {
  console.error('FAILURES:\n' + failures.map((failure) => `- ${failure}`).join('\n'))
  process.exitCode = 1
}
