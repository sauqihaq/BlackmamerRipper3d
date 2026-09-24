import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import { runRip, saveJob, readJob, listJobs, deleteJob, getLocalFile } from './api/_lib';

const PORT = Number(process.env.PORT || 8080);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

function headers(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

async function body(req: http.IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

function json(res: http.ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(value));
}

const server = http.createServer(async (req, res) => {
  headers(res);
  if (req.method === 'OPTIONS') return res.end();

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  try {
    if (req.method === 'GET' && path === '/api/health') {
      return json(res, 200, { status: 'ok', service: 'demonz-ripper-render' });
    }

    if (req.method === 'POST' && path === '/api/rip/start') {
      const input = await body(req);
      const { job, files } = await runRip(input);
      const saved = await saveJob(job, files);
      return json(res, 200, { jobId: saved.id, ...saved });
    }

    const statusMatch = path.match(/^\/api\/rip\/status\/([^/]+)$/);
    if (req.method === 'GET' && statusMatch) {
      const job = await readJob(statusMatch[1]);
      return job ? json(res, 200, job) : json(res, 404, { error: 'Job not found' });
    }

    const jobMatch = path.match(/^\/api\/rip\/([^/]+)$/);
    if (req.method === 'GET' && jobMatch) {
      const job = await readJob(jobMatch[1]);
      return job ? json(res, 200, job) : json(res, 404, { error: 'Job not found' });
    }

    if (req.method === 'GET' && path === '/api/rip/jobs') {
      return json(res, 200, await listJobs());
    }

    const deleteMatch = path.match(/^\/api\/rip\/([^/]+)$/);
    if (req.method === 'DELETE' && deleteMatch) {
      await deleteJob(deleteMatch[1]);
      return json(res, 200, { ok: true });
    }

    const downloadMatch = path.match(/^\/api\/rip\/download\/([^/]+)$/);
    if (req.method === 'GET' && downloadMatch) {
      const jobId = downloadMatch[1];
      const job = await readJob(jobId);
      if (!job) return json(res, 404, { error: 'Job not found' });
      const localFile = await getLocalFile(jobId);
      if (localFile) {
        const filename = job.filename || path.basename(localFile).replace(`${jobId}-`, '');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename=\"${filename}\"`);
        return fs.createReadStream(localFile).pipe(res);
      }
      if (!job.downloadUrl) return json(res, 404, { error: 'Output not found' });
      res.statusCode = 307;
      res.setHeader('Location', job.downloadUrl);
      return res.end();
    }

    return json(res, 404, { error: 'Not found' });
  } catch (error: any) {
    const job = error?.job;
    return json(res, 500, {
      error: error instanceof Error ? error.message : 'Request failed',
      jobId: job?.id,
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`DemonZ Ripper Cloud Run API listening on :${PORT}`);
});
