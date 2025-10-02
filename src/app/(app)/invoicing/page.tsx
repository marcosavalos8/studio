import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { InvoicingForm } from "./invoicing-form"
import { clients } from "@/lib/mock-data"

export default function InvoicingPage() {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Generate Invoice</CardTitle>
          <CardDescription>
            Select a client and date range to generate a detailed invoice for billing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvoicingForm clients={clients} />
        </CardContent>
      </Card>
    </div>
  )
}
