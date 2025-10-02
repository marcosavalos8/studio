'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const Chart = dynamic(() => import('./chart').then(mod => mod.Chart), {
    ssr: false,
    loading: () => <Skeleton className="h-[300px]" />,
})

export function OverviewChart() {
    return <Chart />
}
