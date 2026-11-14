'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

interface SubscriptionItem {
  id: string;
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

interface StudentDeviceProfile {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  role: string;
  active_device_id: string | null;
  last_active_at: string | null;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [students, setStudents] = useState<StudentDeviceProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [updatingSubId, setUpdatingSubId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

      await Promise.all([fetchSubscriptions(), fetchStudents()]);
      setLoading(false);
    }

    initAdmin();
  }, [router]);

  async function fetchSubscriptions() {
    const { data } = await supabase
      .from('subscriptions')
      .select(`
        id,
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
      .select('id, full_name, phone_number, role, active_device_id, last_active_at')
      .order('last_active_at', { ascending: false });

    if (data) setStudents(data);
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
              <p className="text-xs text-slate-400">مراجعة الاشتراكات وإدارة أجهزة الطلاب</p>
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
        {/* Section 1: One-Click Student Device Reset */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-black text-white">إدارة أجهزة الطلاب (Device Locks)</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                فك ارتباط الجهاز عند قيام الطالب بتغيير هاتفه أو متصفحه
              </p>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو رقم الهاتف..."
              className="w-full sm:w-72 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FBBF24]"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400">
                  <th className="py-3 px-3 font-bold">الطالب</th>
                  <th className="py-3 px-3 font-bold">رقم الهاتف</th>
                  <th className="py-3 px-3 font-bold">حالة الجهاز</th>
                  <th className="py-3 px-3 font-bold text-left">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs sm:text-sm">
                {filteredStudents.map((student) => {
                  const isLocked = Boolean(student.active_device_id);
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
                      <td className="py-3.5 px-3 font-mono text-slate-300">
                        {student.phone_number || '—'}
                      </td>
                      <td className="py-3.5 px-3">
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                            مرتبط بجهاز ({student.active_device_id?.slice(0, 6)}...)
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-bold text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
                            غير مرتبط
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-left">
                        <button
                          type="button"
                          disabled={!isLocked || resettingId === student.id}
                          onClick={() => handleResetDevice(student.id)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 disabled:opacity-35 disabled:cursor-not-allowed"
                        >
                          {resettingId === student.id ? 'جاري الفك...' : 'فك ارتباط الجهاز'}
                        </button>
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
    </div>
  );
}