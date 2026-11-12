'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

interface PendingOrder {
  id: string;
  user_id: string;
  course_id: string;
  payment_method: 'vodafone_cash' | 'instapay';
  sender_reference: string;
  receipt_image_path: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  signed_receipt_url?: string;
  profiles: {
    full_name: string | null;
    phone_number: string | null;
  } | null;
  courses: {
    title: string;
    price: number;
    subject: string;
  } | null;
}

interface CourseOption {
  id: string;
  title: string;
  subject: string;
}

export default function AdminApprovalPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<'orders' | 'content'>('orders');
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [coursesList, setCoursesList] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');

  // New Course Form State
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [academicStage, setAcademicStage] = useState<'primary' | 'prep' | 'secondary'>('secondary');
  const [gradeLevel, setGradeLevel] = useState<number>(3);
  const [subject, setSubject] = useState('');
  const [price, setPrice] = useState<string>('150');
  const [savingCourse, setSavingCourse] = useState(false);

  // New Lesson Form State
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDesc, setLessonDesc] = useState('');
  const [youtubeId, setYoutubeId] = useState('');
  const [orderIndex, setOrderIndex] = useState<number>(1);
  const [isFreePreview, setIsFreePreview] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [savingLesson, setSavingLesson] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    async function verifyAdminAndLoad() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      await Promise.all([fetchOrders(filter), fetchCoursesList()]);
      setLoading(false);
    }

    verifyAdminAndLoad();
  }, [router, filter]);

  async function fetchCoursesList() {
    const { data } = await supabase
      .from('courses')
      .select('id, title, subject')
      .order('created_at', { ascending: false });

    if (data) {
      setCoursesList(data);
      if (data.length > 0 && !selectedCourseId) {
        setSelectedCourseId(data[0].id);
      }
    }
  }

  async function fetchOrders(statusFilter: 'pending' | 'approved' | 'rejected') {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        profiles (full_name, phone_number),
        courses (title, price, subject)
      `)
      .eq('status', statusFilter)
      .order('created_at', { ascending: false });

    if (error || !data) return;

    const enriched = await Promise.all(
      (data as unknown as PendingOrder[]).map(async (order) => {
        const { data: signed } = await supabase.storage
          .from('receipts')
          .createSignedUrl(order.receipt_image_path, 3600);
        return {
          ...order,
          signed_receipt_url: signed?.signedUrl,
        };
      })
    );

    setOrders(enriched);
  }

  async function handleDecision(orderId: string, newStatus: 'approved' | 'rejected') {
    setProcessingId(orderId);
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (!error) {
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      showToast(newStatus === 'approved' ? 'تم تفعيل الاشتراك بنجاح ✓' : 'تم رفض الطلب');
    }
    setProcessingId(null);
  }

  function extractYouTubeId(input: string): string {
    const trimmed = input.trim();
    const match = trimmed.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : trimmed;
  }

  async function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!courseTitle.trim() || !subject.trim()) return;
    setSavingCourse(true);

    const { data, error } = await supabase
      .from('courses')
      .insert({
        title: courseTitle.trim(),
        description: courseDesc.trim() || null,
        academic_stage: academicStage,
        grade_level: Number(gradeLevel),
        subject: subject.trim(),
        price: Number(price),
        is_published: true,
      })
      .select('id, title, subject')
      .single();

    if (!error && data) {
      setCoursesList((prev) => [data, ...prev]);
      setSelectedCourseId(data.id);
      setCourseTitle('');
      setCourseDesc('');
      setSubject('');
      showToast('تم نشر الكورس الجديد بنجاح ✓');
    }
    setSavingCourse(false);
  }

  async function handleCreateLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCourseId || !lessonTitle.trim() || !youtubeId.trim()) return;
    setSavingLesson(true);

    let uploadedPdfUrl: string | null = null;

    if (pdfFile) {
      const cleanName = `${selectedCourseId}/${Date.now()}_${pdfFile.name.replace(/\s+/g, '_')}`;
      const { error: uploadErr } = await supabase.storage
        .from('warak-pdfs')
        .upload(cleanName, pdfFile, { upsert: true });

      if (!uploadErr) {
        const { data: pubUrl } = supabase.storage
          .from('warak-pdfs')
          .getPublicUrl(cleanName);
        uploadedPdfUrl = pubUrl.publicUrl;
      }
    }

    const { error } = await supabase.from('lessons').insert({
      course_id: selectedCourseId,
      title: lessonTitle.trim(),
      description: lessonDesc.trim() || null,
      youtube_video_id: extractYouTubeId(youtubeId),
      warak_pdf_url: uploadedPdfUrl,
      order_index: Number(orderIndex),
      is_free_preview: isFreePreview,
    });

    if (!error) {
      setLessonTitle('');
      setLessonDesc('');
      setYoutubeId('');
      setPdfFile(null);
      setOrderIndex((prev) => prev + 1);
      showToast('تم إضافة الدرس وورق الدرس بنجاح ✓');
    }
    setSavingLesson(false);
  }

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center dir-rtl" dir="rtl">
        <div className="text-slate-400 text-sm animate-pulse">جاري التحقق من صلاحيات الإدارة...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 p-4 sm:p-8 dir-rtl text-right" dir="rtl">
      <div className="max-w-5xl mx-auto">
        {toastMsg && (
          <div className="fixed bottom-6 left-6 z-50 bg-[#FBBF24] text-[#0F172A] font-black text-xs px-4 py-3 rounded-xl shadow-xl">
            {toastMsg}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-[#FBBF24] text-[#0F172A] text-xs font-black px-2.5 py-0.5 rounded">ADMIN</span>
              <h1 className="text-2xl font-black text-white">لوحة تحكم كشكول</h1>
            </div>
            <p className="text-sm text-slate-400">إدارة الاشتراكات ونشر الكورسات والدروس وملفات PDF</p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl transition self-start"
          >
            لوحة الطالب ←
          </Link>
        </div>

        {/* Main Section Switcher */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <button
            onClick={() => setActiveSection('orders')}
            className={`py-3 rounded-xl text-sm font-black transition cursor-pointer ${
              activeSection === 'orders'
                ? 'bg-[#1E3A8A] border border-[#FBBF24] text-white'
                : 'bg-slate-800/50 text-slate-400 hover:text-white'
            }`}
          >
            طلبات الاشتراك والدفع
          </button>
          <button
            onClick={() => setActiveSection('content')}
            className={`py-3 rounded-xl text-sm font-black transition cursor-pointer ${
              activeSection === 'content'
                ? 'bg-[#1E3A8A] border border-[#FBBF24] text-white'
                : 'bg-slate-800/50 text-slate-400 hover:text-white'
            }`}
          >
            إضافة كورسات ودروس +
          </button>
        </div>

        {activeSection === 'orders' ? (
          <>
            <div className="flex gap-2 mb-6">
              {(['pending', 'approved', 'rejected'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    filter === tab
                      ? 'bg-[#FBBF24] text-[#0F172A]'
                      : 'bg-slate-800/60 text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'pending' && 'قيد المراجعة'}
                  {tab === 'approved' && 'مقبولة'}
                  {tab === 'rejected' && 'مرفوضة'}
                </button>
              ))}
            </div>

            {orders.length === 0 ? (
              <div className="bg-slate-800/30 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-sm">
                لا توجد طلبات في هذا القسم حالياً.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-[#1E3A8A] text-[#FBBF24]">
                          {order.payment_method === 'vodafone_cash' ? 'فودافون كاش' : 'InstaPay'}
                        </span>
                        <span className="text-lg font-black text-[#FBBF24]">
                          {order.courses?.price} ج.م
                        </span>
                      </div>

                      <h3 className="font-bold text-white text-base mb-1">
                        {order.courses?.title || 'كورس غير معروف'}
                      </h3>
                      <p className="text-xs text-slate-400 mb-3">
                        الطالب: <span className="text-slate-200 font-medium">{order.profiles?.full_name || 'طالب مسجل'}</span>
                      </p>

                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5 mb-4">
                        <div className="flex justify-between">
                          <span className="text-slate-400">رقم/حساب المحوّل:</span>
                          <span className="font-mono text-white font-bold" dir="ltr">{order.sender_reference}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">تاريخ الطلب:</span>
                          <span className="text-slate-300">
                            {new Date(order.created_at).toLocaleDateString('ar-EG')}
                          </span>
                        </div>
                      </div>

                      {order.signed_receipt_url && (
                        <a
                          href={order.signed_receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full text-center py-2.5 rounded-xl bg-slate-900 hover:bg-slate-950 border border-slate-700 text-xs font-bold text-[#FBBF24] transition"
                        >
                          عرض صورة الإيصال كاملة ↗
                        </a>
                      )}
                    </div>

                    {filter === 'pending' && (
                      <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-700/60">
                        <button
                          onClick={() => handleDecision(order.id, 'approved')}
                          disabled={processingId === order.id}
                          className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition disabled:opacity-50 cursor-pointer"
                        >
                          تفعيل الاشتراك ✓
                        </button>
                        <button
                          onClick={() => handleDecision(order.id, 'rejected')}
                          disabled={processingId === order.id}
                          className="py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-bold text-xs transition disabled:opacity-50 cursor-pointer"
                        >
                          رفض الطلب ✕
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Content Management Section */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Create New Course */}
            <form onSubmit={handleCreateCourse} className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-black text-white border-b border-slate-800 pb-3">
                1. إنشاء كورس جديد
              </h2>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">عنوان الكورس</label>
                <input
                  type="text"
                  required
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  placeholder="مثال: مراجعة الجبر والهندسة الفراغية"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#FBBF24]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">المرحلة الدراسية</label>
                  <select
                    value={academicStage}
                    onChange={(e) => setAcademicStage(e.target.value as 'primary' | 'prep' | 'secondary')}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#FBBF24]"
                  >
                    <option value="primary">ابتدائي</option>
                    <option value="prep">إعدادي</option>
                    <option value="secondary">ثانوي</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">الصف الدراسي</label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#FBBF24]"
                  >
                    {[1, 2, 3, 4, 5, 6].map((g) => (
                      <option key={g} value={g}>الصف {g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">المادة</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="مثال: الرياضيات"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#FBBF24]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">السعر (ج.م)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#FBBF24]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">وصف مختصر</label>
                <textarea
                  rows={2}
                  value={courseDesc}
                  onChange={(e) => setCourseDesc(e.target.value)}
                  placeholder="تفاصيل محتوى الكورس..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white outline-none focus:border-[#FBBF24]"
                />
              </div>

              <button
                type="submit"
                disabled={savingCourse}
                className="w-full py-3 bg-[#FBBF24] hover:bg-amber-400 text-[#0F172A] font-black text-xs rounded-xl transition disabled:opacity-50 cursor-pointer"
              >
                {savingCourse ? 'جاري النشر...' : 'نشر الكورس'}
              </button>
            </form>

            {/* 2. Add Lesson + Warak El-Dars PDF */}
            <form onSubmit={handleCreateLesson} className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-black text-white border-b border-slate-800 pb-3">
                2. إضافة درس + ورق الدرس (PDF)
              </h2>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">اختر الكورس</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#FBBF24]"
                >
                  {coursesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.subject})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">عنوان الدرس</label>
                <input
                  type="text"
                  required
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  placeholder="مثال: الحصة الثانية - قانون كيرشوف"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#FBBF24]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">رابط فيديو YouTube (Unlisted) أو ID</label>
                  <input
                    type="text"
                    required
                    value={youtubeId}
                    onChange={(e) => setYoutubeId(e.target.value)}
                    placeholder="https://youtu.be/... أو ID"
                    dir="ltr"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#FBBF24]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">ترتيب الحصة</label>
                  <input
                    type="number"
                    min={1}
                    value={orderIndex}
                    onChange={(e) => setOrderIndex(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#FBBF24]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">ملف ورق الدرس (PDF اختياري)</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-300 file:ml-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#1E3A8A] file:text-[#FBBF24] bg-slate-900 border border-slate-700 rounded-xl p-1.5 cursor-pointer"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFreePreview}
                  onChange={(e) => setIsFreePreview(e.target.checked)}
                  className="rounded accent-[#FBBF24]"
                />
                <span>متاح كحصة مجانية تجريبية (Free Preview)</span>
              </label>

              <button
                type="submit"
                disabled={savingLesson}
                className="w-full py-3 bg-[#1E3A8A] hover:bg-blue-800 border border-[#FBBF24]/50 text-[#FBBF24] font-black text-xs rounded-xl transition disabled:opacity-50 cursor-pointer"
              >
                {savingLesson ? 'جاري رفع الملف وإضافة الدرس...' : 'إضافة الدرس للكورس'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}