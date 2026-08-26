"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { RV_TYPES } from "@/lib/constants";
import { formatRvType } from "@/lib/utils/format";
import { Loader2, Star, Truck } from "lucide-react";

interface GuestFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  guestToEdit?: any | null;
}

export function GuestFormModal({
  isOpen,
  onClose,
  onSuccess,
  guestToEdit,
}: GuestFormModalProps) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [rvType, setRvType] = useState<string>("travel_trailer");
  const [rvLengthFt, setRvLengthFt] = useState<number>(30);
  const [licensePlate, setLicensePlate] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [notes, setNotes] = useState("");
  const [isVip, setIsVip] = useState(false);

  useEffect(() => {
    if (guestToEdit) {
      setFirstName(guestToEdit.firstName || "");
      setLastName(guestToEdit.lastName || "");
      setEmail(guestToEdit.email || "");
      setPhone(guestToEdit.phone || "");
      setStreet(guestToEdit.address?.street || "");
      setCity(guestToEdit.address?.city || "");
      setState(guestToEdit.address?.state || "");
      setZip(guestToEdit.address?.zip || "");
      setRvType(guestToEdit.rvDetails?.type || "travel_trailer");
      setRvLengthFt(guestToEdit.rvDetails?.lengthFt ?? 30);
      setLicensePlate(guestToEdit.rvDetails?.licensePlate || "");
      setMakeModel(guestToEdit.rvDetails?.makeModel || "");
      setNotes(guestToEdit.notes || "");
      setIsVip(guestToEdit.isVip || false);
    } else {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setStreet("");
      setCity("");
      setState("");
      setZip("");
      setRvType("travel_trailer");
      setRvLengthFt(30);
      setLicensePlate("");
      setMakeModel("");
      setNotes("");
      setIsVip(false);
    }
  }, [guestToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !phone) {
      error("Name, email, and phone number are required");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        firstName,
        lastName,
        email,
        phone,
        address: { street, city, state, zip, country: "USA" },
        rvDetails: {
          type: rvType,
          lengthFt: Number(rvLengthFt),
          licensePlate,
          makeModel,
        },
        notes,
        isVip,
      };

      if (guestToEdit) {
        const res = await apiClient.patch(`/api/guests/${guestToEdit._id}`, payload);
        if (res.data?.success) {
          success(`Guest profile for ${firstName} ${lastName} updated!`);
          onSuccess();
          onClose();
        }
      } else {
        const res = await apiClient.post("/api/guests", payload);
        if (res.data?.success) {
          success(`Guest profile created!`);
          onSuccess();
          onClose();
        }
      }
    } catch (err: any) {
      error(err?.message || "Failed to save guest");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={guestToEdit ? `Edit Guest (${guestToEdit.firstName} ${guestToEdit.lastName})` : "Add New Guest Profile"}
      subtitle="Manage guest contact, address, and RV rig specifications"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Contact Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">First Name</label>
            <input
              type="text"
              placeholder="Marcus"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="input input-bordered input-sm w-full font-medium rounded-md"
              required
            />
          </div>

          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">Last Name</label>
            <input
              type="text"
              placeholder="Holloway"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="input input-bordered input-sm w-full font-medium rounded-md"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">Email Address</label>
            <input
              type="email"
              placeholder="marcus@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input input-bordered input-sm w-full rounded-md"
              required
            />
          </div>

          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">Phone Number</label>
            <input
              type="tel"
              placeholder="(555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input input-bordered input-sm w-full font-mono rounded-md"
              required
            />
          </div>
        </div>

        {/* Rig Specs */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700">
            <Truck className="w-3.5 h-3.5 text-emerald-600" />
            RV Rig Details
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="label text-[11px] font-bold text-slate-600 py-0">Rig Type</label>
              <select
                value={rvType}
                onChange={(e) => setRvType(e.target.value)}
                className="select select-bordered select-xs w-full bg-white font-medium rounded-md"
              >
                {RV_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {formatRvType(t)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label text-[11px] font-bold text-slate-600 py-0">Length (ft)</label>
              <input
                type="number"
                min={0}
                max={60}
                value={rvLengthFt}
                onChange={(e) => setRvLengthFt(Number(e.target.value))}
                className="input input-bordered input-xs w-full font-mono bg-white rounded-md"
              />
            </div>

            <div>
              <label className="label text-[11px] font-bold text-slate-600 py-0">License Plate</label>
              <input
                type="text"
                placeholder="CO-849X"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                className="input input-bordered input-xs w-full uppercase font-mono bg-white rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="label text-[11px] font-bold text-slate-600 py-0">Make / Model</label>
            <input
              type="text"
              placeholder="e.g. 2023 Grand Design Solitude 380FL"
              value={makeModel}
              onChange={(e) => setMakeModel(e.target.value)}
              className="input input-bordered input-xs w-full bg-white rounded-md"
            />
          </div>
        </div>

        {/* Address */}
        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="input input-bordered input-sm w-full rounded-md"
            />
          </div>
          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">State</label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="input input-bordered input-sm w-full uppercase rounded-md"
            />
          </div>
          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">Zip Code</label>
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              className="input input-bordered input-sm w-full font-mono rounded-md"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <label className="cursor-pointer label gap-2 py-0">
            <input
              type="checkbox"
              checked={isVip}
              onChange={(e) => setIsVip(e.target.checked)}
              className="checkbox checkbox-warning checkbox-sm rounded"
            />
            <span className="label-text text-xs font-bold text-amber-700 flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              VIP Camper Status
            </span>
          </label>
        </div>

        <div>
          <label className="label text-xs font-bold text-slate-700 py-0.5">Guest Notes</label>
          <textarea
            placeholder="Special preferences, rig setup requests, past notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="textarea textarea-bordered textarea-sm w-full rounded-md"
            rows={2}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm font-semibold rounded-md">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary btn-sm min-w-[130px] font-bold rounded-md">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : guestToEdit ? "Update Guest" : "Save Guest"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
