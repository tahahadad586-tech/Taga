import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response, Router } from 'express';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type Database from 'better-sqlite3';

export interface AuthedRequest extends Request {
  userId?: string;
}

export function getJwtSecret(): string {
  const secret = process.env.TAGA_JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('TAGA_JWT_SECRET must be set in production');
  }
  return 'dev-only-secret-do-not-use-in-production';
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization token' });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), getJwtSecret()) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function createAuthRouter(db: Database.Database): Router {
  const router = express.Router();

  router.post('/register', (req, res) => {
    const { email, password, name } = req.body ?? {};
    if (typeof email !== 'string' || !email.includes('@') || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'A valid email and a password of at least 8 characters are required' });
      return;
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }
    const id = randomUUID();
    db.prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(
      id,
      email.toLowerCase(),
      typeof name === 'string' && name ? name : email.split('@')[0],
      bcrypt.hashSync(password, 10),
      new Date().toISOString()
    );
    const token = jwt.sign({ sub: id }, getJwtSecret(), { expiresIn: '7d' });
    res.status(201).json({ token, user: { id, email: email.toLowerCase() } });
  });

  router.post('/login', (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    const user = db.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?').get(email.toLowerCase()) as
      | { id: string; email: string; name: string; password_hash: string }
      | undefined;
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    const token = jwt.sign({ sub: user.id }, getJwtSecret(), { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  });

  return router;
}
