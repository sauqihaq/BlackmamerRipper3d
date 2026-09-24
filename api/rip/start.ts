import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runRip, saveJob, withCors } from '../_lib';

export const config = { maxDuration: 300, memory: 3008 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  withCors(res, req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { job, files } = await runRip(req.body || {});
    const saved = await saveJob(job, files);
    return res.status(200).json({ jobId: saved.id, ...saved });
  } catch (e: any) {
    const job = e?.job;
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Rip failed', jobId: job?.id });
  }
}
