import { NextFunction, Request, Response } from 'express';
import jwt, { JwtHeader, JwtPayload } from 'jsonwebtoken';
import jwksClient, { SigningKey } from 'jwks-rsa';

interface EntraTokenPayload extends JwtPayload {
	[key: string]: unknown;
}

function getSigningKey(header: JwtHeader, callback: jwt.SigningKeyCallback): void {
	const tenantId = process.env.ENTRA_TENANT_ID;
	if (!tenantId || !header.kid) {
		callback(new Error('Configuración o identificador de llave ausente'));
		return;
	}

	const client = jwksClient({
		jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
		cache: true,
		cacheMaxEntries: 5,
		cacheMaxAge: 10 * 60 * 1000,
		rateLimit: true,
		jwksRequestsPerMinute: 10
	});

	client.getSigningKey(header.kid)
		.then((key: SigningKey) => callback(null, key.getPublicKey()))
		.catch((error: unknown) => callback(error instanceof Error ? error : new Error('No se pudo obtener la llave pública')));
}

export function azureAuth(request: Request, response: Response, next: NextFunction): void {
	const tenantId = process.env.ENTRA_TENANT_ID;
	const audience = process.env.ENTRA_AUDIENCE;

	if (!tenantId || !audience) {
		response.status(500).json({ error: 'AUTENTICACION_ENTRA_NO_CONFIGURADA' });
		return;
	}

	const authorization = request.header('authorization');
	const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
	if (!token) {
		response.status(401).json({ error: 'TOKEN_REQUERIDO' });
		return;
	}

	const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
	jwt.verify(token, getSigningKey, {
		algorithms: ['RS256'],
		audience,
		issuer
	}, (error, decoded) => {
		if (error || !decoded || typeof decoded === 'string') {
			response.status(401).json({ error: 'TOKEN_INVALIDO' });
			return;
		}

		request.user = decoded as EntraTokenPayload;
		next();
	});
}