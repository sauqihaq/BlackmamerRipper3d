import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readJob, withCors } from '../../_lib';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  withCors(res, req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const job = await readJob(String(req.query.jobId));
  if (!job) return res.status(404).json({ error: 'Job not found' });
  return res.status(200).json(job);
}
