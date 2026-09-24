import { put, head, list, del } from '@vercel/blob';
import fs from 'node:fs/promises';
import path from 'node:path';
import { zipSync } from 'fflate';
import { randomBytes } from 'node:crypto';
import { PageLoader } from '../services/src/browser/page-loader';
import { GLTFExporter, OBJExporter, UAssetExporter } from '../packages/export-formats/src';

export type ExportFormat = 'glb' | 'gltf' | 'obj' | 'uasset';

export interface RipJob {
  id: string;
  url: string;
  status: 'complete' | 'failed';
  progress: number;
  createdAt: string;
  completedAt?: string;
  format: ExportFormat;
  filename?: string;
  downloadUrl?: string;
  stats?: Record<string, number>;
  error?: string;
}

const token = process.env.BLOB_READ_WRITE_TOKEN;
const LOCAL_DIR = process.env.RENDER_LOCAL_STORAGE === 'true';
const DATA_DIR = path.join('/tmp', 'demonz-data');
const memoryJobs = new Map<string, RipJob>();
const memoryFiles = new Map<string, string>();

function requireBlobToken() {
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not configured. Set RENDER_LOCAL_STORAGE=true for Render Free.');
}

function id() { return randomBytes(9).toString('base64url'); }
function cors(origin?: string) {
  const configured = process.env.CORS_ORIGIN?.trim();
  const allowed = configured || origin || '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export function withCors(res: any, origin?: string) {
  Object.entries(cors(origin)).forEach(([k,v]) => res.setHeader(k,v));
}

export async function saveJob(job: RipJob, files: Array<{name:string; data:Uint8Array}>) {
  const main = files[0];
  if (!main) throw new Error('No output file was generated.');
  if (LOCAL_DIR) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const filePath = path.join(DATA_DIR, `${job.id}-${main.name}`);
    await fs.writeFile(filePath, main.data);
    memoryFiles.set(job.id, filePath);
    memoryJobs.set(job.id, job);
    job.downloadUrl = `/api/rip/download/${job.id}`;
    return job;
  }
  requireBlobToken();
  const prefix = `demonz/${job.id}`;
  let mainUrl = '';
  for (const file of files) {
    const blob = await put(`${prefix}/${file.name}`, file.data, { access: 'public', addRandomSuffix: false, token });
    if (!mainUrl) mainUrl = blob.url;
  }
  job.downloadUrl = mainUrl;
  await put(`demonz/jobs/${job.id}.json`, JSON.stringify(job), { access: 'public', addRandomSuffix: false, contentType: 'application/json', token });
  return job;
}

export async function readJob(jobId: string): Promise<RipJob | null> {
  if (LOCAL_DIR) return memoryJobs.get(jobId) ?? null;
  requireBlobToken();
  try {
    const blob = await head(`demonz/jobs/${jobId}.json`, { token });
    const r = await fetch(blob.url);
    if (!r.ok) return null;
    return await r.json() as RipJob;
  } catch { return null; }
}

export async function listJobs(): Promise<RipJob[]> {
  if (LOCAL_DIR) return [...memoryJobs.values()].sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  requireBlobToken();
  const result = await list({ prefix: 'demonz/jobs/', token });
  const jobs: RipJob[] = [];
  for (const b of result.blobs) {
    try { const r = await fetch(b.url); if (r.ok) jobs.push(await r.json() as RipJob); } catch {}
  }
  return jobs.sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function getLocalFile(jobId: string): Promise<string | null> {
  if (!LOCAL_DIR) return null;
  const p = memoryFiles.get(jobId);
  if (!p) return null;
  try { await fs.access(p); return p; } catch { return null; }
}

export async function deleteJob(jobId: string) {
  if (LOCAL_DIR) {
    const p = memoryFiles.get(jobId);
    if (p) { try { await fs.unlink(p); } catch {} }
    memoryFiles.delete(jobId); memoryJobs.delete(jobId); return;
  }
  requireBlobToken();
  const result = await list({ prefix: `demonz/${jobId}/`, token });
  const urls = result.blobs.map(b => b.url);
  try { urls.push((await head(`demonz/jobs/${jobId}.json`, { token })).url); } catch {}
  if (urls.length) await del(urls, { token });
}

function zipFiles(files: Array<{name:string; data:Uint8Array}>) {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.name] = f.data;
  return zipSync(entries, { level: 6 });
}

function ab(data: ArrayBuffer | Uint8Array) { return data instanceof Uint8Array ? data : new Uint8Array(data); }

export async function runRip(input: any): Promise<{job: RipJob; files: Array<{name:string;data:Uint8Array}>}> {
  const url = String(input.url || '').trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('A valid HTTP/HTTPS URL is required.');
  const format: ExportFormat = ['glb','gltf','obj','uasset'].includes(input.exportFormat) ? input.exportFormat : 'glb';
  const createdAt = new Date().toISOString();
  const job: RipJob = { id: id(), url, status: 'failed', progress: 10, createdAt, format };

  const loader = new PageLoader();
  try {
    const result = await loader.ripPage(url, {
      captureTextures: input.captureTextures !== false,
      captureShaders: input.captureShaders !== false,
      captureDuration: Math.min(Math.max(Number(input.captureDuration) || 3000, 500), 15000),
      waitForLoad: Math.min(Math.max(Number(input.waitForLoad) || 5000, 1000), 30000),
      viewport: {
        width: Math.min(Math.max(Number(input.viewportWidth) || 1920, 320), 3840),
        height: Math.min(Math.max(Number(input.viewportHeight) || 1080, 240), 2160),
      },
    });

    let files: Array<{name:string;data:Uint8Array}>;
    if (format === 'glb') {
      files = [{ name: 'scene.glb', data: ab(result.glb) }];
    } else if (format === 'gltf') {
      const out = new GLTFExporter().export(result.scene, { embedBinary: false });
      const gltf = JSON.stringify(out.json, null, 2);
      files = [{ name: 'scene.gltf', data: new TextEncoder().encode(gltf) }, { name: 'scene.bin', data: ab(out.binary) }];
      files = [{ name: 'scene.zip', data: zipFiles(files) }];
    } else if (format === 'obj') {
      const out = new OBJExporter().export(result.scene);
      const base: Array<{name:string;data:Uint8Array}> = [
        { name: 'scene.obj', data: new TextEncoder().encode(out.obj) },
        { name: 'scene.mtl', data: new TextEncoder().encode(out.mtl) },
      ];
      for (const [name,data] of out.textureFiles) base.push({ name, data: ab(data) });
      files = [{ name: 'scene.zip', data: zipFiles(base) }];
    } else {
      const out = new UAssetExporter().export(result.scene);
      const base: Array<{name:string;data:Uint8Array}> = [];
      for (const file of out.files) {
        base.push({ name: `${file.name}.uasset`, data: ab(file.uasset) });
        base.push({ name: `${file.name}.uexp`, data: ab(file.uexp) });
        if (file.ubulk) base.push({ name: `${file.name}.ubulk`, data: ab(file.ubulk) });
      }
      files = [{ name: 'uasset-export.zip', data: zipFiles(base) }];
    }

    job.status = 'complete'; job.progress = 100; job.completedAt = new Date().toISOString();
    job.filename = files[0].name;
    job.stats = {
      meshCount: result.stats.meshCount,
      textureCount: result.stats.textureCount,
      shaderCount: result.stats.shaderCount,
      drawCallCount: result.stats.drawCallCount,
      captureTimeMs: result.stats.captureTimeMs,
      fileSizeBytes: files.reduce((n,f)=>n+f.data.byteLength,0),
    };
    return { job, files };
  } catch (e) {
    job.error = e instanceof Error ? e.message : 'Rip failed';
    job.completedAt = new Date().toISOString();
    throw Object.assign(new Error(job.error), { job });
  } finally {
  }
}
