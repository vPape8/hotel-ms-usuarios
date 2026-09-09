import { Request, Response } from 'express';
import {
	CreateAdminInput,
	CreateGuestInput,
	UpdateAdminInput,
	UpdateGuestInput
} from '../models/userModel';
import { UserConflictError, UserNotFoundError, UserService } from '../services/userService';

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasStrings(value: Record<string, unknown>, fields: string[]): boolean {
	return fields.every((field) => typeof value[field] === 'string' && value[field].trim().length > 0);
}

function routeId(request: Request, response: Response): string | undefined {
	const id = request.params.id;
	if (typeof id !== 'string' || id.length === 0) {
		response.status(400).json({ error: 'ID_INVALIDO' });
		return undefined;
	}
	return id;
}

function handleError(error: unknown, response: Response): void {
	if (error instanceof UserNotFoundError) {
		response.status(404).json({ error: 'USUARIO_NO_ENCONTRADO' });
		return;
	}
	if (error instanceof UserConflictError) {
		response.status(409).json({ error: 'USUARIO_DUPLICADO' });
		return;
	}
	response.status(500).json({ error: 'ERROR_INTERNO' });
}

export class UserController {
	constructor(private readonly service: UserService) {}

	listAdmins = async (_request: Request, response: Response): Promise<void> => {
		response.json({ data: await this.service.listAdmins() });
	};

	getAdmin = async (request: Request, response: Response): Promise<void> => {
		const id = routeId(request, response);
		if (!id) return;
		const admin = await this.service.findAdmin(id);
		if (!admin) {
			response.status(404).json({ error: 'USUARIO_NO_ENCONTRADO' });
			return;
		}
		response.json({ data: admin });
	};

	createAdmin = async (request: Request, response: Response): Promise<void> => {
		if (!isObject(request.body) || !hasStrings(request.body, ['entraId', 'name', 'email'])) {
			response.status(400).json({ error: 'DATOS_ADMIN_INVALIDOS' });
			return;
		}

		try {
			const input: CreateAdminInput = {
				entraId: request.body.entraId as string,
				name: request.body.name as string,
				email: request.body.email as string,
				role: request.body.role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE',
				active: request.body.active !== false
			};
			response.status(201).json({ data: await this.service.createAdmin(input) });
		} catch (error) {
			handleError(error, response);
		}
	};

	updateAdmin = async (request: Request, response: Response): Promise<void> => {
		if (!isObject(request.body)) {
			response.status(400).json({ error: 'DATOS_ADMIN_INVALIDOS' });
			return;
		}
		const id = routeId(request, response);
		if (!id) return;
		try {
			response.json({ data: await this.service.updateAdmin(id, request.body as UpdateAdminInput) });
		} catch (error) {
			handleError(error, response);
		}
	};

	deleteAdmin = async (request: Request, response: Response): Promise<void> => {
		const id = routeId(request, response);
		if (!id) return;
		try {
			await this.service.deleteAdmin(id);
			response.status(204).send();
		} catch (error) {
			handleError(error, response);
		}
	};

	listGuests = async (_request: Request, response: Response): Promise<void> => {
		response.json({ data: await this.service.listGuests() });
	};

	getGuest = async (request: Request, response: Response): Promise<void> => {
		const id = routeId(request, response);
		if (!id) return;
		const guest = await this.service.findGuest(id);
		if (!guest) {
			response.status(404).json({ error: 'USUARIO_NO_ENCONTRADO' });
			return;
		}
		response.json({ data: guest });
	};

	createGuest = async (request: Request, response: Response): Promise<void> => {
		if (!isObject(request.body) || !hasStrings(request.body, ['cognitoSub', 'name', 'email'])) {
			response.status(400).json({ error: 'DATOS_GUEST_INVALIDOS' });
			return;
		}

		try {
			const input: CreateGuestInput = {
				cognitoSub: request.body.cognitoSub as string,
				name: request.body.name as string,
				email: request.body.email as string,
				phone: typeof request.body.phone === 'string' ? request.body.phone : undefined,
				active: request.body.active !== false
			};
			response.status(201).json({ data: await this.service.createGuest(input) });
		} catch (error) {
			handleError(error, response);
		}
	};

	updateGuest = async (request: Request, response: Response): Promise<void> => {
		if (!isObject(request.body)) {
			response.status(400).json({ error: 'DATOS_GUEST_INVALIDOS' });
			return;
		}
		const id = routeId(request, response);
		if (!id) return;
		try {
			response.json({ data: await this.service.updateGuest(id, request.body as UpdateGuestInput) });
		} catch (error) {
			handleError(error, response);
		}
	};

	deleteGuest = async (request: Request, response: Response): Promise<void> => {
		const id = routeId(request, response);
		if (!id) return;
		try {
			await this.service.deleteGuest(id);
			response.status(204).send();
		} catch (error) {
			handleError(error, response);
		}
	};
}