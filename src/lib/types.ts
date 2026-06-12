export type Employee = {
  id: string;
  name: string;
  qrCode: string;
  role: "Worker" | "Supervisor";
  status: "Active" | "Inactive";
  sickHoursBalance?: number; // Accumulated sick hours available
  totalHoursWorked?: number; // Total hours worked for sick hours calculation
};

export type Client = {
  id: string;
  name: string;
  billingAddress: string;
  paymentTerms: string;
  email?: string;
  phone?: string;
  commissionRate?: number;
  minimumWage?: number;
  minimumWageForPayroll?: number;
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
  piecesWorked?: number;
  paymentModality?: "Hourly" | "Piecework";
  isSickLeave?: boolean; // Whether this entry uses sick hours
  sickHoursUsed?: number; // Number of sick hours used for this entry
  useSickHoursForPayment?: boolean; // Whether employee wants to use sick hours to pay for this shift
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
  taskId: string;
  taskName: string;
  clientName: string;
  ranch?: string;
  block?: string;
  hours: number;
  pieceworkCount: number;
  totalEarnings: number;
  taskType?: "hourly" | "piece"; // Task rate type for display
  rate?: number; // Hourly rate or piece price for display
};

export type DailyBreakdown = {
  date: string;
  tasks: DailyTaskDetail[];
  totalDailyHours: number;
  totalDailyEarnings: number;
};

export type PiecesByVariety = {
  taskName: string;
  variety: string;
  totalPieces: number;
  price?: number;
};

export type WeeklySummary = {
  weekNumber: number;
  year: number;
  totalHours: number;
  totalEarnings: number; // Raw earnings from tasks
  minimumWageTopUp: number;
  paidRestBreaks: number;
  overtimeHours?: number; // Hours worked over 40 in the week
  overtimePremium?: number; // Additional pay for overtime (0.5x regular rate)
  regularRate?: number; // Calculated regular rate for the week
  finalPay: number; // totalEarnings + topUp + restBreaks + overtimePremium
  dailyBreakdown: DailyBreakdown[];
  sickHoursAccrued?: number; // Sick hours earned this week
  totalPieces?: number; // Total pieces for the week
  piecesByVariety?: PiecesByVariety[]; // Pieces broken down by task/variety
};

export type EmployeePayrollSummary = {
  employeeId: string;
  employeeName: string;
  weeklySummaries: WeeklySummary[];
  finalPay: number;
  totalSickHoursAccrued?: number; // Total sick hours accrued in this period
  newSickHoursBalance?: number; // Updated sick hours balance after this period
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
  overtimePremium?: number; // Additional overtime pay
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

import type { Timestamp } from "firebase/firestore";

export interface SavedInvoiceTaskDetail {
  taskName: string;
  hours: number;
  pieces: number;
  cost: number;
  clientRate: number;
  clientRateType: "hourly" | "piece";
}

export interface SavedInvoiceDayBreakdown {
  tasks: Record<string, SavedInvoiceTaskDetail>;
  total: number;
}

export interface SavedInvoiceClientSnapshot {
  name: string;
  billingAddress?: string;
  email?: string;
  phone?: string;
  commissionRate?: number;
  paymentTerms?: string;
  minimumWage?: number;
}

export interface SavedInvoice {
  id?: string;
  invoiceNumber: string;
  invoiceDate: string;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  dateFrom: string;
  dateTo: string;
  laborCost: number;
  minimumWageTopUp: number;
  paidRestBreaks: number;
  overtimePremium?: number;
  overtimeHours?: number;
  subtotal: number;
  commission: number;
  total: number;
  status: "pending" | "paid";
  createdAt: Timestamp | Date | null;
  sentAt?: Timestamp | Date | null;
  paidAt?: Timestamp | Date | null;
  emailSentCount?: number;
  dailyBreakdown?: Record<string, SavedInvoiceDayBreakdown>;
  employeeDetails?: unknown[];
  invoiceClientData?: SavedInvoiceClientSnapshot;
  /** When true, late fees have been waived and are treated as $0 */
  waivedLateFees?: boolean;
  /** Amount of overdue interest added when creating an overdue-interest invoice */
  overdueInterestAccrued?: number;
  /** Whether this invoice was generated together with a Labor Report */
  includeLaborReport?: boolean;
  /** Employee details used for the labor report PDF (includes overtime fields) */
  laborReportEmployeeDetails?: Array<{
    employeeName: string;
    employeeId: string;
    totalHours: number;
    totalPieces: number;
    paidRestBreaks: number;
    minimumWageTopUp: number;
    overtimeHours?: number;
    overtimePremium?: number;
    regularRate?: number;
    tasksSummary: Array<{
      taskName: string;
      quantity: number;
      rate: number;
      rateType: "hourly" | "piece";
      cost: number;
    }>;
  }>;
}

export interface AccountingCompletion {
  id?: string;
  workerId: string;
  periodStart: string;
  periodEnd: string;
  completedAt: Timestamp | Date | null;
  completedBy: string;
}

export interface SoundSettings {
  id?: string;
  userId?: string;
  companyId?: string;
  clockInSound: string;
  clockOutSound: string;
  pieceworkSound: string;
  volume: number;
  vibrationEnabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SoundOption {
  id: string;
  name: string;
  description: string;
  category:
    | "notification"
    | "alarm"
    | "musical"
    | "nature"
    | "industrial"
    | "custom";
  frequencies: number[];
  durations: number[];
  gaps: number[];
  waveType: OscillatorType;
  vibrationPattern?: number[];
}

export const AVAILABLE_SOUNDS: SoundOption[] = [
  // Notification Sounds
  {
    id: "notification-soft",
    name: "🔔 Soft Bell",
    description: "Gentle notification sound",
    category: "notification",
    frequencies: [800, 600],
    durations: [0.15, 0.3],
    gaps: [0.05, 0],
    waveType: "sine",
    vibrationPattern: [150, 75, 150],
  },
  {
    id: "notification-chime",
    name: "🎐 Wind Chime",
    description: "Pleasant chime sound",
    category: "notification",
    frequencies: [523, 659, 784],
    durations: [0.2, 0.2, 0.4],
    gaps: [0.1, 0.1, 0],
    waveType: "sine",
    vibrationPattern: [100, 50, 100, 50, 200],
  },
  {
    id: "notification-ding",
    name: "🔔 Quick Ding",
    description: "Sharp notification ding",
    category: "notification",
    frequencies: [1000],
    durations: [0.2],
    gaps: [0],
    waveType: "triangle",
    vibrationPattern: [200],
  },

  // Alarm Sounds
  {
    id: "alarm-classic",
    name: "🚨 Classic Alarm",
    description: "Traditional alarm sound",
    category: "alarm",
    frequencies: [800, 1000, 800, 1000, 800, 1000],
    durations: [0.25, 0.25, 0.25, 0.25, 0.25, 0.25],
    gaps: [0.1, 0.1, 0.1, 0.1, 0.1, 0],
    waveType: "square",
    vibrationPattern: [200, 100, 200, 100, 200, 100, 300],
  },
  {
    id: "alarm-siren",
    name: "🚁 Emergency Siren",
    description: "Rising and falling siren",
    category: "alarm",
    frequencies: [400, 800, 1200, 800, 400],
    durations: [0.2, 0.2, 0.2, 0.2, 0.2],
    gaps: [0, 0, 0, 0, 0],
    waveType: "sawtooth",
    vibrationPattern: [200, 100, 200, 100, 300],
  },
  {
    id: "alarm-beeper",
    name: "📟 Beeper Alert",
    description: "Rapid beeping alarm",
    category: "alarm",
    frequencies: [1200, 1200, 1200],
    durations: [0.1, 0.1, 0.1],
    gaps: [0.05, 0.05, 0],
    waveType: "square",
    vibrationPattern: [100, 50, 100, 50, 100],
  },

  // Musical Sounds
  {
    id: "musical-success",
    name: "🎵 Success Fanfare",
    description: "Triumphant success melody",
    category: "musical",
    frequencies: [523, 659, 784, 1047],
    durations: [0.15, 0.15, 0.15, 0.5],
    gaps: [0.05, 0.05, 0.05, 0],
    waveType: "triangle",
    vibrationPattern: [100, 50, 100, 50, 300],
  },
  {
    id: "musical-mario",
    name: "🍄 Mario Coin",
    description: "Classic video game coin sound",
    category: "musical",
    frequencies: [1319, 1568, 2637, 2093],
    durations: [0.1, 0.1, 0.1, 0.3],
    gaps: [0.02, 0.02, 0.02, 0],
    waveType: "square",
    vibrationPattern: [50, 25, 50, 25, 200],
  },
  {
    id: "musical-doorbell",
    name: "🚪 Doorbell",
    description: "Classic doorbell chime",
    category: "musical",
    frequencies: [659, 523],
    durations: [0.3, 0.6],
    gaps: [0.1, 0],
    waveType: "sine",
    vibrationPattern: [200, 100, 400],
  },
  {
    id: "musical-scale",
    name: "🎼 Rising Scale",
    description: "Musical scale progression",
    category: "musical",
    frequencies: [261, 294, 330, 349, 392, 440, 494, 523],
    durations: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.2],
    gaps: [0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0],
    waveType: "sine",
    vibrationPattern: [50, 25, 50, 25, 50, 25, 50, 25, 200],
  },

  // Nature Sounds (Synthetic)
  {
    id: "nature-bird",
    name: "🐦 Bird Chirp",
    description: "Synthetic bird chirping",
    category: "nature",
    frequencies: [2000, 1800, 2200, 1900],
    durations: [0.1, 0.05, 0.1, 0.15],
    gaps: [0.02, 0.02, 0.02, 0],
    waveType: "sine",
    vibrationPattern: [100, 50, 100],
  },
  {
    id: "nature-water",
    name: "💧 Water Drop",
    description: "Gentle water drop sound",
    category: "nature",
    frequencies: [800, 400, 200],
    durations: [0.1, 0.2, 0.3],
    gaps: [0.05, 0.05, 0],
    waveType: "sine",
    vibrationPattern: [150],
  },

  // Industrial Sounds
  {
    id: "industrial-horn",
    name: "📯 Air Horn",
    description: "Loud industrial horn",
    category: "industrial",
    frequencies: [200, 220, 200],
    durations: [0.3, 0.3, 0.4],
    gaps: [0.05, 0.05, 0],
    waveType: "sawtooth",
    vibrationPattern: [300, 100, 300],
  },
  {
    id: "industrial-buzzer",
    name: "⚡ Electric Buzzer",
    description: "Sharp electric buzzer",
    category: "industrial",
    frequencies: [100, 120, 100, 120],
    durations: [0.2, 0.2, 0.2, 0.2],
    gaps: [0.05, 0.05, 0.05, 0],
    waveType: "square",
    vibrationPattern: [200, 100, 200, 100, 200],
  },
  {
    id: "industrial-machinery",
    name: "⚙️ Machinery Beep",
    description: "Heavy machinery warning beep",
    category: "industrial",
    frequencies: [440, 440, 440],
    durations: [0.5, 0.5, 0.5],
    gaps: [0.2, 0.2, 0],
    waveType: "square",
    vibrationPattern: [400, 200, 400, 200, 400],
  },
];
