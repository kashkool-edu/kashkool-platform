import Link from 'next/link';

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-[#1E3A8A] text-white flex flex-col justify-between p-6 dir-rtl text-right" dir="rtl">
      {/* Header Badge */}
      <header className="max-w-4xl mx-auto w-full pt-6 flex justify-between items-center">
        <div className="text-2xl font-black tracking-wider">
          كشكول <span className="text-[#FBBF24]">.</span>
        </div>
        <span className="bg-white/10 text-[#FBBF24] text-xs px-3 py-1.5 rounded-full border border-white/20 font-bold backdrop-blur-sm">
          تطبيق الثانوية العامة ⚡
        </span>
      </header>

      {/* Hero Section */}
      <main className="max-w-2xl mx-auto text-center my-auto py-12 flex flex-col items-center">
        <div className="text-6xl mb-6 animate-bounce">🎒✨</div>
        
        <div className="inline-block bg-[#FBBF24] text-[#1E3A8A] font-black text-xs px-4 py-1.5 rounded-full mb-6 uppercase tracking-widest shadow-md">
          جاري التجهيز للإنطلاق الكبير
        </div>

        <h1 className="text-4xl md:text-6xl font-black leading-tight text-white mb-6">
          بنحضّرك لـ <span className="text-[#FBBF24] underline underline-offset-8 decoration-wavy decoration-[#FBBF24]">كشكول</span> جديد خالص!
        </h1>

        <p className="text-lg md:text-xl text-slate-200 mb-8 max-w-lg leading-relaxed">
          فرْم المناهج والملخصات من غير ما تسقط مننا في السكة. شغالين بنعدّل ونجهّز أقوى تجربة للثانوية العامة... انتظرونا قريباً جداً 🚀
        </p>

        {/* Feature Teasers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-10 text-right">
          <div className="bg-white/5 border border-white/10 p-4 rounded-xl text-center">
            <div className="text-2xl mb-1">📝</div>
            <div className="font-bold text-sm text-white">ورق الدرس جاهز</div>
          </div>
          <div className="bg-white/5 border border-white/10 p-4 rounded-xl text-center">
            <div className="text-2xl mb-1">⚡</div>
            <div className="font-bold text-sm text-white">تفعيل فوري بالباي</div>
          </div>
          <div className="bg-white/5 border border-white/10 p-4 rounded-xl text-center">
            <div className="text-2xl mb-1">🎯</div>
            <div className="font-bold text-sm text-white">حل امتحانات السنين</div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <Link
            href="/login"
            className="w-full py-3.5 bg-[#FBBF24] hover:bg-amber-400 text-[#1E3A8A] font-black rounded-xl text-center transition shadow-lg hover:scale-[1.02] active:scale-95"
          >
            تسجيل دخول الطلاب (تجريبي) 🔑
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center pb-4 text-xs text-slate-400">
        © {new Date().getFullYear()} كشكول — جميع الحقوق محفوظة لطلاب الثانوية العامة.
      </footer>
    </div>
  );
}