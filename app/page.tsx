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
          منصة التعليم لكل المراحل 📚
        </span>
      </header>

      {/* Hero Section */}
      <main className="max-w-2xl mx-auto text-center my-auto py-12 flex flex-col items-center">
        <div className="text-6xl mb-6 animate-bounce">🎒✨</div>
        
        <div className="inline-block bg-[#FBBF24] text-[#1E3A8A] font-black text-xs px-4 py-1.5 rounded-full mb-6 uppercase tracking-widest shadow-md">
          جاري التجهيز للإنطلاق الكبير
        </div>

        <h1 className="text-4xl md:text-6xl font-black leading-tight text-white mb-6">
          منصة <span className="text-[#FBBF24] underline underline-offset-8 decoration-wavy decoration-[#FBBF24]">كشكول</span> لكل المراحل التعليمية!
        </h1>

        <p className="text-lg md:text-xl text-slate-200 mb-8 max-w-lg leading-relaxed">
          ابتدائي، إعدادي، أو ثانوي... بنجهّزلك أقوى تجربة مذاكرة: ملخصات، امتحانات، ومتابعة أول بأول من غير تعقيد. انتظرونا قريباً جداً 🚀
        </p>

        {/* Academic Stages Badges */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-md mb-8">
          <div className="bg-white/10 border border-white/20 p-3 rounded-xl text-center">
            <span className="block text-xl mb-1">🌱</span>
            <span className="font-bold text-xs text-[#FBBF24]">ابتدائي</span>
          </div>
          <div className="bg-white/10 border border-white/20 p-3 rounded-xl text-center">
            <span className="block text-xl mb-1">⚡</span>
            <span className="font-bold text-xs text-[#FBBF24]">إعدادي</span>
          </div>
          <div className="bg-white/10 border border-white/20 p-3 rounded-xl text-center">
            <span className="block text-xl mb-1">🎯</span>
            <span className="font-bold text-xs text-[#FBBF24]">ثانوي</span>
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
        © 2026 كشكول — جميع الحقوق محفوظة لجميع المراحل التعليمية.
      </footer>
    </div>
  );
}