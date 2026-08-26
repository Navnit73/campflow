"use client";

import React, { useState } from "react";
import { TapeChart } from "@/components/calendar/TapeChart";
import { ReservationDetailModal } from "@/components/reservations/ReservationDetailModal";
import { NewReservationModal } from "@/components/reservations/NewReservationModal";
import { PaymentModal } from "@/components/payments/PaymentModal";

export default function TapeChartPage() {
  const [selectedResId, setSelectedResId] = useState<string | null>(null);
  const [newBookingParams, setNewBookingParams] = useState<{
    isOpen: boolean;
    siteId?: string;
    date?: string;
  }>({ isOpen: false });
  const [paymentRes, setPaymentRes] = useState<any | null>(null);
  const [chartKey, setChartKey] = useState(0);

  const handleBookSiteDate = (siteId: string, siteNumber: string, date: string) => {
    setNewBookingParams({
      isOpen: true,
      siteId,
      date,
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
          Site Tape Chart
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Visual occupancy matrix • Click any available slot to book or click a reservation bar to inspect details
        </p>
      </div>

      <TapeChart
        key={chartKey}
        onSelectReservation={(id) => setSelectedResId(id)}
        onBookSiteDate={handleBookSiteDate}
      />

      <ReservationDetailModal
        reservationId={selectedResId}
        isOpen={!!selectedResId}
        onClose={() => setSelectedResId(null)}
        onUpdated={() => setChartKey((k) => k + 1)}
        onOpenPayment={(res) => {
          setSelectedResId(null);
          setPaymentRes(res);
        }}
      />

      <NewReservationModal
        isOpen={newBookingParams.isOpen}
        initialSiteId={newBookingParams.siteId}
        initialDate={newBookingParams.date}
        onClose={() => setNewBookingParams({ isOpen: false })}
        onSuccess={() => {
          setNewBookingParams({ isOpen: false });
          setChartKey((k) => k + 1);
        }}
      />

      <PaymentModal
        reservation={paymentRes}
        isOpen={!!paymentRes}
        onClose={() => setPaymentRes(null)}
        onSuccess={() => {
          setPaymentRes(null);
          setChartKey((k) => k + 1);
        }}
      />
    </div>
  );
}
