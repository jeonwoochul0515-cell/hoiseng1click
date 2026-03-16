/**
 * @deprecated This Cloudflare Worker is NOT in use.
 * The API has been migrated to Firebase Functions (see /functions/src/).
 * This directory is kept for reference only.
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { verifyFirebaseToken } from './auth';
import { handleCodefCollect } from './codefProxy';
import { handleIntakeCodefCollect } from './intakeCodef';
import { handlePropertyLookup, handleVehicleLookup } from './publicDataProxy';
import { handleDocGenerate } from './docGenerator';

const app = new Hono<{ Bindings: Env; Variables: { user: { uid: string; email: string; plan: string } } }>();

app.use('*', cors({
  origin: ['https://hoiseng1click.web.app', 'https://lawdocs-prod.web.app', 'http://localhost:5173'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Public intake route — before Firebase JWT middleware
app.post('/intake/codef-collect', handleIntakeCodefCollect);

app.use('*', async (c, next) => {
  const auth = c.req.header('Authorization') ?? '';
  const token = auth.replace('Bearer ', '');
  const user = await verifyFirebaseToken(token, c.env.FIREBASE_PROJECT_ID);
  if (!user) return c.json({ error: '인증 필요' }, 401);
  c.set('user', user);
  await next();
});

app.post('/codef/collect', handleCodefCollect);
app.get('/public/property', handlePropertyLookup);
app.get('/public/vehicle', handleVehicleLookup);
app.post('/doc/generate', handleDocGenerate);

app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;
