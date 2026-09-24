import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listJobs, withCors } from '../_lib';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  withCors(res, req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(204).end();
  return res.status(200).json(await listJobs());
}
