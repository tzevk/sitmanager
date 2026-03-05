'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PermissionGate } from '@/components/ui/PermissionGate';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Course { Course_Id: number; Course_Name: string; }
interface Batch { Batch_Id: number; Batch_Code: string; }
interface Faculty { id: number; facultyname: string; }

interface FormData {
  date: string;
  Course_Id: string;
  Batch_Id: string;
  faculty: string; // Storing faculty name or ID? Table uses varchar(250) for name probably.
  // Note: awt_facultyworking has 'faculty' as varchar(250). It might store the name.
  // But usually we store ID if possible. However, the existing 'viva-moc' uses names sometimes.
  // Let's assume Name for now based on 'varchar(250)', but I will check if I can store ID.
  // Actually, 'awt_faculty' has 'id'. 'awt_facultyworking' has 'faculty' (varchar).
  // I will store the Name, but usually ID is safer. Let's see if I can find existing data.
  // The 'lecture-taken' table stores 'Faculty_Id' (int).
  // 'awt_facultyworking' stores 'faculty' (varchar).
  // I will store the Faculty Name to be safe with the schema type, but it's better to store ID if the system supports it.
  // Let's stick to Name since column is varchar. OR maybe the column stores "Matrix" (ID).
  // Given 'varchar(250)', it's likely Name.
  
  facultytime: string;
  to: string;
  work: string;
}

const emptyForm: FormData = {
  date: new Date().toISOString().slice(0, 10),
  Course_Id: '',
  Batch_Id: '',
  faculty: '',
  facultytime: '',
  to: '',
  work: '',
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function AddFacultyWorkingPage() {
  return (
    <PermissionGate resource="faculty_working_hours" deniedMessage="You do not have permission to add faculty working hours.">
      {(perms) => <AddFacultyWorkingContent {...perms} />}
    </PermissionGate>
  );
}

function AddFacultyWorkingContent({ canCreate, canUpdate }: { canCreate: boolean; canUpdate: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');
  const isEdit = !!editId;

  const [form, setForm] = useState<FormData>(emptyForm);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  /* ---- Fetch Options ---- */
  useEffect(() => {
    // Fetch Courses
    fetch('/api/daily-activities/faculty-working?options=courses')
      .then(res => res.json())
      .then(data => setCourses(data.courses || []))
      .catch(console.error);

    // Fetch Faculties
    fetch('/api/daily-activities/faculty-working?options=faculties')
      .then(res => res.json())
      .then(data => setFaculties(data.faculties || []))
      .catch(console.error);
  }, []);

  /* ---- Fetch Batches when Course Changes ---- */
  useEffect(() => {
    if (form.Course_Id) {
      fetch(`/api/daily-activities/faculty-working?options=batches&courseId=${form.Course_Id}`)
        .then(res => res.json())
        .then(data => setBatches(data.batches || []))
        .catch(console.error);
    } else {
      setBatches([]);
    }
  }, [form.Course_Id]);

  /* ---- Fetch Existing Data for Edit ---- */
  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      fetch(`/api/daily-activities/faculty-working?id=${editId}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            setError(data.error);
          } else {
            console.log('Edit Data:', data);
            setForm({
              date: data.date || '',
              // Check if course is stored as ID or Name. Usually ID in dropdown.
              // If stored as ID in DB, good. If Name, we need to find ID.
              // Table instructions said 'course' is varchar(255). It usually stores ID as string.
              Course_Id: data.course?.toString() || '', 
              Batch_Id: data.batch?.toString() || '',
              faculty: data.faculty || '',
              facultytime: data.facultytime || '',
              to: data.to || '',
              work: data.work || '',
            });
          }
        })
        .catch(err => setError('Failed to load record'))
        .finally(() => setLoading(false));
    }
  }, [isEdit, editId]);

  /* ---- Submit ---- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    
    // Validate
    if (!form.Course_Id || !form.Batch_Id || !form.faculty) {
      setError('Please fill in required fields (Course, Batch, Faculty).');
      setSaving(false);
      return;
    }

    try {
      const url = '/api/daily-activities/faculty-working';
      const method = isEdit ? 'PUT' : 'POST';
      const body = {
        ...form,
        course: form.Course_Id,
        batch: form.Batch_Id,
        id: isEdit ? editId : undefined
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to save');
      }

      router.push('/dashboard/daily-activities/faculty-working');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading form...</div>;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h1 className="text-lg font-bold text-gray-800">
            {isEdit ? 'Edit Faculty Working Hours' : 'View Faculty Working Hours Info'}
          </h1>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={e => handleChange('date', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Course */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course <span className="text-red-500">*</span></label>
              <select
                required
                value={form.Course_Id}
                onChange={e => handleChange('Course_Id', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] transition-colors"
              >
                <option value="">Select</option>
                {courses.map(c => (
                  <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>
                ))}
              </select>
            </div>

            {/* Batch */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch <span className="text-red-500">*</span></label>
              <select
                required
                value={form.Batch_Id}
                onChange={e => handleChange('Batch_Id', e.target.value)}
                disabled={!form.Course_Id}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] transition-colors disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">Select</option>
                {batches.map(b => (
                  <option key={b.Batch_Id} value={b.Batch_Id}>{b.Batch_Code}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Faculty */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Faculty</label>
            <select
              required
              value={form.faculty}
              onChange={e => handleChange('faculty', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] transition-colors"
            >
              <option value="">Select</option>
              {faculties.map(f => (
                <option key={f.id} value={f.id}>{f.facultyname}</option>
              ))}
            </select>
          </div>

          {/* Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Faculty Time From</label>
              <input
                type="time"
                value={form.facultytime}
                onChange={e => handleChange('facultytime', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Faculty Time To</label>
              <input
                type="time"
                value={form.to}
                onChange={e => handleChange('to', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] transition-colors"
              />
            </div>
          </div>

          {/* Work */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Work</label>
            <textarea
              rows={3}
              placeholder="Work description..."
              value={form.work}
              onChange={e => handleChange('work', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] transition-colors resize-y"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 text-sm font-medium text-white bg-[#2E3093] rounded-lg hover:bg-[#232470] focus:ring-2 focus:ring-offset-2 focus:ring-[#2E3093] disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {saving ? 'Saving...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
