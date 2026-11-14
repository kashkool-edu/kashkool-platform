'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

interface StudentRow {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  parent_phone: string | null;
  active_device_id: string | null;
  role: string;
  completedLessons: number;
  totalLessons: number;
  avgQuizScore: number | null;
  quizzesTaken: number;
}

interface SubscriptionItem {
  id: string;
  user_id: string;
  course_id: string;
  bundle_id: string | null;
  plan_type: 'monthly' | 'term' | 'bundle';
  duration_days: number;
  expires_at: string | null;
  status: 'pending' | 'approved' | 'rejected';
  payment_method: string;
  sender_phone: string | null;
  receipt_url: string | null;
  receipt_image_path?: string | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    phone_number: string | null;
  } | null;
  courses: {
    title: string;
    price: number;
    term_price: number | null;
  } | null;
  bundles: {
    title: string;
    price: number;
  } | null;
}

export default function AdminDashboardPage() {
  const router = useRouter();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [updatingSubId, setUpdatingSubId] = useState<string | null>(null);

  // Receipt Lightbox Modal State
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  useEffect(() => {
    async function initAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: me } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (me?.role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      await Promise.all([fetchStudentsAndReports(), fetchSubscriptions()]);
      setLoading(false);
    }

    initAdmin();
  }, [router]);

  async function fetchStudentsAndReports() {
    const [{ data: profiles }, { data: lessons }, { data: progress }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, phone_number, parent_phone, active_device_id, role')
        .order('created_at', { ascending: false }),
      supabase.from('lessons').select('id'),
      supabase.from('lesson_progress').select('user_id, completed, quiz_score'),
    ]);

    const totalLessonsCount = lessons?.length || 0;

    if (profiles) {
      const rows: StudentRow[] = profiles.map((p) => {
        const userProg = (progress || []).filter((item) => item.user_id === p.id);
        const completedCount = userProg.filter((item) => item.completed).length;
        const scoredItems = userProg.filter(
          (item) => item.quiz_score !== null && item.quiz_score !== undefined
        );
        const avgScore =
          scoredItems.length > 0
            ? Math.round(
                scoredItems.reduce((acc, cur) => acc + Number(cur.quiz_score), 0) /
                  scoredItems.length
              )
            : null;

        return {
          ...p,
          completedLessons: completedCount,
          totalLessons: totalLessonsCount,
          avgQuizScore: avgScore,
          quizzesTaken: scoredItems.length,
        };
      });
      setStudents(rows);
    }
  }

  async function fetchSubscriptions() {
    const { data } = await supabase
      .from('subscriptions')
      .select(`
        id,
        user_id,
        course_id,
        bundle_id,
        plan_type,
        duration_days,
        expires_at,
        status,
        payment_method,
        sender_phone,
        receipt_url,
        receipt_image_path,
        created_at,
        profiles:user_id ( full_name, phone_number ),
        courses:course_id ( title, price, term_price ),
        bundles:bundle_id ( title, price )
      `)
      .order('created_at', { ascending: false });

    if (data) {
      setSubscriptions(data as unknown as SubscriptionItem[]);
    }
  }

  async function handleViewReceipt(sub: SubscriptionItem) {
    setReceiptError(null);
    const storagePath = sub.receipt_url || sub.receipt_image_path;

    if (!storagePath) {
      setReceiptError('لم يقم الطالب برفع صورة إيصال لهذا الطلب.');
      return;
    }

    // If it is already a full HTTP URL, open directly
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
      setPreviewReceiptUrl(storagePath);
      return;
    }

    setLoadingReceiptId(sub.id);
    const { data, error } = await supabase.storage
      .from('receipts')
      .createSignedUrl(storagePath, 60 * 15); // Valid for 15 minutes

    setLoadingReceiptId(null);

    if (error || !data?.signedUrl) {
      setReceiptError('تعذّر تحميل صورة الإيصال: ' + (error?.message || 'الملف غير موجود'));
      return;
    }

    setPreviewReceiptUrl(data.signedUrl);
  }

  async function handleResetDevice(studentId: string) {
    setResettingUserId(studentId);
    const { error } = await supabase
      .from('profiles')
      .update({ active_device_id: null })
      .eq('id', studentId);

    if (!error) {
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, active_device_id: null } : s))
      );
    }
    setResettingUserId(null);
  }

  async function handleSubscriptionDecision(
    sub: SubscriptionItem,
    status: 'approved' | 'rejected'
  ) {
    setUpdatingSubId(sub.id);

    const expiresAt =
      status === 'approved'
        ? new Date(
            Date.now() + (sub.duration_days || 30) * 24 * 60 * 60 * 1000
          ).toISOString()
        : null;

    const query = supabase
      .from('subscriptions')
      .update({ status, expires_at: expiresAt });

    const { error } = sub.bundle_id
      ? await query
          .eq('user_id', sub.user_id)
          .eq('bundle_id', sub.bundle_id)
          .eq('status', 'pending')
      : await query.eq('id', sub.id);

    if (!error) {
      setSubscriptions((prev) =>
        prev.map((item) => {
          const matches = sub.bundle_id
            ? item.user_id === sub.user_id &&
              item.bundle_id === sub.bundle_id &&
              item.status === 'pending'
            : item.id === sub.id;
          return matches ? { ...item, status, expires_at: expiresAt } : item;
        })
      );
    }
    setUpdatingSubId(null);
  }

  function formatWhatsAppEgypt(rawPhone: string): string {
    const digits = rawPhone.replace(/\D/g, '');
    if (digits.startsWith('01') && digits.length === 11) {
      return `2${digits}`;
    }
    if (digits.startsWith('201') && digits.length === 12) {
      return digits;
    }
    return digits;
  }

  function buildParentReportLink(student: StudentRow): string | null {
    if (!student.parent_phone) return null;
    const waNumber = formatWhatsAppEgypt(student.parent_phone);
    const name = student.full_name || 'الطالب';
    const quizLine =
      student.avgQuizScore !== null
        ? `• متوسط درجات الاختبارات: ${student.avgQuizScore}% (${student.quizzesTaken} اختبار)`
        : '• الاختبارات: لم يؤدِ اختبارات بعد';

    const message = [
      `السلام عليكم ورحمة الله وبركاته 🌿`,
      `تقرير متابعة الطالب *${name}* على *منصة كشكول*:`,
      `• الدروس المكتملة: ${student.completedLessons} من ${student.totalLessons}`,
      quizLine,
      `مع تمنياتنا بدوام التفوق والنجاح 📚✨`,
    ].join('\n');

    return `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
  }

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.phone_number || '').includes(q) ||
      (s.parent_phone || '').includes(q)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center dir-rtl" dir="rtl">
        <div className="text-slate-400 text-sm animate-pulse">جاري تحميل لوحة الإدارة...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 p-4 sm:p-6 lg:p-8 dir-rtl text-right" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Bar */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#FBBF24] text-[#1E3A8A] flex items-center justify-center text-lg font-extrabold">
              ك
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white">لوحة تحكم الإدارة</h1>
              <p className="text-xs text-slate-400">تقارير أولياء الأمور، الأجهزة، والاشتراكات</p>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="text-xs sm:text-sm font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl transition"
          >
            العودة للمنصة
          </Link>
        </header>

        {/* Section 1: Students, Device Locks & Parent WhatsApp Reports */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-white">متابعة الطلاب وتقارير أولياء الأمور</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                أرسل تقرير الحضور ودرجات الاختبارات لولي الأمر بضغطة واحدة عبر واتساب، أو فك ارتباط الجهاز
              </p>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو رقم الطالب/ولي الأمر..."
              className="w-full sm:w-72 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FBBF24]"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] sm:text-xs text-slate-400">
                  <th className="py-3 px-3 font-bold">الطالب</th>
                  <th className="py-3 px-3 font-bold">هاتف الطالب / ولي الأمر</th>
                  <th className="py-3 px-3 font-bold">الحضور والاختبارات</th>
                  <th className="py-3 px-3 font-bold">حالة الجهاز</th>
                  <th className="py-3 px-3 font-bold text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs sm:text-sm">
                {filteredStudents.map((student) => {
                  const waLink = buildParentReportLink(student);
                  return (
                    <tr key={student.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-3 font-bold text-white">
                        {student.full_name || 'بدون اسم'}
                        {student.role === 'admin' && (
                          <span className="mr-2 text-[10px] bg-[#FBBF24]/20 text-[#FBBF24] px-2 py-0.5 rounded">
                            أدمن
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 font-mono text-xs text-slate-300 space-y-0.5">
                        <div>طالب: {student.phone_number || '—'}</div>
                        <div className="text-emerald-400">
                          ولي الأمر: {student.parent_phone || 'غير مسجل'}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-xs">
                        <div className="text-slate-200 font-bold">
                          الدروس: {student.completedLessons}/{student.totalLessons}
                        </div>
                        <div className="text-[#FBBF24]">
                          {student.avgQuizScore !== null
                            ? `متوسط الاختبار: ${student.avgQuizScore}%`
                            : 'لا توجد اختبارات'}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-xs">
                        {student.active_device_id ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 font-mono text-[11px]">
                            مرتبط ({student.active_device_id.slice(0, 6)}...)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 text-[11px]">
                            غير مرتبط
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="flex items-center justify-end gap-2">
                          {waLink ? (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
                            >
                              <span>💬</span>
                              <span>تقرير ولي الأمر</span>
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-500 px-2">لا يوجد رقم ولي أمر</span>
                          )}

                          <button
                            type="button"
                            disabled={!student.active_device_id || resettingUserId === student.id}
                            onClick={() => handleResetDevice(student.id)}
                            className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 disabled:opacity-40 text-red-300 border border-red-500/30 text-xs font-bold transition cursor-pointer disabled:cursor-not-allowed"
                          >
                            {resettingUserId === student.id ? 'جاري...' : 'فك الجهاز'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Subscription & Payment Approvals */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-white">طلبات الاشتراك والدفع</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                مراجعة إيصالات فودافون كاش وإنستا باي وتفعيل الكورسات
              </p>
            </div>
            <span className="text-xs font-bold bg-slate-800 text-slate-300 px-3 py-1 rounded-full">
              {subscriptions.length} طلبات
            </span>
          </div>

          {receiptError && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-bold">
              {receiptError}
            </div>
          )}

          {subscriptions.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">لا توجد طلبات اشتراك حالياً.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subscriptions.map((sub) => {
                const hasReceipt = Boolean(sub.receipt_url || sub.receipt_image_path);
                const displayAmount =
                  sub.plan_type === 'bundle' && sub.bundles?.price
                    ? sub.bundles.price
                    : sub.plan_type === 'term' && sub.courses?.term_price
                    ? sub.courses.term_price
                    : sub.courses?.price ?? 0;

                return (
                  <div
                    key={sub.id}
                    className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-sm font-black text-[#FBBF24]">
                          {sub.courses?.title || 'كورس'}
                        </div>
                        <div className="text-xs text-slate-200 font-bold">
                          {sub.profiles?.full_name || 'طالب'} —{' '}
                          <span className="font-mono text-slate-400">
                            {sub.profiles?.phone_number || '—'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          النظام:{' '}
                          <span className="text-slate-200 font-bold">
                            {sub.plan_type === 'bundle'
                              ? `باقة (${sub.bundles?.title || 'مجمّعة'})`
                              : sub.plan_type === 'term'
                              ? 'ترم كامل'
                              : 'شهري'}{' '}
                            ({sub.duration_days || 30} يوم)
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          الوسيلة: <span className="text-slate-200">{sub.payment_method}</span> • المبلغ:{' '}
                          <span className="text-white font-bold">{displayAmount} ج.م</span>
                        </div>
                        {sub.sender_phone && (
                          <div className="text-xs text-slate-400">
                            رقم المحوِّل منه:{' '}
                            <span className="font-mono text-amber-300 font-bold">
                              {sub.sender_phone}
                            </span>
                          </div>
                        )}
                        {sub.expires_at && sub.status === 'approved' && (
                          <div className="text-[11px] text-emerald-400 font-bold">
                            صالح حتى: {new Date(sub.expires_at).toLocaleDateString('ar-EG')}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                            sub.status === 'approved'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : sub.status === 'rejected'
                              ? 'bg-red-500/15 text-red-300'
                              : 'bg-amber-500/15 text-amber-300'
                          }`}
                        >
                          {sub.status === 'approved'
                            ? 'مفعّل'
                            : sub.status === 'rejected'
                            ? 'مرفوض'
                            : 'قيد المراجعة'}
                        </span>

                        {hasReceipt ? (
                          <button
                            type="button"
                            disabled={loadingReceiptId === sub.id}
                            onClick={() => handleViewReceipt(sub)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E3A8A] hover:bg-blue-800 text-white text-[11px] font-black transition cursor-pointer"
                          >
                            <span>🖼️</span>
                            <span>
                              {loadingReceiptId === sub.id ? 'جاري الفتح...' : 'عرض إيصال التحويل'}
                            </span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500">بدون صورة إيصال</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                      <button
                        type="button"
                        disabled={updatingSubId === sub.id || sub.status === 'approved'}
                        onClick={() => handleSubscriptionDecision(sub, 'approved')}
                        className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-black transition cursor-pointer"
                      >
                        تفعيل الاشتراك
                      </button>
                      <button
                        type="button"
                        disabled={updatingSubId === sub.id || sub.status === 'rejected'}
                        onClick={() => handleSubscriptionDecision(sub, 'rejected')}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-red-600/80 disabled:opacity-40 text-slate-200 hover:text-white text-xs font-bold transition cursor-pointer"
                      >
                        رفض
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Receipt Image Lightbox Modal */}
      {previewReceiptUrl && (
        <div
          onClick={() => setPreviewReceiptUrl(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-4 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white">صورة إيصال التحويل</h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewReceiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-[#FBBF24] px-3 py-1.5 rounded-lg transition"
                >
                  فتح بالحجم الكامل ↗
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewReceiptUrl(null)}
                  className="text-xs font-bold bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1.5 rounded-lg transition cursor-pointer"
                >
                  إغلاق ✕
                </button>
              </div>
            </div>

            <div className="bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center max-h-[70vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewReceiptUrl}
                alt="إيصال التحويل"
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}