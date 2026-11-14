'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();

  const [isSignUp, setIsSignUp] = useState(false);

  // Shared fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Sign-up only fields
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [academicStage, setAcademicStage] = useState<'primary' | 'prep' | 'secondary'>('secondary');
  const [gradeLevel, setGradeLevel] = useState<number>(3);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isValidEgyptianMobile = (phone: string) => /^01[0125][0-9]{8}$/.test(phone.trim());

  const handleStageChange = (stage: 'primary' | 'prep' | 'secondary') => {
    setAcademicStage(stage);
    if (stage === 'primary') setGradeLevel(4);
    else setGradeLevel(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isSignUp) {
      // Login flow
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
        setLoading(false);
        return;
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        setLoading(false);
        if (profile?.role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/dashboard');
        }
      }
      return;
    }

    // Sign-up flow
    const cleanStudentPhone = phoneNumber.trim();
    const cleanParentPhone = parentPhone.trim();

    if (!isValidEgyptianMobile(cleanStudentPhone)) {
      setErrorMsg('يرجى إدخال رقم موبايل مصري صحيح للطالب (11 رقم يبدأ بـ 010 أو 011 أو 012 أو 015).');
      return;
    }

    if (!isValidEgyptianMobile(cleanParentPhone)) {
      setErrorMsg('يرجى إدخال رقم واتساب مصري صحيح لولي الأمر (11 رقم يبدأ بـ 010 أو 011 أو 012 أو 015).');
      return;
    }

    if (cleanStudentPhone === cleanParentPhone) {
      setErrorMsg('يجب أن يكون رقم واتساب ولي الأمر مختلفاً عن رقم الطالب.');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone_number: cleanStudentPhone,
          parent_phone: cleanParentPhone,
          academic_stage: academicStage,
          grade_level: gradeLevel,
        },
      },
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName.trim(),
        phone_number: cleanStudentPhone,
        parent_phone: cleanParentPhone,
        academic_stage: academicStage,
        grade_level: gradeLevel,
        role: 'student',
      });

      if (profileError) {
        setErrorMsg(profileError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    router.push('/dashboard');
  };

  return (
    <div
      className="min-h-screen bg-[#0F172A] text-slate-100 flex items-center justify-center p-4 dir-rtl text-right"
      dir="rtl"
    >
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-black text-white">
            <span className="w-9 h-9 rounded-lg bg-[#FBBF24] text-[#1E3A8A] flex items-center justify-center font-extrabold">
              ك
            </span>
            <span>كشكول</span>
          </Link>
          <h1 className="text-xl font-black text-white mt-4">
            {isSignUp ? 'إنشاء حساب طالب جديد' : 'تسجيل الدخول إلى منصتك'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isSignUp
              ? 'سجّل بياناتك وبيانات ولي الأمر لمتابعة الدروس والاختبارات'
              : 'أهلاً بعودتك! أكمل رحلتك التعليمية الآن'}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-xl border border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setErrorMsg(null);
            }}
            className={`py-2 rounded-lg text-xs sm:text-sm font-black transition cursor-pointer ${
              !isSignUp
                ? 'bg-[#1E3A8A] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setErrorMsg(null);
            }}
            className={`py-2 rounded-lg text-xs sm:text-sm font-black transition cursor-pointer ${
              isSignUp
                ? 'bg-[#FBBF24] text-[#0F172A] shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            حساب جديد
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-bold leading-relaxed">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  الاسم الثلاثي للطالب
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: أحمد محمد محمود"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FBBF24]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    رقم موبايل الطالب
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    required
                    maxLength={11}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="01012345678"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white text-left focus:outline-none focus:border-[#FBBF24]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-400 mb-1.5">
                    رقم واتساب ولي الأمر 💬
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    required
                    maxLength={11}
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="01112345678"
                    className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white text-left focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    المرحلة الدراسية
                  </label>
                  <select
                    value={academicStage}
                    onChange={(e) =>
                      handleStageChange(e.target.value as 'primary' | 'prep' | 'secondary')
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FBBF24]"
                  >
                    <option value="primary">المرحلة الابتدائية</option>
                    <option value="prep">المرحلة الإعدادية</option>
                    <option value="secondary">المرحلة الثانوية</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    الصف الدراسي
                  </label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FBBF24]"
                  >
                    {academicStage === 'primary' ? (
                      <>
                        <option value={4}>الصف الرابع</option>
                        <option value={5}>الصف الخامس</option>
                        <option value={6}>الصف السادس</option>
                      </>
                    ) : (
                      <>
                        <option value={1}>الصف الأول</option>
                        <option value={2}>الصف الثاني</option>
                        <option value={3}>الصف الثالث</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              dir="ltr"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white text-left focus:outline-none focus:border-[#FBBF24]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              كلمة المرور
            </label>
            <input
              type="password"
              dir="ltr"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white text-left focus:outline-none focus:border-[#FBBF24]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#FBBF24] hover:bg-amber-400 disabled:opacity-50 text-[#0F172A] font-black text-sm rounded-xl transition cursor-pointer mt-2"
          >
            {loading
              ? isSignUp
                ? 'جاري إنشاء الحساب...'
                : 'جاري تسجيل الدخول...'
              : isSignUp
              ? 'إنشاء الحساب'
              : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}