import type { VercelRequest, VercelResponse } from '@vercel/node';
import { head, del } from '@vercel/blob';
import { readJob, withCors } from '../../_lib';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  withCors(res, req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const job = await readJob(String(req.query.jobId));
  if (!job?.downloadUrl) return res.status(404).json({ error: 'Output not found' });
  return res.redirect(307, job.downloadUrl);
}
