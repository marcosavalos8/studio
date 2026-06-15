"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useFirestore } from "@/firebase";

export interface CompanyInfo {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  ein: string;
  ubi: string;
}

const DEFAULT_COMPANY_INFO: CompanyInfo = {
  companyName: "J&M AGRICULTURAL LABOR LLC",
  address: "250 Country Heaven Loop, Pasco, WA 99301",
  phone: "509.380.3385",
  email: "Jmagriculturalabor@outlook.com",
  ein: "33-2236422",
  ubi: "605 650 411",
};

export function useCompanyInfo() {
  const firestore = useFirestore();
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(DEFAULT_COMPANY_INFO);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!firestore) return;
    const ref = doc(firestore, "company_settings", "info");
    getDoc(ref).then((snap) => {
      if (snap.exists()) {
        setCompanyInfo({ ...DEFAULT_COMPANY_INFO, ...(snap.data() as CompanyInfo) });
      }
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [firestore]);

  const saveCompanyInfo = async (info: CompanyInfo) => {
    if (!firestore) return;
    setIsSaving(true);
    try {
      await setDoc(doc(firestore, "company_settings", "info"), info);
      setCompanyInfo(info);
    } finally {
      setIsSaving(false);
    }
  };

  return { companyInfo, isLoading, isSaving, saveCompanyInfo };
}
