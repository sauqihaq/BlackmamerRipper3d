import type { VercelRequest, VercelResponse } from '@vercel/node';
import { deleteJob, withCors } from '../_lib';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  withCors(res, req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  await deleteJob(String(req.query.jobId));
  return res.status(200).json({ deleted: true });
}
