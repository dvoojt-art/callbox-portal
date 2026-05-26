export interface Link {
  id: string;
  title: string;
  url: string;
  description: string;
  category: string;
  addedBy: string;
  createdAt: string;
  forInactive?: boolean;
}

export interface Employee {
  email: string;
  addedAt: string;
  role?: "viewer" | "admin";
  passcode?: string;
}

export interface Session {
  role: 'admin' | 'employee' | 'inactive';
  email?: string;
}
