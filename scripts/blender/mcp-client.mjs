/** Minimal standard MCP JSON-RPC stdio client for the configured Blender server.
 * Uses the actual MCP server; never sends commands directly to the add-on socket.
 * node scripts/blender/mcp-client.mjs inspect
 * node scripts/blender/mcp-client.mjs execute scripts/blender/build-kit.py
 * Override BLENDER_MCP_COMMAND / BLENDER_MCP_ARGS to match your MCP configuration.
 */
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const mode = process.argv[2] || 'inspect';
const command = process.env.BLENDER_MCP_COMMAND || 'uvx';
const args = JSON.parse(process.env.BLENDER_MCP_ARGS || '["mcp-for-blender"]');
const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: { ...process.env, DISABLE_TELEMETRY: 'true' } });
const pending = new Map();
let nextId = 1;
let buffer = '';
let diagnosticBuffer = '';
child.stderr.on('data', chunk => {
  diagnosticBuffer += chunk.toString();
  let end;
  while ((end = diagnosticBuffer.indexOf('\n')) >= 0) {
    const line = diagnosticBuffer.slice(0, end); diagnosticBuffer = diagnosticBuffer.slice(end + 1);
    if (!line.includes('Sending command: execute_code with params:')) process.stderr.write(line + '\n');
  }
});
function rejectPending(error) {
  for (const request of pending.values()) { clearTimeout(request.timeout); request.reject(error); }
  pending.clear();
}
child.on('error', rejectPending);
child.on('exit', code => { if (pending.size) rejectPending(new Error(`Blender MCP process exited (${code}) before responding`)); });
child.stdout.on('data', chunk => {
  buffer += chunk.toString();
  let index;
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index).trim(); buffer = buffer.slice(index + 1);
    if (!line) continue;
    let message;
    try { message = JSON.parse(line); } catch { continue; }
    if (pending.has(message.id)) {
      const request = pending.get(message.id); pending.delete(message.id);
      clearTimeout(request.timeout);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    }
  }
});
function send(message) { child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n'); }
function rpc(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`MCP timeout: ${method}`)); }, 240000);
    pending.set(id, { resolve, reject, timeout }); send({ id, method, params });
  });
}
try {
  const initialized = await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'elyria-asset-pipeline', version: '0.1.0' } });
  send({ method: 'notifications/initialized' });
  const listing = await rpc('tools/list');
  await mkdir(resolve('scripts/blender/reports'), { recursive: true });
  await writeFile(resolve('scripts/blender/reports/capabilities.json'), JSON.stringify({ checkedAt: new Date().toISOString(), serverInfo: initialized.serverInfo, tools: listing.tools }, null, 2));
  let result;
  if (mode === 'inspect') {
    result = await rpc('tools/call', { name: 'get_scene_info', arguments: { user_prompt: 'use prompt.md and astra.md to proceed' } });
  } else if (mode === 'execute') {
    const file = resolve(process.argv[3]);
    let code = await readFile(file, 'utf8');
    code = code.replaceAll('__ELYRIA_WORKSPACE__', process.cwd().replaceAll('\\', '/'));
    if (process.argv[4]) code = code.replaceAll('__ELYRIA_ASSET_FILTER__', process.argv[4]);
    result = await rpc('tools/call', { name: 'execute_blender_code', arguments: { code, user_prompt: 'use prompt.md and astra.md to proceed' } });
  } else throw new Error(`Unknown mode ${mode}`);
  await writeFile(resolve(`scripts/blender/reports/${mode}-result.json`), JSON.stringify({ checkedAt: new Date().toISOString(), result }, null, 2));
  for (const item of result.content || []) {
    const match = item.text?.match(/ELYRIA_ASSETS=(\[[^\n]*\])/);
    if (match) for (const asset of JSON.parse(match[1])) {
      await writeFile(resolve(`scripts/blender/reports/${asset.name}.json`), JSON.stringify(asset, null, 2));
    }
  }
  console.log(JSON.stringify(result, null, 2));
  if (result.isError || result.content?.some(item => item.type === 'text' && /^(Error|Rejected)/.test(item.text))) process.exitCode = 1;
} finally {
  for (const request of pending.values()) clearTimeout(request.timeout);
  child.stdin.end(); child.kill();
}
