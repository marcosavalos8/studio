'use client'

import { useDoc, useFirestore, useMemoFirebase } from '@/firebase'
import type { Employee } from '@/lib/types'
import { doc } from 'firebase/firestore'
import { Loader2 } from 'lucide-react'
import { useParams } from 'next/navigation'
import React, { useEffect, useMemo, useRef } from 'react'
import { QRCode } from 'react-qrcode-logo';

export default function PrintBadgePage() {
    const params = useParams()
    const firestore = useFirestore()
    const { id } = params
  
    const employeeRef = useMemoFirebase(() => {
      if (!firestore || !id) return null
      return doc(firestore, 'employees', id as string)
    }, [firestore, id])
  
    const { data: employee, isLoading, error } = useDoc<Employee>(employeeRef)
    const hasPrinted = useRef(false);

    useEffect(() => {
        if (employee && !isLoading && !hasPrinted.current) {
            hasPrinted.current = true;
            // A short delay helps ensure the QR code is fully rendered before printing
            setTimeout(() => window.print(), 500);
        }
    }, [employee, isLoading])

    if (isLoading) {
      return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }
  
    if (error || !employee) {
      return <div className="flex h-screen items-center justify-center">Error loading employee data. Please try again.</div>
    }
  
    return (
        <div className="flex items-center justify-center h-screen bg-gray-100 print:bg-white">
            <style jsx global>{`
                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    @page {
                        size: 4in 6in;
                        margin: 0;
                    }
                }
            `}</style>
            <div className="w-[4in] h-[6in] bg-white border border-gray-300 shadow-lg print:shadow-none print:border-none rounded-lg flex flex-col items-center justify-center p-8 space-y-8">
                <h1 className="text-4xl font-bold text-center break-words">{employee.name}</h1>
                <div className="border-4 border-black p-2">
                    <QRCode value={employee.qrCode} size={250} />
                </div>
                <p className="text-center text-gray-500 font-mono text-sm">{employee.qrCode}</p>
                <div className="text-center">
                    <p className="text-xl font-semibold text-primary">FieldTack WA</p>
                    <p className="text-sm text-muted-foreground">{employee.role}</p>
                </div>
            </div>
        </div>
    )
  }
