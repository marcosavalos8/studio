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

// Define schemas for our processed data. This is what the tool will output.
export type DailyTaskDetail = {
  taskName: string;
  clientName: string;
  ranch?: string;
  block?: string;
  hours: number;
  pieceworkCount: number;
  hourlyEarnings: number;
  pieceworkEarnings: number;
};

export type DailyBreakdown = {
  date: string;
  tasks: DailyTaskDetail[];
  totalDailyHours: number;
  totalDailyEarnings: number;
};

export type WeeklySummary = {
    weekNumber: number;
    year: number;
    totalHours: number;
    totalPieceworkEarnings: number;
    totalHourlyEarnings: number;
    totalEarnings: number;
    effectiveHourlyRate: number;
    minimumWageTopUp: number;
    paidRestBreaksTotal: number;
    dailyBreakdown: DailyBreakdown[];
};

export type EmployeePayrollSummary = {
    employeeId: string;
    employeeName: string;
    weeklySummaries: WeeklySummary[];
    overallTotalEarnings: number;
    overallTotalHours: number;
    overallTotalMinimumWageTopUp: number;
    overallTotalPaidRestBreaks: number;
    finalPay: number;
};

export type ProcessedPayrollData = {
    startDate: string;
    endDate: string;
    payDate: string;
    employeeSummaries: EmployeePayrollSummary[];
};
    
