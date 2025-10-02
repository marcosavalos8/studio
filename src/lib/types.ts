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
};

export type Task = {
  id: string;
  name: string;
  variety?: string;
  ranch?: string;
  block?: string;
  client: string; // client name
  clientRate: number;
  clientRateType: 'hourly' | 'piece';
  employeePayType: 'hourly' | 'piecework';
  employeeRate: number;
  status: 'Active' | 'Inactive' | 'Completed';
};

export type TimeLog = {
  id: string;
  employeeId: string;
  taskId: string;
  startTime: Date;
  endTime: Date;
  isBreak: boolean;
  breakReason?: 'Paid' | 'Unpaid Meal';
};

export type PieceLog = {
  id: string;
  employeeId:string;
  taskId: string;
  timestamp: Date;
  quantity: number;
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

    