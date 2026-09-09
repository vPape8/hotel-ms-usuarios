import {
	CreateAdminInput,
	CreateGuestInput,
	IAdmin,
	IGuest,
	UpdateAdminInput,
	UpdateGuestInput
} from '../models/userModel';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { Pool } from 'mysql2/promise';

export interface UserRepository {
	listAdmins(): Promise<IAdmin[]>;
	findAdmin(id: string): Promise<IAdmin | undefined>;
	findAdminByEntraId(entraId: string): Promise<IAdmin | undefined>;
	createAdmin(input: CreateAdminInput): Promise<IAdmin>;
	updateAdmin(id: string, input: UpdateAdminInput): Promise<IAdmin | undefined>;
	deleteAdmin(id: string): Promise<boolean>;
	listGuests(): Promise<IGuest[]>;
	findGuest(id: string): Promise<IGuest | undefined>;
	findGuestByCognitoSub(cognitoSub: string): Promise<IGuest | undefined>;
	createGuest(input: CreateGuestInput): Promise<IGuest>;
	updateGuest(id: string, input: UpdateGuestInput): Promise<IGuest | undefined>;
	deleteGuest(id: string): Promise<boolean>;
}

export class InMemoryUserRepository implements UserRepository {
	admins = new Map<string, IAdmin>();
	guests = new Map<string, IGuest>();

	async listAdmins(): Promise<IAdmin[]> { return [...this.admins.values()]; }
	async findAdmin(id: string): Promise<IAdmin | undefined> { return this.admins.get(id); }
	async findAdminByEntraId(entraId: string): Promise<IAdmin | undefined> {
		return [...this.admins.values()].find((admin) => admin.entraId === entraId);
	}
	async createAdmin(input: CreateAdminInput): Promise<IAdmin> {
		const now = new Date();
		const admin: IAdmin = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
		this.admins.set(admin.id, admin);
		return admin;
	}
	async updateAdmin(id: string, input: UpdateAdminInput): Promise<IAdmin | undefined> {
		const current = this.admins.get(id);
		if (!current) return undefined;
		const updated = { ...current, ...input, updatedAt: new Date() };
		this.admins.set(id, updated);
		return updated;
	}
	async deleteAdmin(id: string): Promise<boolean> { return this.admins.delete(id); }
	async listGuests(): Promise<IGuest[]> { return [...this.guests.values()]; }
	async findGuest(id: string): Promise<IGuest | undefined> { return this.guests.get(id); }
	async findGuestByCognitoSub(cognitoSub: string): Promise<IGuest | undefined> {
		return [...this.guests.values()].find((guest) => guest.cognitoSub === cognitoSub);
	}
	async createGuest(input: CreateGuestInput): Promise<IGuest> {
		const now = new Date();
		const guest: IGuest = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
		this.guests.set(guest.id, guest);
		return guest;
	}
	async updateGuest(id: string, input: UpdateGuestInput): Promise<IGuest | undefined> {
		const current = this.guests.get(id);
		if (!current) return undefined;
		const updated = { ...current, ...input, updatedAt: new Date() };
		this.guests.set(id, updated);
		return updated;
	}
	async deleteGuest(id: string): Promise<boolean> { return this.guests.delete(id); }
}

interface AdminRow extends RowDataPacket {
	id: string;
	entra_id: string;
	name: string;
	email: string;
	role: 'ADMIN' | 'EMPLOYEE';
	active: number;
	created_at: Date;
	updated_at: Date;
}

interface GuestRow extends RowDataPacket {
	id: string;
	cognito_sub: string;
	name: string;
	email: string;
	phone: string | null;
	active: number;
	created_at: Date;
	updated_at: Date;
}

function toAdmin(row: AdminRow): IAdmin {
	return { id: row.id, entraId: row.entra_id, name: row.name, email: row.email, role: row.role,
		active: Boolean(row.active), createdAt: row.created_at, updatedAt: row.updated_at };
}

function toGuest(row: GuestRow): IGuest {
	return { id: row.id, cognitoSub: row.cognito_sub, name: row.name, email: row.email,
		phone: row.phone ?? undefined, active: Boolean(row.active), createdAt: row.created_at, updatedAt: row.updated_at };
}

export class MySqlUserRepository implements UserRepository {
	constructor(private readonly pool: Pool) {}

	async listAdmins(): Promise<IAdmin[]> {
		const [rows] = await this.pool.query<AdminRow[]>('SELECT * FROM admins ORDER BY created_at DESC');
		return rows.map(toAdmin);
	}
	async findAdmin(id: string): Promise<IAdmin | undefined> {
		const [rows] = await this.pool.query<AdminRow[]>('SELECT * FROM admins WHERE id = ?', [id]);
		return rows[0] ? toAdmin(rows[0]) : undefined;
	}
	async findAdminByEntraId(entraId: string): Promise<IAdmin | undefined> {
		const [rows] = await this.pool.query<AdminRow[]>('SELECT * FROM admins WHERE entra_id = ?', [entraId]);
		return rows[0] ? toAdmin(rows[0]) : undefined;
	}
	async createAdmin(input: CreateAdminInput): Promise<IAdmin> {
		const admin: IAdmin = { ...input, id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() };
		await this.pool.execute<ResultSetHeader>(
			'INSERT INTO admins (id, entra_id, name, email, role, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
			[admin.id, admin.entraId, admin.name, admin.email, admin.role, admin.active, admin.createdAt, admin.updatedAt]
		);
		return admin;
	}
	async updateAdmin(id: string, input: UpdateAdminInput): Promise<IAdmin | undefined> {
		const current = await this.findAdmin(id);
		if (!current) return undefined;
		const updated = { ...current, ...input, updatedAt: new Date() };
		await this.pool.execute<ResultSetHeader>(
			'UPDATE admins SET entra_id = ?, name = ?, email = ?, role = ?, active = ?, updated_at = ? WHERE id = ?',
			[updated.entraId, updated.name, updated.email, updated.role, updated.active, updated.updatedAt, id]
		);
		return updated;
	}
	async deleteAdmin(id: string): Promise<boolean> {
		const [result] = await this.pool.execute<ResultSetHeader>('DELETE FROM admins WHERE id = ?', [id]);
		return result.affectedRows > 0;
	}
	async listGuests(): Promise<IGuest[]> {
		const [rows] = await this.pool.query<GuestRow[]>('SELECT * FROM guests ORDER BY created_at DESC');
		return rows.map(toGuest);
	}
	async findGuest(id: string): Promise<IGuest | undefined> {
		const [rows] = await this.pool.query<GuestRow[]>('SELECT * FROM guests WHERE id = ?', [id]);
		return rows[0] ? toGuest(rows[0]) : undefined;
	}
	async findGuestByCognitoSub(cognitoSub: string): Promise<IGuest | undefined> {
		const [rows] = await this.pool.query<GuestRow[]>('SELECT * FROM guests WHERE cognito_sub = ?', [cognitoSub]);
		return rows[0] ? toGuest(rows[0]) : undefined;
	}
	async createGuest(input: CreateGuestInput): Promise<IGuest> {
		const guest: IGuest = { ...input, id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() };
		await this.pool.execute<ResultSetHeader>(
			'INSERT INTO guests (id, cognito_sub, name, email, phone, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
			[guest.id, guest.cognitoSub, guest.name, guest.email, guest.phone ?? null, guest.active, guest.createdAt, guest.updatedAt]
		);
		return guest;
	}
	async updateGuest(id: string, input: UpdateGuestInput): Promise<IGuest | undefined> {
		const current = await this.findGuest(id);
		if (!current) return undefined;
		const updated = { ...current, ...input, updatedAt: new Date() };
		await this.pool.execute<ResultSetHeader>(
			'UPDATE guests SET cognito_sub = ?, name = ?, email = ?, phone = ?, active = ?, updated_at = ? WHERE id = ?',
			[updated.cognitoSub, updated.name, updated.email, updated.phone ?? null, updated.active, updated.updatedAt, id]
		);
		return updated;
	}
	async deleteGuest(id: string): Promise<boolean> {
		const [result] = await this.pool.execute<ResultSetHeader>('DELETE FROM guests WHERE id = ?', [id]);
		return result.affectedRows > 0;
	}
}

export class UserService {
	constructor(private readonly repository: UserRepository = new InMemoryUserRepository()) {}

	async listAdmins(): Promise<IAdmin[]> { return this.repository.listAdmins(); }
	async findAdmin(id: string): Promise<IAdmin | undefined> { return this.repository.findAdmin(id); }

	async createAdmin(input: CreateAdminInput): Promise<IAdmin> {
		if (await this.repository.findAdminByEntraId(input.entraId)) {
			throw new UserConflictError('El administrador ya existe');
		}
		return this.repository.createAdmin(input);
	}

	async updateAdmin(id: string, input: UpdateAdminInput): Promise<IAdmin> {
		const current = await this.repository.findAdmin(id);
		if (!current) {
			throw new UserNotFoundError('Administrador no encontrado');
		}
		if (input.entraId && input.entraId !== current.entraId && await this.repository.findAdminByEntraId(input.entraId)) {
			throw new UserConflictError('El administrador ya existe');
		}
		return (await this.repository.updateAdmin(id, input))!;
	}

	async deleteAdmin(id: string): Promise<void> {
		if (!await this.repository.deleteAdmin(id)) {
			throw new UserNotFoundError('Administrador no encontrado');
		}
	}

	async listGuests(): Promise<IGuest[]> { return this.repository.listGuests(); }
	async findGuest(id: string): Promise<IGuest | undefined> { return this.repository.findGuest(id); }

	async createGuest(input: CreateGuestInput): Promise<IGuest> {
		if (await this.repository.findGuestByCognitoSub(input.cognitoSub)) {
			throw new UserConflictError('El huésped ya existe');
		}
		return this.repository.createGuest(input);
	}

	async updateGuest(id: string, input: UpdateGuestInput): Promise<IGuest> {
		const current = await this.repository.findGuest(id);
		if (!current) {
			throw new UserNotFoundError('Huésped no encontrado');
		}
		if (input.cognitoSub && input.cognitoSub !== current.cognitoSub && await this.repository.findGuestByCognitoSub(input.cognitoSub)) {
			throw new UserConflictError('El huésped ya existe');
		}
		return (await this.repository.updateGuest(id, input))!;
	}

	async deleteGuest(id: string): Promise<void> {
		if (!await this.repository.deleteGuest(id)) {
			throw new UserNotFoundError('Huésped no encontrado');
		}
	}
}

export class UserNotFoundError extends Error {}
export class UserConflictError extends Error {}