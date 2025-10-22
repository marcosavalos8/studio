export type Employee = {
  id: string;
  name: string;
  qrCode: string;
  role: "Worker" | "Supervisor";
  status: "Active" | "Inactive";
};

export type Client = {
  id: string;
  name: string;
  billingAddress: string;
  paymentTerms: string;
  email?: string;
  commissionRate?: number;
  minimumWage?: number;
  contractType?: "Standard" | "H2A";
};

export type Task = {
  id: string;
  name: string;
  variety?: string;
  ranch?: string;
  block?: string;
  clientId: string; // client id
  clientRate: number;
  clientRateType: "hourly" | "piece";
  piecePrice?: number;
  status: "Active" | "Inactive" | "Completed";
};

export type TimeEntry = {
  id: string;
  employeeId: string;
  taskId: string;
  timestamp: Date;
  endTime?: Date | null;
  isBreak: boolean;
  breakReason?: "Paid" | "Unpaid Meal";
};

export type Piecework = {
  id: string;
  employeeId: string;
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
  totalEarnings: number;
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
  totalEarnings: number; // Raw earnings from tasks
  minimumWageTopUp: number;
  paidRestBreaks: number;
  finalPay: number; // totalEarnings + topUp + restBreaks
  dailyBreakdown: DailyBreakdown[];
};

export type EmployeePayrollSummary = {
  employeeId: string;
  employeeName: string;
  weeklySummaries: WeeklySummary[];
  finalPay: number;
};

export type ProcessedPayrollData = {
  startDate: string;
  endDate: string;
  payDate: string;
  employeeSummaries: EmployeePayrollSummary[];
};

export interface InvoiceData {
  client: Client;
  date: {
    from: string;
    to: string;
  };
  dailyBreakdown: Record<string, DailyBreakdownEntry>;
  laborCost: number;
  minimumWageTopUp: number;
  paidRestBreaks: number;
  subtotal: number;
  commission: number;
  total: number;
}

export interface DailyBreakdownEntry {
  date: string;
  tasks: Record<
    string,
    {
      name: string;
      hours: number;
      pieces: number;
      clientRate: number;
      clientRateType: "hourly" | "piecework";
      cost: number;
    }
  >;
  total: number;
}
