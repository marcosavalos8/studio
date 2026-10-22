"use client";

import * as React from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarIcon, Loader2, Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { cn, toLocalMidnight, parseLocalDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { useAuth } from "@/contexts/auth-context";
import { useUser } from "@/firebase/auth/use-user";
import { useCompanyInfo } from "@/hooks/use-company-info";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import type { Client, Contract, ContractStatus } from "@/lib/types";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { generateContractNumber } from "./contract-numbering";
import { buildContractTemplateHtml, sanitizeContractHtml } from "./contract-template";
import { ContractClausesEditor } from "./contract-clauses-editor";

const CONTRACT_STATUSES: ContractStatus[] = [
  "Draft",
  "Active",
  "Completed",
  "Terminated",
  "Expired",
];

// A brand-new contract only ever starts out Draft or Active — the other
// statuses describe how a contract that already existed came to a close,
// which is reached later through Edit (or the quick Complete/Terminate
// actions in the contract list), not at creation time.
const CREATE_STATUSES: ContractStatus[] = ["Draft", "Active"];

const EMPTY_CLAUSES = "<p></p>";

// Firestore rejects a field whose value is explicitly `undefined` (addDoc/
// updateDoc throw) — an empty optional number/text input in this form
// naturally produces `undefined` here, so every object written to
// Firestore is passed through this first to drop those keys entirely
// (an absent field, unlike `undefined`, is perfectly fine).
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as T;
  (Object.keys(obj) as Array<keyof T>).forEach((key) => {
    if (obj[key] !== undefined) result[key] = obj[key];
  });
  return result;
}

const contractFormSchema = z
  .object({
    title: z.string().min(1, "Contract title is required"),
    status: z.enum(["Draft", "Active", "Completed", "Terminated", "Expired"]),
    effectiveDate: z.date({ required_error: "Effective date is required" }),
    endDate: z.date().optional(),
    clientName: z.string().min(1, "Client name is required"),
    clientEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
    clientPhone: z.string().optional().or(z.literal("")),
    billingAddress: z.string().min(1, "Billing address is required"),
    paymentTerms: z.string().min(1, "Payment terms are required"),
    contractType: z.enum(["Standard", "H2A"]).optional(),
    minimumWage: z.coerce.number().min(0).optional(),
    minimumWageForPayroll: z.coerce.number().min(0).optional(),
    commissionRate: z.coerce.number().min(0).optional(),
    paymentDueDays: z.coerce.number().min(0).optional(),
    lateFeeInterestPercent: z.coerce.number().min(0).optional(),
    terminationNoticeDays: z.coerce.number().min(0).optional(),
    cancellationNoticeDays: z.coerce.number().min(0).optional(),
    shortfallPenaltyPercent: z.coerce.number().min(0).optional(),
    shortfallFeePerWorkerDay: z.coerce.number().min(0).optional(),
    clauses: z.string().min(1, "Contract content cannot be empty"),
  })
  .refine((data) => !data.endDate || data.endDate >= data.effectiveDate, {
    message: "End date cannot be before the effective date",
    path: ["endDate"],
  });

type ContractFormValues = z.infer<typeof contractFormSchema>;

type ContractFormDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  client: Client;
  // Present when editing an existing contract; absent when creating a new one.
  contract?: Contract;
};

function valuesFromClient(client: Client): Partial<ContractFormValues> {
  return {
    clientName: client.name,
    clientEmail: client.email ?? "",
    clientPhone: client.phone ?? "",
    billingAddress: client.billingAddress,
    paymentTerms: client.paymentTerms,
    contractType: client.contractType ?? "Standard",
    minimumWage: client.minimumWage,
    minimumWageForPayroll: client.minimumWageForPayroll,
    commissionRate: client.commissionRate,
  };
}

function valuesFromContract(contract: Contract): ContractFormValues {
  const snap = contract.clientSnapshot;
  return {
    title: contract.title,
    status: contract.status,
    effectiveDate: parseLocalDate(contract.effectiveDate),
    endDate: contract.endDate ? parseLocalDate(contract.endDate) : undefined,
    clientName: snap.name,
    clientEmail: snap.email ?? "",
    clientPhone: snap.phone ?? "",
    billingAddress: snap.billingAddress,
    paymentTerms: snap.paymentTerms,
    contractType: snap.contractType ?? "Standard",
    minimumWage: snap.minimumWage,
    minimumWageForPayroll: snap.minimumWageForPayroll,
    commissionRate: snap.commissionRate,
    paymentDueDays: contract.paymentDueDays,
    lateFeeInterestPercent: contract.lateFeeInterestPercent,
    terminationNoticeDays: contract.terminationNoticeDays,
    cancellationNoticeDays: contract.cancellationNoticeDays,
    shortfallPenaltyPercent: contract.shortfallPenaltyPercent,
    shortfallFeePerWorkerDay: contract.shortfallFeePerWorkerDay,
    clauses: contract.clauses || EMPTY_CLAUSES,
  };
}

export function ContractFormDialog({
  isOpen,
  onOpenChange,
  client,
  contract,
}: ContractFormDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { username } = useAuth();
  const { user } = useUser();
  const { companyInfo } = useCompanyInfo();
  const isEdit = !!contract;

  const [isSaving, setIsSaving] = React.useState(false);
  // Holds a submission that needs confirmation (status moving to Completed
  // or Terminated) before it's actually written.
  const [pendingSubmit, setPendingSubmit] = React.useState<ContractFormValues | null>(null);

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: contract
      ? valuesFromContract(contract)
      : {
          title: "",
          status: "Draft",
          effectiveDate: toLocalMidnight(new Date())!,
          endDate: undefined,
          clauses: EMPTY_CLAUSES,
          ...valuesFromClient(client),
        },
  });

  // Reset the form whenever a different contract (or create-mode) is opened,
  // so reopening the dialog for a different row never shows stale values.
  React.useEffect(() => {
    if (!isOpen) return;
    form.reset(
      contract
        ? valuesFromContract(contract)
        : {
            title: "",
            status: "Draft",
            effectiveDate: toLocalMidnight(new Date())!,
            endDate: undefined,
            clauses: EMPTY_CLAUSES,
            ...valuesFromClient(client),
          },
    );
    setPendingSubmit(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, contract?.id, client.id]);

  const handleGenerateTemplate = () => {
    const current = form.getValues("clauses");
    const hasContent = !!current && current.trim() !== "" && current.trim() !== EMPTY_CLAUSES;
    if (
      hasContent &&
      !window.confirm(
        "This will replace the current contract text with a fresh template. Continue?",
      )
    ) {
      return;
    }
    const values = form.getValues();
    const html = buildContractTemplateHtml({
      companyInfo,
      clientName: values.clientName,
      clientAddress: values.billingAddress,
      effectiveDateDisplay: values.effectiveDate
        ? format(values.effectiveDate, "MM/dd/yyyy")
        : undefined,
      paymentDueDays: values.paymentDueDays,
      lateFeeInterestPercent: values.lateFeeInterestPercent,
      terminationNoticeDays: values.terminationNoticeDays,
      cancellationNoticeDays: values.cancellationNoticeDays,
      shortfallPenaltyPercent: values.shortfallPenaltyPercent,
      shortfallFeePerWorkerDay: values.shortfallFeePerWorkerDay,
    });
    form.setValue("clauses", html, { shouldDirty: true });
  };

  const writeContract = async (values: ContractFormValues) => {
    if (!firestore) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Firestore is not available. Please try again later.",
      });
      return;
    }
    setIsSaving(true);
    try {
      const clientSnapshot = stripUndefined({
        name: values.clientName,
        email: values.clientEmail || undefined,
        phone: values.clientPhone || undefined,
        billingAddress: values.billingAddress,
        paymentTerms: values.paymentTerms,
        contractType: values.contractType,
        minimumWage: values.minimumWage,
        minimumWageForPayroll: values.minimumWageForPayroll,
        commissionRate: values.commissionRate,
      });
      const common = stripUndefined({
        title: values.title,
        status: values.status,
        effectiveDate: format(values.effectiveDate, "yyyy-MM-dd"),
        endDate: values.endDate ? format(values.endDate, "yyyy-MM-dd") : null,
        clientSnapshot,
        paymentDueDays: values.paymentDueDays,
        lateFeeInterestPercent: values.lateFeeInterestPercent,
        terminationNoticeDays: values.terminationNoticeDays,
        cancellationNoticeDays: values.cancellationNoticeDays,
        shortfallPenaltyPercent: values.shortfallPenaltyPercent,
        shortfallFeePerWorkerDay: values.shortfallFeePerWorkerDay,
        clauses: sanitizeContractHtml(values.clauses),
      });

      if (isEdit && contract) {
        const ref = doc(firestore, "contracts", contract.id);
        await updateDoc(ref, {
          ...common,
          updatedAt: serverTimestamp(),
          updatedByUid: user?.uid ?? null,
          updatedByName: username ?? null,
        });
        toast({
          title: "Contract updated",
          description: `${contract.contractNumber} has been saved.`,
        });
      } else {
        const contractNumber = await generateContractNumber(firestore);
        await addDoc(collection(firestore, "contracts"), {
          ...common,
          clientId: client.id,
          contractNumber,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdByUid: user?.uid ?? null,
          createdByName: username ?? null,
        });
        toast({
          title: "Contract created",
          description: `${contractNumber} has been created for ${client.name}.`,
        });
      }
      onOpenChange(false);
    } catch (err) {
      const path = isEdit && contract ? `contracts/${contract.id}` : "contracts";
      const permissionError = new FirestorePermissionError({
        path,
        operation: isEdit ? "update" : "create",
        requestResourceData: values,
      });
      errorEmitter.emit("permission-error", permissionError);
      toast({
        variant: "destructive",
        title: "Save error",
        description: "Could not save the contract. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = (values: ContractFormValues) => {
    const statusChangingToClosed =
      isEdit &&
      contract &&
      values.status !== contract.status &&
      (values.status === "Completed" || values.status === "Terminated");

    if (statusChangingToClosed) {
      setPendingSubmit(values);
      return;
    }
    void writeContract(values);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? `Edit Contract — ${contract?.contractNumber}` : "New Contract"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? `For ${client.name}. Editing these fields never changes the client's own record.`
                : `For ${client.name}. A folio number is assigned automatically when you save.`}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* A. Contract Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Contract Information
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Contract Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Pruning Services — Block 3" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="effectiveDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Effective Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "justify-start text-left font-normal",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "MM/dd/yyyy") : "Pick a date"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(d) => d && field.onChange(toLocalMidnight(d)!)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>End Date (optional)</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "justify-start text-left font-normal",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "MM/dd/yyyy") : "No end date"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(d) => field.onChange(d ? toLocalMidnight(d) : undefined)}
                              initialFocus
                            />
                            {field.value && (
                              <div className="border-t p-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => field.onChange(undefined)}
                                >
                                  Clear end date
                                </Button>
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(isEdit ? CONTRACT_STATUSES : CREATE_STATUSES).map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* B. Client and Billing Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Client &amp; Billing Information
                  <span className="ml-2 font-normal text-xs">
                    (preloaded from the client — editable for this contract only)
                  </span>
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="clientName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="clientEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Email</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="clientPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contractType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contract Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select contract type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Standard">Standard</SelectItem>
                            <SelectItem value="H2A">H2A</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingAddress"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Billing Address</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paymentTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Terms</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Net 30" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="commissionRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Commission Rate (%)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="minimumWage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Applicable Minimum Wage ($/hr)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="minimumWageForPayroll"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Wage for Payroll ($/hr)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* C. Contract Terms and Clauses */}
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Contract Terms &amp; Clauses
                  </h3>
                  <Button type="button" variant="outline" size="sm" onClick={handleGenerateTemplate}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Template
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="paymentDueDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Due (days)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 15" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lateFeeInterestPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Late Fee Interest (%/mo)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="e.g., 1.5" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="terminationNoticeDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Termination Notice (days)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 30" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormDescription>
                  Clause 2 — Work Volume and Duration Commitment (cancellation / shortfall protection)
                </FormDescription>
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="cancellationNoticeDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cancellation Notice (days)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 7" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="shortfallPenaltyPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shortfall Penalty (%)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="e.g., 50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="shortfallFeePerWorkerDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fixed Fee ($/worker/day)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="optional" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="clauses"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clauses</FormLabel>
                      <FormDescription>
                        "Generate Template" starts from the company's standard agreement and
                        fills in the fields above — everything here stays fully editable.
                      </FormDescription>
                      <FormControl>
                        <ContractClausesEditor value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={form.handleSubmit(onSubmit)}
              disabled={isSaving || form.formState.isSubmitting}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Contract"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingSubmit} onOpenChange={(open) => !open && setPendingSubmit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Mark this contract as {pendingSubmit?.status}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The contract record is kept either way — this only changes its status, it will
              not be deleted and you'll still be able to view its full history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving}
              onClick={(e) => {
                e.preventDefault();
                if (pendingSubmit) void writeContract(pendingSubmit);
                setPendingSubmit(null);
              }}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
