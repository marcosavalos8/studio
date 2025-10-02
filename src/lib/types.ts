export type Employee = {
  id: string;
  name: string;
  qrCode: string;
  role: 'Worker' | 'Supervisor';
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
  timestamp: Date;
  latitude: number;
  longitude: number;
  isBreak: boolean;
  breakReason?: 'Paid' | 'Unpaid Meal';
};

export type PieceLog = {
  id: string;
  employeeId:string;
  timestamp: Date;
  quantity: number;
  pieceScannedQr: string;
  qcNote?: string;
};
