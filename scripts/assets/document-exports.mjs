import { readFile, writeFile } from 'node:fs/promises'

const report = JSON.parse(await readFile('scripts/assets/inspection.json', 'utf8'))
const path = 'ASSET_MANIFEST.md'
const current = await readFile(path, 'utf8')
const marker = '\n## Verified export inventory'
const base = current.includes(marker) ? current.slice(0, current.indexOf(marker)) : current
const rows = report.assets.map(asset => {
  const source = asset.name.replace(/-lod1$/, '')
  return `| ${asset.name} | ${(asset.bytes / 1024).toFixed(1)} | ${asset.triangles.toLocaleString('en-US')} | ${asset.drawCalls} | [GLB](public${asset.path}) · [source](assets/source/${source}.blend) |`
}).join('\n')
const section = `${marker} — ${report.checkedAt}

${report.assets.length} original exports, ${(report.totalBytes / 1048576).toFixed(2)} MiB combined. Container, triangle primitive, normal, UV, single-scene/mesh, texture URI and export guardrail checks: ${report.errors.length ? 'FAIL' : 'PASS'}. See [machine-readable inspection](scripts/assets/inspection.json).

| Export | KiB | Triangles | Material primitives | Files |
| --- | ---: | ---: | ---: | --- |
${rows}

The material primitive column describes exported geometry, not final scene draw calls. Low/Lite combine flat-color material parts into shared vertex-colored Lambert batches. High/Ultra retain the near assets' authored PBR materials. Distant skyline assets use LOD1 and color batching. Actual submitted work is reported by the renderer, including shadow passes.

Sources are independent Blender libraries in assets/source; GLBs use categorized public/assets folders. No texture atlas, Draco/meshopt compression, completed skeleton or animation clips are claimed. The rendered falling petals use two-triangle GPU-instanced quads; the separate petal GLB is a source/reference asset.

The original table above retains provisional targets. Several original material-slot and per-asset geometry targets are exceeded, notably the flower patch and apartment. Passing export guardrails does not sign off those targets or real-device frame performance. Density limits, LODs and batching reduce the scene's cost; lower-tier acceptance remains a profiling gate.
`
await writeFile(path, base + section)
console.log(`Documented ${report.assets.length} measured exports.`)
