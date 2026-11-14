'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  buildParentWhatsAppMessage,
  buildWhatsAppUrl,
  StudentReportData,
} from '@/lib/whatsappReport';

interface SubscriptionItem {
  id: string;
  user_id: string;
  course_id: string;
  status: 'pending' | 'approved' | 'rejected';
  payment_method: string;
  sender_phone: string | null;
  receipt_url: string | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    phone_number: string | null;
  } | null;
  courses: {
    title: string;
    price: number;
  } | null;
}

interface StudentProfile {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  parent_phone: string | null;
  role: string;
  active_device_id: string | null;
  last_active_at: string | null;
}

interface ProgressRow {
  user_id: string;
  lesson_id: string;
  course_id: string;
  is_completed: boolean;
  quiz_score: number | null;
  completed_at: string;
}

interface LessonRow {
  id: string;
  course_id: string;
  title: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);
  const [lessons, setLessons] = useState<LessonRow[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [updatingSubId, setUpdatingSubId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // WhatsApp Modal State
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [modalParentPhone, setModalParentPhone] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function initAdmin() {
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

      await Promise.all([
        fetchSubscriptions(),
        fetchStudents(),
        fetchProgressAndLessons(),
      ]);
      setLoading(false);
    }

    initAdmin();
  }, [router]);

  async function fetchSubscriptions() {
    const { data } = await supabase
      .from('subscriptions')
      .select(`
        id,
        user_id,
        course_id,
        status,
        payment_method,
        sender_phone,
        receipt_url,
        created_at,
        profiles:user_id ( full_name, phone_number ),
        courses:course_id ( title, price )
      `)
      .order('created_at', { ascending: false });

    if (data) setSubscriptions(data as unknown as SubscriptionItem[]);
  }

  async function fetchStudents() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, phone_number, parent_phone, role, active_device_id, last_active_at')
      .order('last_active_at', { ascending: false });

    if (data) setStudents(data);
  }

  async function fetchProgressAndLessons() {
    const [{ data: prog }, { data: less }] = await Promise.all([
      supabase
        .from('lesson_progress')
        .select('user_id, lesson_id, course_id, is_completed, quiz_score, completed_at')
        .order('completed_at', { ascending: false }),
      supabase.from('lessons').select('id, course_id, title'),
    ]);

    if (prog) setProgressRows(prog);
    if (less) setLessons(less);
  }

  function getStudentMetrics(student: StudentProfile) {
    const approvedCourseIds = new Set(
      subscriptions
        .filter((s) => s.user_id === student.id && s.status === 'approved')
        .map((s) => s.course_id)
    );

    const assignedLessons =
      approvedCourseIds.size > 0
        ? lessons.filter((l) => approvedCourseIds.has(l.course_id))
        : lessons;

    const studentProgress = progressRows.filter((p) => p.user_id === student.id);
    const completedLessons = studentProgress.filter((p) => p.is_completed).length;

    const scoredQuizzes = studentProgress.filter(
      (p) => p.quiz_score !== null && p.quiz_score !== undefined
    );
    const averageQuizScore =
      scoredQuizzes.length > 0
        ? Math.round(
            scoredQuizzes.reduce((sum, p) => sum + (p.quiz_score || 0), 0) /
              scoredQuizzes.length
          )
        : null;

    const latestProgress = studentProgress[0];
    const recentLessonTitle = latestProgress
      ? lessons.find((l) => l.id === latestProgress.lesson_id)?.title || null
      : null;

    return {
      completedLessons,
      totalAssignedLessons: assignedLessons.length,
      averageQuizScore,
      quizzesTaken: scoredQuizzes.length,
      recentLessonTitle,
      recentQuizScore: latestProgress?.quiz_score ?? null,
    };
  }

  function openWhatsAppModal(student: StudentProfile) {
    const metrics = getStudentMetrics(student);
    const reportData: StudentReportData = {
      studentName: student.full_name || 'طالب كشكول',
      studentPhone: student.phone_number,
      parentPhone: student.parent_phone,
      completedLessons: metrics.completedLessons,
      totalAssignedLessons: metrics.totalAssignedLessons,
      averageQuizScore: metrics.averageQuizScore,
      quizzesTaken: metrics.quizzesTaken,
      lastActiveAt: student.last_active_at,
      recentLessonTitle: metrics.recentLessonTitle,
      recentQuizScore: metrics.recentQuizScore,
    };

    setSelectedStudent(student);
    setModalParentPhone(student.parent_phone || student.phone_number || '');
    setModalMessage(buildParentWhatsAppMessage(reportData));
    setCopied(false);
  }

  async function handleSaveParentPhoneAndSend() {
    if (!selectedStudent) return;
    const trimmedPhone = modalParentPhone.trim();

    if (trimmedPhone && trimmedPhone !== selectedStudent.parent_phone) {
      setSavingPhone(true);
      const { error } = await supabase
        .from('profiles')
        .update({ parent_phone: trimmedPhone })
        .eq('id', selectedStudent.id);

      if (!error) {
        setStudents((prev) =>
          prev.map((s) =>
            s.id === selectedStudent.id ? { ...s, parent_phone: trimmedPhone } : s
          )
        );
      }
      setSavingPhone(false);
    }

    const url = buildWhatsAppUrl(trimmedPhone, modalMessage);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleCopyMessage() {
    await navigator.clipboard.writeText(modalMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubscriptionDecision(subId: string, status: 'approved' | 'rejected') {
    setUpdatingSubId(subId);
    const { error } = await supabase
      .from('subscriptions')
      .update({ status })
      .eq('id', subId);

    if (!error) {
      setSubscriptions((prev) =>
        prev.map((s) => (s.id === subId ? { ...s, status } : s))
      );
    }
    setUpdatingSubId(null);
  }

  async function handleResetDevice(studentId: string) {
    setResettingId(studentId);
    const { error } = await supabase
      .from('profiles')
      .update({ active_device_id: null })
      .eq('id', studentId);

    if (!error) {
      setStudents((prev) =>
        prev.map((st) => (st.id === studentId ? { ...st, active_device_id: null } : st))
      );
    }
    setResettingId(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center dir-rtl" dir="rtl">
        <div className="text-slate-400 text-sm animate-pulse">جاري تحميل لوحة الإدارة...</div>
      </div>
    );
  }

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.phone_number || '').toLowerCase().includes(q) ||
      (s.parent_phone || '').toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 dir-rtl text-right" dir="rtl">
      <header className="bg-slate-900 border-b border-slate-800 px-4 sm:px-8 py-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[#FBBF24] text-[#1E3A8A] flex items-center justify-center font-black">
              ك
            </span>
            <div>
              <h1 className="text-base sm:text-lg font-black text-white">لوحة تحكم الإدارة</h1>
              <p className="text-xs text-slate-400">تقارير أولياء الأمور، الأجهزة، والاشتراكات</p>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-lg transition"
          >
            العودة للمنصة
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Section 1: Students Attendance, WhatsApp Reports & Device Locks */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-800">
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
              className="w-full sm:w-80 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FBBF24]"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400">
                  <th className="py-3 px-3 font-bold">الطالب</th>
                  <th className="py-3 px-3 font-bold">هاتف الطالب / ولي الأمر</th>
                  <th className="py-3 px-3 font-bold">الحضور والاختبارات</th>
                  <th className="py-3 px-3 font-bold">حالة الجهاز</th>
                  <th className="py-3 px-3 font-bold text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs sm:text-sm">
                {filteredStudents.map((student) => {
                  const isLocked = Boolean(student.active_device_id);
                  const metrics = getStudentMetrics(student);

                  return (
                    <tr key={student.id} className="hover:bg-slate-800/30">
                      <td className="py-3.5 px-3 font-bold text-white">
                        {student.full_name || 'بدون اسم'}
                        {student.role === 'admin' && (
                          <span className="mr-2 text-[10px] bg-[#FBBF24]/15 text-[#FBBF24] px-2 py-0.5 rounded">
                            أدمن
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 font-mono text-xs text-slate-300 space-y-1">
                        <div>طالب: {student.phone_number || '—'}</div>
                        <div className="text-emerald-400">
                          ولي الأمر: {student.parent_phone || 'غير مسجل'}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-xs space-y-1">
                        <div className="text-slate-200 font-bold">
                          الدروس: {metrics.completedLessons}/{metrics.totalAssignedLessons}
                        </div>
                        <div className="text-[#FBBF24] font-bold">
                          {metrics.averageQuizScore !== null
                            ? `متوسط الاختبار: ${metrics.averageQuizScore}%`
                            : 'لا توجد اختبارات'}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                            مرتبط ({student.active_device_id?.slice(0, 6)}...)
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-bold text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
                            غير مرتبط
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-left">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openWhatsAppModal(student)}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
                          >
                            تقرير ولي الأمر 💬
                          </button>

                          <button
                            type="button"
                            disabled={!isLocked || resettingId === student.id}
                            onClick={() => handleResetDevice(student.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 disabled:opacity-35 disabled:cursor-not-allowed"
                          >
                            {resettingId === student.id ? 'جاري الفك...' : 'فك الجهاز'}
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

        {/* Section 2: Subscription Approval Queue */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 sm:p-6">
          <div className="pb-4 mb-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-white">طلبات الاشتراك والدفع</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                مراجعة إيصالات فودافون كاش وإنستا باي وتفعيل الكورسات
              </p>
            </div>
            <span className="text-xs font-bold bg-slate-800 text-slate-300 px-3 py-1 rounded-lg">
              {subscriptions.length} طلبات
            </span>
          </div>

          {subscriptions.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">لا توجد طلبات اشتراك حالياً.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#FBBF24]">
                        {sub.courses?.title || 'كورس'}
                      </span>
                      <span
                        className={`text-[11px] font-black px-2.5 py-0.5 rounded-md ${
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
                    </div>

                    <p className="text-sm font-black text-white">
                      {sub.profiles?.full_name || 'طالب'} —{' '}
                      <span className="font-mono text-xs text-slate-400">
                        {sub.sender_phone || sub.profiles?.phone_number || ''}
                      </span>
                    </p>
                    <p className="text-xs text-slate-400">
                      الوسيلة: {sub.payment_method} • المبلغ: {sub.courses?.price ?? 0} ج.م
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      disabled={updatingSubId === sub.id || sub.status === 'approved'}
                      onClick={() => handleSubscriptionDecision(sub.id, 'approved')}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs rounded-lg transition cursor-pointer"
                    >
                      تفعيل الاشتراك
                    </button>
                    <button
                      type="button"
                      disabled={updatingSubId === sub.id || sub.status === 'rejected'}
                      onClick={() => handleSubscriptionDecision(sub.id, 'rejected')}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-red-500/20 hover:text-red-300 disabled:opacity-40 text-slate-300 font-bold text-xs rounded-lg transition cursor-pointer"
                    >
                      رفض
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Parent WhatsApp Report Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[11px] font-bold text-emerald-400 block">
                  تقارير المتابعة الفورية
                </span>
                <h3 className="text-base font-black text-white">
                  إرسال تقرير لولي أمر: {selectedStudent.full_name || 'طالب كشكول'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="text-slate-400 hover:text-white text-lg font-bold px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                رقم واتساب ولي الأمر (مصر 010 / 011 / 012 / 015)
              </label>
              <input
                type="tel"
                dir="ltr"
                value={modalParentPhone}
                onChange={(e) => setModalParentPhone(e.target.value)}
                placeholder="01012345678"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white text-left focus:outline-none focus:border-emerald-400"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                سيتم حفظ الرقم تلقائياً في ملف الطالب عند الإرسال.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                نص التقرير (قابل للتعديل قبل الإرسال)
              </label>
              <textarea
                rows={9}
                value={modalMessage}
                onChange={(e) => setModalMessage(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-xs sm:text-sm text-slate-100 leading-relaxed focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                disabled={savingPhone}
                onClick={handleSaveParentPhoneAndSend}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition cursor-pointer"
              >
                {savingPhone ? 'جاري الحفظ...' : 'إرسال عبر واتساب الآن 📲'}
              </button>

              <button
                type="button"
                onClick={handleCopyMessage}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer"
              >
                {copied ? 'تم النسخ ✓' : 'نسخ التقرير'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}