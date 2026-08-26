"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { RIG_TYPES, SURFACE_TYPES } from "@/lib/constants";
import { formatRigType } from "@/lib/utils/format";
import { Loader2 } from "lucide-react";

interface SiteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  siteToEdit?: any | null;
  siteTypes: any[];
}

export function SiteFormModal({
  isOpen,
  onClose,
  onSuccess,
  siteToEdit,
  siteTypes,
}: SiteFormModalProps) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);

  const [siteNumber, setSiteNumber] = useState("");
  const [name, setName] = useState("");
  const [siteTypeId, setSiteTypeId] = useState("");
  const [status, setStatus] = useState<string>("available");
  const [currentBaseRate, setCurrentBaseRate] = useState<number>(55);
  const [surfaceType, setSurfaceType] = useState<string>("gravel");
  const [rigType, setRigType] = useState<string>("back_in");
  const [amenitiesStr, setAmenitiesStr] = useState("Picnic Table, Fire Pit, Free Wi-Fi");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (siteToEdit) {
      setSiteNumber(siteToEdit.siteNumber);
      setName(siteToEdit.name || "");
      setSiteTypeId(siteToEdit.siteTypeId?._id || siteToEdit.siteTypeId || "");
      setStatus(siteToEdit.status || "available");
      setCurrentBaseRate(siteToEdit.currentBaseRate || 55);
      setSurfaceType(siteToEdit.surfaceType || "gravel");
      setRigType(siteToEdit.rigType || "back_in");
      setAmenitiesStr((siteToEdit.amenities || []).join(", "));
      setNotes(siteToEdit.notes || "");
    } else {
      setSiteNumber("");
      setName("");
      setSiteTypeId(siteTypes.length > 0 ? siteTypes[0]._id : "");
      setStatus("available");
      setCurrentBaseRate(siteTypes.length > 0 ? siteTypes[0].defaultBaseRate : 55);
      setSurfaceType("gravel");
      setRigType("back_in");
      setAmenitiesStr("Picnic Table, Fire Pit, Free Wi-Fi");
      setNotes("");
    }
  }, [siteToEdit, siteTypes, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteNumber || !siteTypeId) {
      error("Site number and Site category are required");
      return;
    }

    setLoading(true);
    try {
      const amenities = amenitiesStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        siteNumber,
        name: name || `Site ${siteNumber}`,
        siteTypeId,
        status,
        currentBaseRate: Number(currentBaseRate),
        surfaceType,
        rigType,
        amenities,
        notes,
      };

      if (siteToEdit) {
        const res = await apiClient.patch(`/api/sites/${siteToEdit._id}`, payload);
        if (res.data?.success) {
          success(`Site ${siteNumber} updated successfully!`);
          onSuccess();
          onClose();
        }
      } else {
        const res = await apiClient.post("/api/sites", payload);
        if (res.data?.success) {
          success(`Site ${siteNumber} created successfully!`);
          onSuccess();
          onClose();
        }
      }
    } catch (err: any) {
      error(err?.message || "Failed to save site");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={siteToEdit ? `Edit Site ${siteToEdit.siteNumber}` : "Add New Campground Site"}
      subtitle="Configure site dimensions, hookups, and surface type"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">Site Number / ID</label>
            <input
              type="text"
              placeholder="e.g. A-01, Site 12"
              value={siteNumber}
              onChange={(e) => setSiteNumber(e.target.value)}
              className="input input-bordered input-sm w-full font-mono font-bold rounded-md"
              required
            />
          </div>

          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">Site Category</label>
            <select
              value={siteTypeId}
              onChange={(e) => {
                setSiteTypeId(e.target.value);
                const st = siteTypes.find((t) => t._id === e.target.value);
                if (st && !siteToEdit) {
                  setCurrentBaseRate(st.defaultBaseRate);
                }
              }}
              className="select select-bordered select-sm w-full font-medium rounded-md"
              required
            >
              <option value="" disabled>Select Category</option>
              {siteTypes.map((st) => (
                <option key={st._id} value={st._id}>
                  {st.name} (${st.defaultBaseRate}/nt)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">Nightly Rate ($)</label>
            <input
              type="number"
              min={0}
              step="1"
              value={currentBaseRate}
              onChange={(e) => setCurrentBaseRate(Number(e.target.value))}
              className="input input-bordered input-sm w-full font-bold font-mono text-emerald-700 rounded-md"
              required
            />
          </div>

          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">Rig Access Type</label>
            <select
              value={rigType}
              onChange={(e) => setRigType(e.target.value)}
              className="select select-bordered select-sm w-full font-medium rounded-md"
            >
              {RIG_TYPES.map((r) => (
                <option key={r} value={r}>
                  {formatRigType(r)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">Surface Pad</label>
            <select
              value={surfaceType}
              onChange={(e) => setSurfaceType(e.target.value)}
              className="select select-bordered select-sm w-full capitalize rounded-md"
            >
              {SURFACE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">Operational Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="select select-bordered select-sm w-full font-medium rounded-md"
            >
              <option value="available">Available for Booking</option>
              <option value="maintenance">Under Maintenance</option>
              <option value="inactive">Inactive / Offline</option>
            </select>
          </div>

          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">Display Name (optional)</label>
            <input
              type="text"
              placeholder="e.g. Riverfront Deluxe A-01"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input input-bordered input-sm w-full rounded-md"
            />
          </div>
        </div>

        <div>
          <label className="label text-xs font-bold text-slate-700 py-0.5">Amenities (comma-separated)</label>
          <input
            type="text"
            placeholder="Picnic Table, Fire Pit, Shade, Concrete Pad"
            value={amenitiesStr}
            onChange={(e) => setAmenitiesStr(e.target.value)}
            className="input input-bordered input-sm w-full rounded-md"
          />
        </div>

        <div>
          <label className="label text-xs font-bold text-slate-700 py-0.5">Maintenance Notes</label>
          <textarea
            placeholder="Special instructions or notes for site maintenance..."
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
          <button type="submit" disabled={loading} className="btn btn-primary btn-sm min-w-[120px] font-bold rounded-md">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : siteToEdit ? "Update Site" : "Save Site"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
