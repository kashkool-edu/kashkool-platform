export default function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col justify-between p-6 dir-rtl text-right" dir="rtl">
      {/* Background Decorator */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#1E3A8A]/40 via-transparent to-transparent pointer-events-none" />

      {/* Header */}
      <header className="max-w-5xl mx-auto w-full pt-4 flex justify-between items-center z-10">
        <div className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-[#FBBF24] text-[#1E3A8A] flex items-center justify-center text-lg font-extrabold">ك</span>
          <span>كشكول</span>
        </div>
        <span className="bg-slate-800/80 text-[#FBBF24] text-xs px-3.5 py-1.5 rounded-md border border-slate-700 font-semibold backdrop-blur-md">
          المنصة التعليمية المتكاملة
        </span>
      </header>

      {/* Hero Section */}
      <main className="max-w-3xl mx-auto text-center my-auto py-16 flex flex-col items-center z-10">
        <div className="inline-flex items-center gap-2 bg-slate-800/60 border border-slate-700 px-4 py-1.5 rounded-full mb-8 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-[#FBBF24] animate-pulse" />
          <span className="text-xs font-medium text-slate-300">الإنطلاق القادم — تجربة تعليمية حديثة</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white leading-tight tracking-tight mb-6">
          تعلم أذكى، أسرع، وبدون تعقيد مع <span className="text-[#FBBF24]">كشكول</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 mb-10 max-w-xl leading-relaxed">
          منصة تعليمية مصممة خصيصاً لتنظيم الدراسة لكل المراحل. ملخصات تفاعلية، متابعة دقيقة، وتفعيل فوري لحصصك.
        </p>

        {/* Educational Stages Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mb-10 text-right">
          <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl backdrop-blur-sm">
            <span className="text-xs font-bold text-[#FBBF24] uppercase tracking-wider block mb-1">المرحلة الابتدائية</span>
            <p className="text-slate-300 text-sm font-medium">تأسيس متين ومفاهيم مبسطة</p>
          </div>
          <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl backdrop-blur-sm">
            <span className="text-xs font-bold text-[#FBBF24] uppercase tracking-wider block mb-1">المرحلة الإعدادية</span>
            <p className="text-slate-300 text-sm font-medium">تمكين وتدريب مستمر على الامتحانات</p>
          </div>
          <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl backdrop-blur-sm">
            <span className="text-xs font-bold text-[#FBBF24] uppercase tracking-wider block mb-1">المرحلة الثانوية</span>
            <p className="text-slate-300 text-sm font-medium">تغطية شاملا وورق دروس مكثف</p>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full text-center pb-4 text-xs text-slate-500 z-10 border-t border-slate-800/60 pt-4">
        © 2026 كشكول. جميع الحقوق محفوظة.
      </footer>
    </div>
  );
}