"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/axios/client";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ELECTRIC_HOOKUPS, SITE_CATEGORIES } from "@/lib/constants";
import { Loader2 } from "lucide-react";

interface SiteTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  typeToEdit?: any | null;
}

export function SiteTypeModal({ isOpen, onClose, onSuccess, typeToEdit }: SiteTypeModalProps) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("rv_site");
  const [electric, setElectric] = useState<string>("50A");
  const [water, setWater] = useState(true);
  const [sewer, setSewer] = useState(true);
  const [maxRigLength, setMaxRigLength] = useState<number>(45);
  const [defaultBaseRate, setDefaultBaseRate] = useState<number>(65);
  const [maxOccupancy, setMaxOccupancy] = useState<number>(6);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (typeToEdit) {
      setName(typeToEdit.name);
      setCategory(typeToEdit.category || "rv_site");
      setElectric(typeToEdit.hookups?.electric || "30A");
      setWater(typeToEdit.hookups?.water ?? true);
      setSewer(typeToEdit.hookups?.sewer ?? true);
      setMaxRigLength(typeToEdit.maxRigLength ?? 40);
      setDefaultBaseRate(typeToEdit.defaultBaseRate ?? 50);
      setMaxOccupancy(typeToEdit.maxOccupancy ?? 6);
      setDescription(typeToEdit.description || "");
    } else {
      setName("");
      setCategory("rv_site");
      setElectric("50A");
      setWater(true);
      setSewer(true);
      setMaxRigLength(45);
      setDefaultBaseRate(65);
      setMaxOccupancy(6);
      setDescription("");
    }
  }, [typeToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      error("Site Category name is required");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name,
        category,
        hookups: { electric, water, sewer },
        maxRigLength: Number(maxRigLength),
        defaultBaseRate: Number(defaultBaseRate),
        maxOccupancy: Number(maxOccupancy),
        description,
      };

      if (typeToEdit) {
        const res = await apiClient.patch(`/api/sites/types/${typeToEdit._id}`, payload);
        if (res.data?.success) {
          success(`Site category "${name}" updated!`);
          onSuccess();
          onClose();
        }
      } else {
        const res = await apiClient.post("/api/sites/types", payload);
        if (res.data?.success) {
          success(`Site category "${name}" created!`);
          onSuccess();
          onClose();
        }
      }
    } catch (err: any) {
      error(err?.message || "Failed to save site category");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={typeToEdit ? `Edit "${typeToEdit.name}"` : "Add New Site Category"}
      subtitle="Define default rates, hookups, and maximum rig clearance"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="label text-xs font-bold text-slate-700 py-0.5">Category Name</label>
          <input
            type="text"
            placeholder="e.g. 50A Full Hookup Pull-Through"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input input-bordered input-sm w-full font-semibold rounded-md"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">Category Type</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="select select-bordered select-sm w-full capitalize rounded-md"
            >
              {SITE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">Default Base Rate ($/nt)</label>
            <input
              type="number"
              min={0}
              step="1"
              value={defaultBaseRate}
              onChange={(e) => setDefaultBaseRate(Number(e.target.value))}
              className="input input-bordered input-sm w-full font-mono font-bold text-emerald-700 rounded-md"
              required
            />
          </div>
        </div>

        {/* Hookups Checklist */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
            Hookup Specifications
          </label>
          <div className="grid grid-cols-3 gap-2.5 pt-0.5">
            <div>
              <label className="label text-[11px] font-bold text-slate-600 py-0">Electric</label>
              <select
                value={electric}
                onChange={(e) => setElectric(e.target.value)}
                className="select select-bordered select-xs w-full font-medium rounded-md"
              >
                {ELECTRIC_HOOKUPS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center pt-3">
              <label className="cursor-pointer label gap-1.5 py-0">
                <input
                  type="checkbox"
                  checked={water}
                  onChange={(e) => setWater(e.target.checked)}
                  className="checkbox checkbox-primary checkbox-xs rounded"
                />
                <span className="label-text text-xs font-bold text-slate-700">Water</span>
              </label>
            </div>

            <div className="flex items-center pt-3">
              <label className="cursor-pointer label gap-1.5 py-0">
                <input
                  type="checkbox"
                  checked={sewer}
                  onChange={(e) => setSewer(e.target.checked)}
                  className="checkbox checkbox-primary checkbox-xs rounded"
                />
                <span className="label-text text-xs font-bold text-slate-700">Sewer</span>
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">Max Rig Length (ft)</label>
            <input
              type="number"
              min={0}
              max={65}
              value={maxRigLength}
              onChange={(e) => setMaxRigLength(Number(e.target.value))}
              className="input input-bordered input-sm w-full font-mono rounded-md"
            />
          </div>

          <div>
            <label className="label text-xs font-bold text-slate-700 py-0.5">Max Occupancy (guests)</label>
            <input
              type="number"
              min={1}
              max={15}
              value={maxOccupancy}
              onChange={(e) => setMaxOccupancy(Number(e.target.value))}
              className="input input-bordered input-sm w-full rounded-md"
            />
          </div>
        </div>

        <div>
          <label className="label text-xs font-bold text-slate-700 py-0.5">Description</label>
          <textarea
            placeholder="Describe site features, pad dimensions, and views..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="textarea textarea-bordered textarea-sm w-full rounded-md"
            rows={2}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm font-semibold rounded-md">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary btn-sm min-w-[130px] font-bold rounded-md">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : typeToEdit ? "Update Category" : "Create Category"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
