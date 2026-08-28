"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InformesIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/informes/vision-general");
  }, [router]);
  return null;
}
