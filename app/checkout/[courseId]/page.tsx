'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

interface Course {
  id: string;
  title: string;
  description: string | null;
  academic_stage: 'primary' | 'prep' | 'secondary';
  grade_level: number;
  subject: string;
  price: number;
}

const STAGE_LABELS: Record<Course['academic_stage'], string> = {
  primary: 'المرحلة الابتدائية',
  prep: 'المرحلة الإعدادية',
  secondary: 'المرحلة الثانوية',
};

const PAYMENT_DESTINATIONS = {
  vodafone_cash: {
    label: 'فودافون كاش',
    account: '01000000000',
    instructions: 'حوّل المبلغ على رقم فودافون كاش التالي، ثم ارفع صورة إيصال التحويل أو رسالة التأكيد.',
  },
  instapay: {
    label: 'إنستا باي (InstaPay)',
    account: 'kashkool@instapay',
    instructions: 'حوّل المبلغ على عنوان InstaPay التالي، ثم ارفع لقطة شاشة (Screenshot) لعملية التحويل الناجحة.',
  },
};

function CheckoutContent() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [paymentMethod, setPaymentMethod] = useState<'vodafone_cash' | 'instapay'>('vodafone_cash');
  const [senderReference, setSenderReference] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function initCheckout() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserId(user.id);

      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseError || !courseData) {
        setErrorMsg('لم يتم العثور على الكورس المطلوب.');
        setLoading(false);
        return;
      }
      setCourse(courseData);

      const { data: subData } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle();

      if (subData) {
        setExistingStatus(subData.status);
      }

      setLoading(false);
    }

    if (courseId) initCheckout();
  }, [courseId, router]);

  const handleCopy = () => {
    navigator.clipboard.writeText(PAYMENT_DESTINATIONS[paymentMethod].account);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !course || !receiptFile || !senderReference.trim()) {
      setErrorMsg('يرجى إدخال رقم المحفظة/الحساب وإرفاق صورة الإيصال.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const fileExt = receiptFile.name.split('.').pop() || 'png';
      const filePath = `${userId}/${course.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, receiptFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          course_id: course.id,
          payment_method: paymentMethod,
          sender_reference: senderReference.trim(),
          receipt_image_path: filePath,
          status: 'pending',
        });

      if (dbError) throw dbError;

      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء إرسال الطلب. حاول مرة أخرى.';
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center dir-rtl" dir="rtl">
        <div className="text-slate-400 text-sm animate-pulse">جاري تحميل بيانات الاشتراك...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 p-4 sm:p-8 dir-rtl text-right" dir="rtl">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white transition">
            ← العودة للوحة التحكم
          </Link>
          <div className="text-xl font-black text-white flex items-center gap-2">
            <span className="w-7 h-7 rounded-md bg-[#FBBF24] text-[#1E3A8A] flex items-center justify-center text-sm font-extrabold">ك</span>
            <span>كشكول</span>
          </div>
        </div>

        {course && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#FBBF24] bg-[#FBBF24]/10 px-2.5 py-1 rounded-md">
                {STAGE_LABELS[course.academic_stage]} — الصف {course.grade_level}
              </span>
              <span className="text-xs text-slate-400">{course.subject}</span>
            </div>
            <h1 className="text-xl font-black text-white mb-1">{course.title}</h1>
            {course.description && (
              <p className="text-sm text-slate-400 mb-4">{course.description}</p>
            )}
            <div className="pt-3 border-t border-slate-700/80 flex items-center justify-between">
              <span className="text-sm text-slate-300">إجمالي المطلوب دفعه:</span>
              <span className="text-2xl font-black text-[#FBBF24]">{course.price} ج.م</span>
            </div>
          </div>
        )}

        {success || existingStatus ? (
          <div className="bg-slate-800/60 border border-[#FBBF24]/40 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[#FBBF24]/20 text-[#FBBF24] flex items-center justify-center mx-auto mb-4 text-xl font-black">
              ✓
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              {existingStatus === 'approved'
                ? 'تم تفعيل اشتراكك بالفعل!'
                : 'تم استلام إيصال الدفع بنجاح'}
            </h2>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              {existingStatus === 'approved'
                ? 'يمكنك الآن مشاهدة جميع دروس الكورس وتحميل ورق الدرس فوراً.'
                : 'يتم مراجعة التحويل من قبل الإدارة وسيتم فتح الكورس تلقائياً خلال دقائق.'}
            </p>
            <Link
              href="/dashboard"
              className="inline-block w-full py-3.5 bg-[#FBBF24] hover:bg-amber-400 text-[#0F172A] font-bold rounded-xl transition"
            >
              الانتقال إلى دروسي
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-200 mb-3">
                1. اختر وسيلة الدفع المناسبة
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('vodafone_cash')}
                  className={`p-3.5 rounded-xl border text-sm font-bold transition ${
                    paymentMethod === 'vodafone_cash'
                      ? 'bg-[#1E3A8A] border-[#FBBF24] text-white'
                      : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  فودافون كاش
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('instapay')}
                  className={`p-3.5 rounded-xl border text-sm font-bold transition ${
                    paymentMethod === 'instapay'
                      ? 'bg-[#1E3A8A] border-[#FBBF24] text-white'
                      : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  إنستا باي (InstaPay)
                </button>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                {PAYMENT_DESTINATIONS[paymentMethod].instructions}
              </p>
              <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5">
                <span className="font-mono text-base font-bold text-[#FBBF24] select-all" dir="ltr">
                  {PAYMENT_DESTINATIONS[paymentMethod].account}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-md transition"
                >
                  {copied ? 'تم النسخ ✓' : 'نسخ'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-200 mb-2">
                2. {paymentMethod === 'vodafone_cash' ? 'رقم المحفظة المحوّل منها' : 'عنوان InstaPay أو الرقم المحوّل منه'}
              </label>
              <input
                type="text"
                required
                value={senderReference}
                onChange={(e) => setSenderReference(e.target.value)}
                placeholder={paymentMethod === 'vodafone_cash' ? 'مثال: 01012345678' : 'مثال: ahmed@instapay'}
                className="w-full bg-slate-900/80 border border-slate-700 focus:border-[#FBBF24] rounded-xl px-4 py-3 text-sm text-white outline-none transition"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-200 mb-2">
                3. صورة إيصال التحويل (Screenshot)
              </label>
              <input
                type="file"
                accept="image/*"
                required
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-300 file:ml-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#FBBF24] file:text-[#0F172A] hover:file:bg-amber-400 bg-slate-900/80 border border-slate-700 rounded-xl p-2 cursor-pointer"
              />
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-[#FBBF24] hover:bg-amber-400 disabled:opacity-50 text-[#0F172A] font-black rounded-xl transition shadow-md cursor-pointer"
            >
              {submitting ? 'جاري رفع الإيصال وتأكيد الطلب...' : 'تأكيد الدفع وإرسال الإيصال'}
            </button>
          </form>
        )}
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