"use client";

import { AccountingCenterClient } from "./accounting-center-client";
import { withAuth } from "@/components/withAuth";

function AccountingCenterPage() {
  return <AccountingCenterClient />;
}

export default withAuth(AccountingCenterPage, { askEveryVisit: true });
