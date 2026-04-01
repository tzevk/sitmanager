"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PermissionGate } from "@/components/ui/PermissionGate";

const labelCls = "block text-[11px] font-semibold text-gray-600 mb-0.5";
const inputCls =
  "w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors";
const textareaCls =
  "w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors resize-none";

type FestivalPhoto = {
  id: number;
  startDate: string;
  endDate: string;
  description: string;
  imageUrl: string;
  createdAt: string;
};

export default function FestivalPhotoUploadPage() {
  const router = useRouter();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [photos, setPhotos] = useState<FestivalPhoto[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");
  const filteredPhotos = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return photos;
    return photos.filter((p) =>
      p.description.toLowerCase().includes(term) ||
      p.startDate.toLowerCase().includes(term) ||
      p.endDate.toLowerCase().includes(term) ||
      String(p.id).includes(term)
    );
  }, [photos, search]);

  const resetForm = () => {
    setStartDate("");
    setEndDate("");
    setDescription("");
    setImageFile(null);
  };

  const loadPhotos = async () => {
    setLoadingList(true);
    setError("");
    try {
      const res = await fetch("/api/utility/festival-photos");
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || "Failed to load photos");
      setPhotos(Array.isArray(data.data) ? data.data : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load photos");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!startDate || !endDate || !description || !imageFile) {
      setError("Please fill all required fields and choose an image.");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError("Start Date cannot be after End Date.");
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("startDate", startDate);
      formData.append("endDate", endDate);
      formData.append("description", description.trim());
      formData.append("image", imageFile);

      const res = await fetch("/api/utility/festival-photos", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Upload failed");
      }

      setSuccess("Festival photo uploaded successfully.");
      resetForm();
      loadPhotos();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PermissionGate resource="festival_photo" action="view" deniedMessage="You do not have permission to view festival photos.">
      {({ canCreate }) => {
        const formDisabled = !canCreate || submitting;

        return (
        <div className="w-full bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
          <div>
            <h1 className="text-lg font-semibold text-[#2E3093]">Festival Photos Upload</h1>
            <p className="text-xs text-gray-500">Add festival photos with active date range.</p>
          </div>

          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
          {success && <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">{success}</div>}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelCls}>Start Date*</label>
                <input
                  type="date"
                  className={inputCls}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  disabled={formDisabled}
                />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>End Date *</label>
                <input
                  type="date"
                  className={inputCls}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  disabled={formDisabled}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelCls}>Image*</label>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center px-3 py-2 text-xs font-semibold text-[#2E3093] border border-[#2E3093]/60 rounded-md cursor-pointer hover:bg-[#2E3093]/5">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setImageFile(file || null);
                    }}
                    disabled={formDisabled}
                  />
                  Choose File
                </label>
                <span className="text-[11px] text-gray-600 truncate">
                  {imageFile ? imageFile.name : "No file chosen"}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelCls}>Description*</label>
              <textarea
                className={textareaCls}
                rows={4}
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                disabled={formDisabled}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={formDisabled}
                className="px-4 py-2 text-xs font-semibold rounded-md text-white bg-[#2E3093] hover:bg-[#252780] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  router.back();
                }}
                className="px-4 py-2 text-xs font-semibold rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                disabled={formDisabled}
              >
                Cancel
              </button>
            </div>
          </form>

          <div className="border-t border-gray-200 pt-4 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#2E3093]">View Festival Photos</h2>
                <p className="text-xs text-gray-500">{photos.length} record{photos.length === 1 ? "" : "s"} found</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="Search…"
                  className="w-44 sm:w-56 bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093]"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => {
                    const headers = ["Id", "Start Date", "End Date", "Description", "Image URL", "Created At"];
                    const rows = filteredPhotos.map((p) => [p.id, p.startDate, p.endDate, p.description.replace(/"/g, "'"), p.imageUrl, p.createdAt]);
                    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "festival-photos.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  disabled={filteredPhotos.length === 0}
                >
                  Export
                </button>
                <button
                  type="button"
                  onClick={loadPhotos}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md text-white bg-[#2E3093] hover:bg-[#252780]"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="overflow-auto border border-gray-200 rounded-md">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Id</th>
                    <th className="px-3 py-2 text-left font-semibold">Start Date</th>
                    <th className="px-3 py-2 text-left font-semibold">End Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Description</th>
                    <th className="px-3 py-2 text-left font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingList ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-gray-500">Loading…</td>
                    </tr>
                  ) : filteredPhotos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-gray-500">No records found.</td>
                    </tr>
                  ) : (
                    filteredPhotos.map((p) => (
                      <tr key={p.id} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-800">{p.id}</td>
                        <td className="px-3 py-2 text-gray-800">{p.startDate}</td>
                        <td className="px-3 py-2 text-gray-800">{p.endDate}</td>
                        <td className="px-3 py-2 text-gray-800 max-w-xs truncate" title={p.description}>{p.description}</td>
                        <td className="px-3 py-2">
                          <a
                            href={p.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#2E3093] font-semibold hover:underline"
                          >
                            View
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        );
      }}
    </PermissionGate>
  );
}
