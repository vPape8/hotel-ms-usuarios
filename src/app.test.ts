import assert from 'node:assert/strict';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import test, { after, before } from 'node:test';
import express from 'express';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createApp } from './app';
import { createUserRoutes } from './routes/userRoutes';
import { InMemoryUserRepository, UserConflictError, UserNotFoundError, UserService } from './services/userService';

// Cognito de prueba: las llaves públicas se sirven desde un servidor local (como /.well-known/jwks.json).
const ISSUER = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_PRUEBA';
const CLIENT_ID = 'cliente-frontend-huespedes';

let jwks: Server;
let api: Server;
let baseUrl = '';
let firmar: (claims: Record<string, unknown>) => Promise<string>;

before(async () => {
	const { publicKey, privateKey } = await generateKeyPair('RS256');
	const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
	jwks = createServer((_req, res) => {
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify({ keys: [jwk] }));
	}).listen(0);
	await new Promise((resolve) => jwks.once('listening', resolve));

	process.env.COGNITO_ISSUER = ISSUER;
	process.env.COGNITO_CLIENT_ID = CLIENT_ID;
	process.env.COGNITO_JWKS_URI = `http://127.0.0.1:${(jwks.address() as AddressInfo).port}`;
	process.env.ENTRA_TENANT_ID = 'tenant-prueba';
	process.env.ENTRA_AUDIENCE = 'api-prueba';

	firmar = (claims) => new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'k1' })
		.setIssuer(ISSUER).setIssuedAt().setExpirationTime('1h').sign(privateKey);

	// Las rutas reales con un repositorio en memoria (sin MySQL).
	const app = express();
	app.use(express.json());
	app.use('/api/v1/users', createUserRoutes(new UserService(new InMemoryUserRepository())));
	api = app.listen(0);
	await new Promise((resolve) => api.once('listening', resolve));
	baseUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}/api/v1/users`;
});

after(() => {
	api.close();
	jwks.close();
});

test('GET /health responde ok', async () => {
	const servidor = createApp().listen(0);
	await new Promise((resolve) => servidor.once('listening', resolve));
	const respuesta = await fetch(`http://127.0.0.1:${(servidor.address() as AddressInfo).port}/health`);
	servidor.close();
	assert.equal(respuesta.status, 200);
	assert.deepEqual(await respuesta.json(), { status: 'ok' });
});

test('las rutas de administradores exigen un JWT de Entra ID', async () => {
	const respuesta = await fetch(`${baseUrl}/admin`);
	assert.equal(respuesta.status, 401);
	assert.deepEqual(await respuesta.json(), { error: 'TOKEN_REQUERIDO' });
});

test('las rutas de huéspedes rechazan una petición sin token', async () => {
	const respuesta = await fetch(`${baseUrl}/guest`);
	assert.equal(respuesta.status, 401);
});

test('un access_token de Cognito del app client abre las rutas de huéspedes', async () => {
	const token = await firmar({ sub: 'sub-ana', token_use: 'access', client_id: CLIENT_ID });
	const respuesta = await fetch(`${baseUrl}/guest`, { headers: { Authorization: `Bearer ${token}` } });
	assert.equal(respuesta.status, 200);
});

test('se rechaza un id_token o un token de otro app client', async () => {
	const idToken = await firmar({ sub: 'sub-ana', token_use: 'id', aud: CLIENT_ID });
	const otroCliente = await firmar({ sub: 'sub-ana', token_use: 'access', client_id: 'otro-cliente' });
	for (const token of [idToken, otroCliente]) {
		const respuesta = await fetch(`${baseUrl}/guest`, { headers: { Authorization: `Bearer ${token}` } });
		assert.equal(respuesta.status, 401);
	}
});

test('el servicio no deja duplicar un administrador ni actualizar uno inexistente', async () => {
	const servicio = new UserService(new InMemoryUserRepository());
	const datos = { entraId: 'oid-1', name: 'Admin', email: 'admin@example.com', role: 'ADMIN' as const, active: true };
	const creado = await servicio.createAdmin(datos);
	assert.equal(creado.email, 'admin@example.com');
	await assert.rejects(servicio.createAdmin(datos), UserConflictError);
	await assert.rejects(servicio.updateAdmin('no-existe', { name: 'X' }), UserNotFoundError);
});

test('el servicio crea, busca y elimina un huésped', async () => {
	const servicio = new UserService(new InMemoryUserRepository());
	const huesped = await servicio.createGuest({ cognitoSub: 'sub-ana', name: 'Ana', email: 'ana@example.com', active: true });
	assert.equal((await servicio.findGuest(huesped.id))?.name, 'Ana');
	await servicio.deleteGuest(huesped.id);
	assert.equal(await servicio.findGuest(huesped.id), undefined);
	await assert.rejects(servicio.deleteGuest(huesped.id), UserNotFoundError);
});
