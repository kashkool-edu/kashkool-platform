'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

interface Course {
  id: string;
  title: string;
  subject: string;
  price: number;
  term_price: number | null;
}

interface Bundle {
  id: string;
  title: string;
  description: string | null;
  price: number;
  original_price: number | null;
  duration_days: number;
  courses: { id: string; title: string; subject: string }[];
}

function CheckoutContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const courseId = params?.courseId as string;
  const queryBundleId = searchParams?.get('bundleId');
  const queryCoursesParam = searchParams?.get('courses');

  const [selectedCourses, setSelectedCourses] = useState<Course[]>([]);
  const [availableBundles, setAvailableBundles] = useState<Bundle[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'term' | 'bundle'>(
    queryBundleId ? 'bundle' : 'monthly'
  );
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(queryBundleId);

  const [paymentMethod, setPaymentMethod] = useState<'vodafone_cash' | 'instapay'>('vodafone_cash');
  const [senderPhone, setSenderPhone] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Support single courseId OR multi-course cart (?courses=id1,id2,...)
      const targetIds = queryCoursesParam
        ? queryCoursesParam.split(',').filter(Boolean)
        : courseId && courseId !== 'bundle'
        ? [courseId]
        : [];

      if (targetIds.length > 0) {
        const { data: coursesData } = await supabase
          .from('courses')
          .select('id, title, subject, price, term_price')
          .in('id', targetIds);

        if (coursesData) setSelectedCourses(coursesData);
      }

      const { data: bundlesData } = await supabase
        .from('bundles')
        .select(`
          id,
          title,
          description,
          price,
          original_price,
          duration_days,
          bundle_courses (
            courses:course_id ( id, title, subject )
          )
        `)
        .eq('is_active', true);

      if (bundlesData) {
        const formatted: Bundle[] = bundlesData.map((b: any) => ({
          id: b.id,
          title: b.title,
          description: b.description,
          price: b.price,
          original_price: b.original_price,
          duration_days: b.duration_days,
          courses: (b.bundle_courses || [])
            .map((bc: any) => bc.courses)
            .filter(Boolean),
        }));

        const relevant = queryBundleId
          ? formatted.filter((b) => b.id === queryBundleId)
          : formatted.filter((b) => b.courses.some((c) => targetIds.includes(c.id)));

        setAvailableBundles(relevant);
        if (relevant.length > 0 && !selectedBundleId) {
          setSelectedBundleId(relevant[0].id);
        }
      }

      setLoading(false);
    }

    loadData();
  }, [courseId, queryBundleId, queryCoursesParam, router, selectedBundleId]);

  const activeBundle =
    availableBundles.find((b) => b.id === selectedBundleId) || availableBundles[0] || null;

  const monthlyTotal = selectedCourses.reduce((sum, c) => sum + Number(c.price || 0), 0);
  const termTotal = selectedCourses.reduce(
    (sum, c) => sum + Number(c.term_price ?? Math.round(c.price * 2.5)),
    0
  );

  const currentAmount =
    selectedPlan === 'bundle' && activeBundle
      ? activeBundle.price
      : selectedPlan === 'term'
      ? termTotal
      : monthlyTotal;

  const currentDurationDays =
    selectedPlan === 'bundle' && activeBundle
      ? activeBundle.duration_days
      : selectedPlan === 'term'
      ? 120
      : 30;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    if (!/^01[0125][0-9]{8}$/.test(senderPhone.trim())) {
      setErrorMsg('يرجى إدخال رقم الهاتف المحوِّل منه بشكل صحيح (11 رقم).');
      return;
    }

    setSubmitting(true);

    let receiptUrl: string | null = null;
    if (receiptFile) {
      const ext = receiptFile.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, receiptFile);

      if (uploadError) {
        setErrorMsg('حدث خطأ أثناء رفع صورة الإيصال: ' + uploadError.message);
        setSubmitting(false);
        return;
      }
      receiptUrl = filePath;
    }

    const targetCourseIds =
      selectedPlan === 'bundle' && activeBundle
        ? activeBundle.courses.map((c) => c.id)
        : selectedCourses.map((c) => c.id);

    if (targetCourseIds.length === 0) {
      setErrorMsg('لم يتم تحديد أي كورسات صالحة.');
      setSubmitting(false);
      return;
    }

    const rowsToInsert = targetCourseIds.map((cid) => ({
      user_id: user.id,
      course_id: cid,
      bundle_id: selectedPlan === 'bundle' && activeBundle ? activeBundle.id : null,
      plan_type: selectedPlan,
      duration_days: currentDurationDays,
      status: 'pending',
      payment_method: paymentMethod,
      sender_phone: senderPhone.trim(),
      receipt_url: receiptUrl,
    }));

    const { error: insertError } = await supabase
      .from('subscriptions')
      .insert(rowsToInsert);

    if (insertError) {
      setErrorMsg(insertError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSubmitted(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center dir-rtl" dir="rtl">
        <div className="text-slate-400 text-sm animate-pulse">جاري تجهيز صفحة الاشتراك...</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-slate-100 flex items-center justify-center p-4 dir-rtl text-right" dir="rtl">
        <div className="max-w-md w-full bg-slate-900 border border-emerald-500/40 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto mb-4 text-2xl font-black">
            ✓
          </div>
          <h2 className="text-xl font-black text-white mb-2">تم استلام طلب الاشتراك بنجاح</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            سيتم مراجعة التحويل وتفعيل اشتراكك لمدة{' '}
            <span className="text-[#FBBF24] font-bold">{currentDurationDays} يوم</span> خلال دقائق.
          </p>
          <Link
            href="/dashboard"
            className="inline-block w-full py-3 bg-[#FBBF24] hover:bg-amber-400 text-[#0F172A] font-black text-sm rounded-xl transition"
          >
            العودة إلى المتجر ودروسي
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 p-4 sm:p-8 dir-rtl text-right" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-lg transition"
          >
            ← العودة للمتجر
          </Link>
          <span className="text-lg font-black text-white flex items-center gap-2">
            <span className="w-7 h-7 rounded-md bg-[#FBBF24] text-[#1E3A8A] flex items-center justify-center text-sm font-extrabold">
              ك
            </span>
            <span>كشكول</span>
          </span>
        </div>

        {/* Selected Courses Summary */}
        {selectedCourses.length > 0 && selectedPlan !== 'bundle' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
            <span className="text-xs font-bold text-slate-400 block">
              الكورسات المختارة ({selectedCourses.length}):
            </span>
            <div className="flex flex-wrap gap-2">
              {selectedCourses.map((c) => (
                <span
                  key={c.id}
                  className="text-xs font-bold bg-slate-950 border border-slate-800 text-white px-3 py-1.5 rounded-xl"
                >
                  {c.title} ({c.price} ج.م)
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Plan Selection Cards */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
          <h1 className="text-lg sm:text-xl font-black text-white">اختر نظام الاشتراك المناسب</h1>

          {selectedCourses.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedPlan('monthly')}
                className={`p-4 rounded-xl border text-right transition cursor-pointer ${
                  selectedPlan === 'monthly'
                    ? 'bg-[#1E3A8A]/50 border-[#FBBF24]'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-300">اشتراك شهري</span>
                  <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                    30 يوم
                  </span>
                </div>
                <div className="text-xl font-black text-white">{monthlyTotal} ج.م</div>
                <p className="text-[11px] text-slate-400 mt-1">
                  لـ {selectedCourses.length} {selectedCourses.length === 1 ? 'كورس' : 'كورسات'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPlan('term')}
                className={`p-4 rounded-xl border text-right transition cursor-pointer ${
                  selectedPlan === 'term'
                    ? 'bg-[#1E3A8A]/50 border-[#FBBF24]'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[#FBBF24]">اشتراك الترم الكامل</span>
                  <span className="text-[11px] bg-[#FBBF24]/15 text-[#FBBF24] px-2 py-0.5 rounded font-bold">
                    120 يوم
                  </span>
                </div>
                <div className="text-xl font-black text-white">{termTotal} ج.م</div>
                <p className="text-[11px] text-slate-400 mt-1">توفير طوال الفصل الدراسي</p>
              </button>
            </div>
          )}

          {/* Multi-Course Discount Bundle Option */}
          {activeBundle && (
            <button
              type="button"
              onClick={() => setSelectedPlan('bundle')}
              className={`w-full p-4 rounded-xl border text-right transition cursor-pointer ${
                selectedPlan === 'bundle'
                  ? 'bg-emerald-500/15 border-emerald-400'
                  : 'bg-slate-950/70 border-emerald-500/30 hover:border-emerald-400/60'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-black text-emerald-300">
                  🎁 {activeBundle.title}
                </span>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded font-bold">
                  {activeBundle.duration_days} يوم • {activeBundle.courses.length} كورسات
                </span>
              </div>

              <div className="flex items-baseline gap-2.5">
                <span className="text-2xl font-black text-white">{activeBundle.price} ج.م</span>
                {activeBundle.original_price && (
                  <span className="text-xs text-slate-500 line-through">
                    {activeBundle.original_price} ج.م
                  </span>
                )}
              </div>

              {activeBundle.description && (
                <p className="text-xs text-slate-300 mt-1.5">{activeBundle.description}</p>
              )}

              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {activeBundle.courses.map((c) => (
                  <span
                    key={c.id}
                    className="text-[11px] bg-slate-900 border border-slate-700 text-slate-200 px-2.5 py-0.5 rounded-md"
                  >
                    ✓ {c.title}
                  </span>
                ))}
              </div>
            </button>
          )}
        </div>

        {/* Payment Form */}
        <form
          onSubmit={handleCheckout}
          className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-sm font-bold text-slate-300">الإجمالي المطلوب تحويله:</span>
            <span className="text-xl font-black text-[#FBBF24]">
              {currentAmount} ج.م ({currentDurationDays} يوم)
            </span>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaymentMethod('vodafone_cash')}
              className={`py-3 rounded-xl border text-xs sm:text-sm font-black transition cursor-pointer ${
                paymentMethod === 'vodafone_cash'
                  ? 'bg-red-600/20 border-red-500 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              فودافون كاش
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('instapay')}
              className={`py-3 rounded-xl border text-xs sm:text-sm font-black transition cursor-pointer ${
                paymentMethod === 'instapay'
                  ? 'bg-purple-600/20 border-purple-500 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              إنستا باي (InstaPay)
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              رقم الهاتف المحوِّل منه
            </label>
            <input
              type="tel"
              dir="ltr"
              required
              maxLength={11}
              value={senderPhone}
              onChange={(e) => setSenderPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="01012345678"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white text-left focus:outline-none focus:border-[#FBBF24]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              صورة إيصال التحويل (سكرين شوت)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-300 file:ml-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-white hover:file:bg-slate-700"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-[#FBBF24] hover:bg-amber-400 disabled:opacity-50 text-[#0F172A] font-black text-sm rounded-xl transition cursor-pointer"
          >
            {submitting ? 'جاري إرسال الطلب...' : 'تأكيد طلب الاشتراك'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center dir-rtl" dir="rtl">
          <div className="text-slate-400 text-sm animate-pulse">جاري التحميل...</div>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}