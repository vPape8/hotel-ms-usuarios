import express, { Express, NextFunction, Request, Response } from 'express';
import { userRoutes } from './routes/userRoutes';

export function createApp(): Express {
	const app = express();
	app.use(express.json());

	app.get('/health', (_request, response) => {
		response.json({ status: 'ok' });
	});

	app.use('/api/v1/users', userRoutes);

	app.use((_request, response) => {
		response.status(404).json({ error: 'RUTA_NO_ENCONTRADA' });
	});

	app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
		if (error instanceof SyntaxError) {
			response.status(400).json({ error: 'JSON_INVALIDO' });
			return;
		}
		response.status(500).json({ error: 'ERROR_INTERNO' });
	});

	return app;
}