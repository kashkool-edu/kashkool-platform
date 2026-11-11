'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setUser(session.user);
      }
      setLoading(false);
    };

    checkUser();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 font-bold">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dir-rtl" dir="rtl">
      {/* Top Navbar */}
      <nav className="bg-[#1E3A8A] text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-wide">كشكول <span className="text-[#FBBF24]">.</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-200 hidden sm:inline">{user?.email}</span>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition"
          >
            تسجيل الخروج
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm mb-8">
          <h2 className="text-2xl font-bold text-[#1E3A8A]">مرحباً بك في كشكول 👋</h2>
          <p className="text-slate-600 mt-2">
            منصتك التعليمية لمواد الثانوية العامة. ابدأ متابعة دروسك واختباراتك اليوم.
          </p>
        </div>

        {/* Course Cards Grid */}
        <h3 className="text-xl font-bold text-slate-800 mb-4">المواد المتاحة</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-[#1E3A8A] font-bold mb-4">
              📐
            </div>
            <h4 className="text-lg font-bold text-slate-800">الرياضيات التطبيقية</h4>
            <p className="text-sm text-slate-500 mt-1">شرح كامل للمنهج وإجابة أسئلة الامتحانات.</p>
            <button className="mt-4 w-full py-2 bg-[#1E3A8A] text-white rounded-lg font-bold text-sm hover:bg-blue-900 transition">
              عرض الدروس
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-[#FBBF24] font-bold mb-4">
              🧪
            </div>
            <h4 className="text-lg font-bold text-slate-800">الكيمياء</h4>
            <p className="text-sm text-slate-500 mt-1">الكيمياء العضوية والتحليلية بالتفصيل.</p>
            <button className="mt-4 w-full py-2 bg-[#1E3A8A] text-white rounded-lg font-bold text-sm hover:bg-blue-900 transition">
              عرض الدروس
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-[#1E3A8A] font-bold mb-4">
              ⚡
            </div>
            <h4 className="text-lg font-bold text-slate-800">الفيزياء</h4>
            <p className="text-sm text-slate-500 mt-1">الكهربية والحديثة مع حل النماذج الاسترشادية.</p>
            <button className="mt-4 w-full py-2 bg-[#1E3A8A] text-white rounded-lg font-bold text-sm hover:bg-blue-900 transition">
              عرض الدروس
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}