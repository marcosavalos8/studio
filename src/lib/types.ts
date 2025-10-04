export type Employee = {
  id: string;
  name: string;
  qrCode: string;
  role: 'Worker' | 'Supervisor';
  status: 'Active' | 'Inactive';
};

export type Client = {
  id: string;
  name: string;
  billingAddress: string;
  paymentTerms: string;
  email?: string;
  commissionRate?: number;
  minimumWage?: number;
  contractType?: 'Standard' | 'H2A';
};

export type Task = {
  id: string;
  name: string;
  variety?: string;
  ranch?: string;
  block?: string;
  clientId: string; // client id
  clientRate: number;
  clientRateType: 'hourly' | 'piece';
  employeePayType: 'hourly' | 'piecework';
  employeeRate: number;
  status: 'Active' | 'Inactive' | 'Completed';
};

export type TimeEntry = {
  id: string;
  employeeId: string;
  taskId: string;
  timestamp: Date;
  endTime?: Date | null;
  isBreak: boolean;
  breakReason?: 'Paid' | 'Unpaid Meal';
};

export type Piecework = {
  id: string;
  employeeId:string;
  taskId: string;
  timestamp: Date;
  pieceCount: number;
  pieceQrCode: string;
  qcNote?: string;
};

export type SharedPieceLog = {
  id: string;
  employeeIds: string[];
  taskId: string;
  timestamp: Date;
  quantity: number;
  qcNote?: string;
};

    
