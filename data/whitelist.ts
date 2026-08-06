export interface Whitelist {
  email: string;
  addedBy?: string | null;
  addedAt?: Date;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WhitelistModel {
  _id?: string;
  email: string;
  addedBy?: string | null;
  addedAt?: Date;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

