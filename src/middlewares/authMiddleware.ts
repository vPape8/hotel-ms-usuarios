import { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(uri: string): ReturnType<typeof createRemoteJWKSet> {
	let jwks = jwksCache.get(uri);
	if (!jwks) {
		jwks = createRemoteJWKSet(new URL(uri));
		jwksCache.set(uri, jwks);
	}
	return jwks;
}

function bearerToken(request: Request): string | undefined {
	const authorization = request.header('authorization');
	return authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
}

async function validateToken(request: Request, response: Response, next: NextFunction, options: {
	issuer: string;
	audience: string;
	jwksUri: string;
}): Promise<void> {
	const token = bearerToken(request);
	if (!token) {
		response.status(401).json({ error: 'TOKEN_REQUERIDO' });
		return;
	}

	try {
		const { payload } = await jwtVerify(token, getJwks(options.jwksUri), {
			issuer: options.issuer,
			audience: options.audience
		});
		request.user = payload;
		next();
	} catch {
		response.status(401).json({ error: 'TOKEN_INVALIDO' });
	}
}

export function azureAuthMiddleware(request: Request, response: Response, next: NextFunction): void {
	const tenantId = process.env.AZURE_TENANT_ID;
	const audience = process.env.AZURE_CLIENT_ID;
	if (!tenantId || !audience) {
		response.status(500).json({ error: 'AUTENTICACION_AZURE_NO_CONFIGURADA' });
		return;
	}

	const issuer = process.env.AZURE_ISSUER ?? `https://login.microsoftonline.com/${tenantId}/v2.0`;
	const jwksUri = process.env.AZURE_JWKS_URI ?? `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;
	void validateToken(request, response, next, { issuer, audience, jwksUri });
}

export function cognitoAuthMiddleware(request: Request, response: Response, next: NextFunction): void {
	const issuer = process.env.COGNITO_ISSUER;
	const audience = process.env.COGNITO_CLIENT_ID;
	if (!issuer || !audience) {
		response.status(500).json({ error: 'AUTENTICACION_COGNITO_NO_CONFIGURADA' });
		return;
	}

	const jwksUri = process.env.COGNITO_JWKS_URI ?? `${issuer.replace(/\/$/, '')}/.well-known/jwks.json`;
	void validateToken(request, response, next, { issuer, audience, jwksUri });
}