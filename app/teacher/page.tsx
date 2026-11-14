'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

interface TeacherProfile {
  id: string;
  full_name: string | null;
  teacher_subject: string | null;
  teacher_bio: string | null;
  commission_rate: number;
  role: string;
}

interface CourseStat {
  id: string;
  title: string;
  subject: string;
  academic_stage: string;
  grade_level: number;
  price: number;
  term_price: number | null;
  activeStudents: number;
  grossSales: number;
  netEarnings: number;
}

interface EnrollmentTx {
  id: string;
  course_title: string;
  student_name: string;
  plan_type: string;
  amount_paid: number;
  platform_fee: number;
  teacher_net: number;
  expires_at: string | null;
  created_at: string;
}

interface PayoutRecord {
  id: string;
  amount: number;
  payment_method: string;
  transfer_reference: string | null;
  notes: string | null;
  status: 'pending' | 'paid';
  paid_at: string;
}

export default function TeacherDashboardPage() {
  const router = useRouter();

  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [courseStats, setCourseStats] = useState<CourseStat[]>([]);
  const [transactions, setTransactions] = useState<EnrollmentTx[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTeacherDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, teacher_subject, teacher_bio, commission_rate, role')
        .eq('id', user.id)
        .single();

      if (!profile || (profile.role !== 'teacher' && profile.role !== 'admin')) {
        router.push('/dashboard');
        return;
      }

      setTeacher(profile);

      // Fetch courses assigned to this teacher
      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, title, subject, academic_stage, grade_level, price, term_price')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      const teacherCourses = coursesData || [];
      const courseIds = teacherCourses.map((c) => c.id);

      let subsData: any[] = [];
      if (courseIds.length > 0) {
        const { data } = await supabase
          .from('subscriptions')
          .select(`
            id,
            course_id,
            plan_type,
            status,
            amount_paid,
            platform_fee,
            teacher_net,
            expires_at,
            created_at,
            profiles:user_id ( full_name )
          `)
          .in('course_id', courseIds)
          .eq('status', 'approved')
          .order('created_at', { ascending: false });

        subsData = data || [];
      }

      const { data: payoutsData } = await supabase
        .from('teacher_payouts')
        .select('*')
        .eq('teacher_id', user.id)
        .order('paid_at', { ascending: false });

      const now = new Date();
      const rate = Number(profile.commission_rate ?? 20);

      // Build per-course stats
      const computedCourses: CourseStat[] = teacherCourses.map((c) => {
        const courseSubs = subsData.filter((s) => s.course_id === c.id);
        const activeCount = courseSubs.filter(
          (s) => !s.expires_at || new Date(s.expires_at) > now
        ).length;

        const gross = courseSubs.reduce((sum, s) => {
          const amt = s.amount_paid !== null ? Number(s.amount_paid) : Number(c.price || 0);
          return sum + amt;
        }, 0);

        const net = courseSubs.reduce((sum, s) => {
          if (s.teacher_net !== null) return sum + Number(s.teacher_net);
          const amt = s.amount_paid !== null ? Number(s.amount_paid) : Number(c.price || 0);
          return sum + amt * (1 - rate / 100);
        }, 0);

        return {
          ...c,
          activeStudents: activeCount,
          grossSales: Math.round(gross * 100) / 100,
          netEarnings: Math.round(net * 100) / 100,
        };
      });

      const courseTitleMap = new Map(teacherCourses.map((c) => [c.id, c]));

      const computedTx: EnrollmentTx[] = subsData.map((s) => {
        const course = courseTitleMap.get(s.course_id);
        const gross =
          s.amount_paid !== null ? Number(s.amount_paid) : Number(course?.price || 0);
        const fee =
          s.platform_fee !== null
            ? Number(s.platform_fee)
            : Math.round(gross * (rate / 100) * 100) / 100;
        const net =
          s.teacher_net !== null
            ? Number(s.teacher_net)
            : Math.round((gross - fee) * 100) / 100;

        return {
          id: s.id,
          course_title: course?.title || 'كورس',
          student_name: s.profiles?.full_name || 'طالب',
          plan_type: s.plan_type || 'monthly',
          amount_paid: gross,
          platform_fee: fee,
          teacher_net: net,
          expires_at: s.expires_at,
          created_at: s.created_at,
        };
      });

      setCourseStats(computedCourses);
      setTransactions(computedTx);
      setPayouts(payoutsData || []);
      setLoading(false);
    }

    loadTeacherDashboard();
  }, [router]);

  if (loading || !teacher) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center dir-rtl" dir="rtl">
        <div className="text-slate-400 text-sm animate-pulse">جاري تحميل لوحة المدرس والأرباح...</div>
      </div>
    );
  }

  const totalGrossSales = courseStats.reduce((sum, c) => sum + c.grossSales, 0);
  const totalNetEarnings = courseStats.reduce((sum, c) => sum + c.netEarnings, 0);
  const totalPlatformCommission = Math.round((totalGrossSales - totalNetEarnings) * 100) / 100;
  const totalPaidOut = payouts
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const availableBalance = Math.max(0, Math.round((totalNetEarnings - totalPaidOut) * 100) / 100);
  const totalActiveStudents = courseStats.reduce((sum, c) => sum + c.activeStudents, 0);

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 p-4 sm:p-6 lg:p-8 dir-rtl text-right" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#FBBF24] text-[#1E3A8A] flex items-center justify-center text-lg font-black">
              ك
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white">
                لوحة المدرس: أ/ {teacher.full_name || 'معلم كشكول'}
              </h1>
              <p className="text-xs text-slate-400">
                نسبة مشاركة الأرباح: <span className="text-emerald-400 font-bold">{100 - Number(teacher.commission_rate)}% للمدرس</span> •{' '}
                <span className="text-slate-300">{Number(teacher.commission_rate)}% عمولة المنصة</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {teacher.role === 'admin' && (
              <Link
                href="/admin"
                className="text-xs font-black bg-[#FBBF24]/15 border border-[#FBBF24]/40 text-[#FBBF24] px-3.5 py-2.5 rounded-xl transition"
              >
                لوحة الإدارة
              </Link>
            )}
            <Link
              href="/dashboard"
              className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl transition"
            >
              تصفح المنصة
            </Link>
          </div>
        </header>

        {/* Financial KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <span className="text-xs font-bold text-slate-400">الطلاب النشطون حالياً</span>
            <div className="text-2xl sm:text-3xl font-black text-white mt-2">
              {totalActiveStudents} <span className="text-xs font-normal text-slate-400">طالب</span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <span className="text-xs font-bold text-slate-400">إجمالي المبيعات (Gross)</span>
            <div className="text-2xl sm:text-3xl font-black text-white mt-2">
              {totalGrossSales.toLocaleString('ar-EG')} <span className="text-sm text-[#FBBF24]">ج.م</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              عمولة المنصة ({teacher.commission_rate}%): {totalPlatformCommission} ج.م
            </p>
          </div>

          <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-5">
            <span className="text-xs font-bold text-emerald-300">صافي أرباحك الكلية</span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-2">
              {totalNetEarnings.toLocaleString('ar-EG')} <span className="text-sm">ج.م</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              تم تحويله مسبقاً: {totalPaidOut.toLocaleString('ar-EG')} ج.م
            </p>
          </div>

          <div className="bg-gradient-to-br from-[#1E3A8A]/60 to-slate-900 border border-[#FBBF24]/50 rounded-2xl p-5">
            <span className="text-xs font-bold text-[#FBBF24]">الرصيد المتاح للتسوية</span>
            <div className="text-2xl sm:text-3xl font-black text-white mt-2">
              {availableBalance.toLocaleString('ar-EG')} <span className="text-sm text-[#FBBF24]">ج.م</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1">يُحوّل عبر فودافون كاش أو إنستا باي</p>
          </div>
        </section>

        {/* Course Performance Breakdown */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-black text-white">أداء الكورسات وتوزيع الأرباح</h2>

          {courseStats.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              لا توجد كورسات مرتبطة بحسابك حتى الآن. تواصل مع إدارة المنصة لربط كورساتك.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400">
                    <th className="py-3 px-3">الكورس</th>
                    <th className="py-3 px-3">المادة</th>
                    <th className="py-3 px-3">الطلاب المشتركون</th>
                    <th className="py-3 px-3">إجمالي المبيعات</th>
                    <th className="py-3 px-3">صافي ربحك</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs sm:text-sm">
                  {courseStats.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/30">
                      <td className="py-3.5 px-3 font-bold text-white">{c.title}</td>
                      <td className="py-3.5 px-3 text-slate-300">{c.subject}</td>
                      <td className="py-3.5 px-3 font-bold text-[#FBBF24]">{c.activeStudents}</td>
                      <td className="py-3.5 px-3 text-slate-200">{c.grossSales} ج.م</td>
                      <td className="py-3.5 px-3 font-black text-emerald-400">{c.netEarnings} ج.م</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Bottom Grid: Recent Enrollments & Payout Ledger */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Enrolled Students Ledger */}
          <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="text-base sm:text-lg font-black text-white">سجل اشتراكات الطلاب</h2>
            {transactions.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">لا توجد اشتراكات مفعّلة بعد.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pl-1">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-white">
                        {tx.student_name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {tx.course_title} •{' '}
                        {tx.plan_type === 'bundle'
                          ? 'باقة'
                          : tx.plan_type === 'term'
                          ? 'ترم كامل'
                          : 'شهري'}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-xs sm:text-sm font-black text-emerald-400">
                        +{tx.teacher_net} ج.م
                      </div>
                      <div className="text-[10px] text-slate-500">
                        من أصل {tx.amount_paid} ج.م
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Payout Ledger */}
          <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="text-base sm:text-lg font-black text-white">سجل التحويلات المالية (Payouts)</h2>
            {payouts.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                لم يتم تسجيل أي تحويلات مالية لحسابك بعد.
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pl-1">
                {payouts.map((p) => (
                  <div
                    key={p.id}
                    className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs sm:text-sm font-black text-white">
                        {Number(p.amount).toLocaleString('ar-EG')} ج.م
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {p.payment_method} {p.transfer_reference ? `• مرجع: ${p.transfer_reference}` : ''}
                      </div>
                      {p.notes && <div className="text-[11px] text-slate-500 mt-0.5">{p.notes}</div>}
                    </div>
                    <div className="text-left">
                      <span className="text-[11px] font-bold bg-emerald-500/15 text-emerald-300 px-2.5 py-0.5 rounded-full">
                        تم التحويل
                      </span>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {new Date(p.paid_at).toLocaleDateString('ar-EG')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}