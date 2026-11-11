export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dir-rtl" dir="rtl">
      {/* Header / Navbar */}
      <header className="w-full border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-[#1E3A8A] tracking-tight">
              كشكول <span className="text-yellow-500">.</span>
            </span>
          </div>
          <a
            href="#login"
            className="px-5 py-2.5 rounded-xl font-bold bg-[#1E3A8A] text-white hover:opacity-90 transition-all text-sm shadow-md"
          >
            تسجيل الدخول
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-yellow-100 border border-yellow-300 text-yellow-900 text-xs font-semibold">
          🚀 المنصة الأذكى لطلاب الثانوية العامة
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-slate-900 leading-tight mb-6">
          ذاكر أذكى، مش أكتر <br /> مع <span className="text-[#1E3A8A] relative inline-block">
            منصة كشكول
            <span className="absolute bottom-1 left-0 w-full h-3 bg-yellow-400/40 -z-10 rounded"></span>
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          كل اللي محتاجه للثانوية العامة في مكان واحد: ملخصات مركزة، امتحانات تفاعلية، وشرح مبسط مع أفضل المدرسين.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#courses"
            className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold bg-[#1E3A8A] text-white text-base hover:opacity-95 shadow-lg shadow-blue-900/20 transition-all"
          >
            ابدأ المذاكرة مجاناً
          </a>
          <a
            href="#about"
            className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold bg-white border border-slate-300 text-slate-700 text-base hover:bg-slate-100 transition-all"
          >
            اكتشف المواد
          </a>
        </div>
      </section>
    </main>
  );
}