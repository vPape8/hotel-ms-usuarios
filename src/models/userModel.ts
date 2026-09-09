export type AdminRole = 'ADMIN' | 'EMPLOYEE';

export interface IAdmin {
	id: string;
	entraId: string;
	name: string;
	email: string;
	role: AdminRole;
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface IGuest {
	id: string;
	cognitoSub: string;
	name: string;
	email: string;
	phone?: string;
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export type CreateAdminInput = Omit<IAdmin, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateAdminInput = Partial<CreateAdminInput>;
export type CreateGuestInput = Omit<IGuest, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateGuestInput = Partial<CreateGuestInput>;