import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface JwtPayload {
    userId: string
    username: string
}

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload
        }
    }
}

export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' })
    }

    const token = authHeader.slice(7)
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'dev_secret') as JwtPayload
        req.user = payload
        next()
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' })
    }
}

export function verifySocketToken(token: string): JwtPayload {
    return jwt.verify(token, process.env.JWT_SECRET ?? 'dev_secret') as JwtPayload
}

export function signToken(payload: JwtPayload): string {
    return jwt.sign(payload, process.env.JWT_SECRET ?? 'dev_secret', { expiresIn: '7d' })
}
