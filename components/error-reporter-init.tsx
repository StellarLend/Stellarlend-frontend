"use client";

import { useEffect } from "react";
import { createBeaconSink, setErrorSink } from "@/lib/report-error";

export function ErrorReporterInit() {
  useEffect(() => {
    setErrorSink(createBeaconSink());
  }, []);

  return null;
}
