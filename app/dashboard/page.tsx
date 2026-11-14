'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

interface Course {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  academic_stage: 'primary' | 'prep' | 'secondary';
  grade_level: number;
  price: number;
  term_price: number | null;
  teacher_id: string | null;
  profiles?: {
    full_name: string | null;
    teacher_subject: string | null;
  } | null;
}

interface Bundle {
  id: string;
  title: string;
  description: string | null;
  academic_stage: 'primary' | 'prep' | 'secondary';
  grade_level: number;
  price: number;
  original_price: number | null;
  duration_days: number;
  courses: { id: string; title: string; subject: string }[];
}

interface Subscription {
  id: string;
  course_id: string;
  status: 'pending' | 'approved' | 'rejected';
  expires_at: string | null;
  plan_type: string;
}

const STAGE_LABELS: Record<string, string> = {
  primary: 'المرحلة الابتدائية',
  prep: 'المرحلة الإعدادية',
  secondary: 'المرحلة الثانوية',
};

export default function StudentDashboardStorePage() {
  const router = useRouter();

  const [studentName, setStudentName] = useState('طالب كشكول');
  const [userRole, setUserRole] = useState<'student' | 'teacher' | 'admin'>('student');

  const [courses, setCourses] = useState<Course[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [lessonCounts, setLessonCounts] = useState<Record<string, number>>({});

  // Storefront UI State
  const [activeView, setActiveView] = useState<'store' | 'my_courses'>('store');
  const [stageFilter, setStageFilter] = useState<'all' | 'primary' | 'prep' | 'secondary'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cartIds, setCartIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStoreData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const [
        { data: profile },
        { data: coursesData },
        { data: bundlesData },
        { data: subsData },
        { data: lessonsData },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, role, academic_stage')
          .eq('id', user.id)
          .single(),
        supabase
          .from('courses')
          .select(`
            id,
            title,
            description,
            subject,
            academic_stage,
            grade_level,
            price,
            term_price,
            teacher_id,
            profiles:teacher_id ( full_name, teacher_subject )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('bundles')
          .select(`
            id,
            title,
            description,
            academic_stage,
            grade_level,
            price,
            original_price,
            duration_days,
            bundle_courses (
              courses:course_id ( id, title, subject )
            )
          `)
          .eq('is_active', true),
        supabase
          .from('subscriptions')
          .select('id, course_id, status, expires_at, plan_type')
          .eq('user_id', user.id),
        supabase.from('lessons').select('id, course_id'),
      ]);

      if (profile) {
        setStudentName(profile.full_name || user.email?.split('@')[0] || 'طالب كشكول');
        setUserRole((profile.role as 'student' | 'teacher' | 'admin') || 'student');
      }

      if (coursesData) setCourses(coursesData as unknown as Course[]);

      if (bundlesData) {
        const formattedBundles: Bundle[] = bundlesData.map((b: any) => ({
          id: b.id,
          title: b.title,
          description: b.description,
          academic_stage: b.academic_stage,
          grade_level: b.grade_level,
          price: b.price,
          original_price: b.original_price,
          duration_days: b.duration_days,
          courses: (b.bundle_courses || [])
            .map((bc: any) => bc.courses)
            .filter(Boolean),
        }));
        setBundles(formattedBundles);
      }

      if (subsData) setSubscriptions(subsData);

      if (lessonsData) {
        const counts: Record<string, number> = {};
        lessonsData.forEach((l) => {
          counts[l.course_id] = (counts[l.course_id] || 0) + 1;
        });
        setLessonCounts(counts);
      }

      setLoading(false);
    }

    loadStoreData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getCourseAccessState = (courseId: string) => {
    if (userRole === 'admin') return { status: 'active' as const, daysLeft: null };
    const now = new Date();
    const courseSubs = subscriptions.filter((s) => s.course_id === courseId);

    const activeSub = courseSubs.find(
      (s) => s.status === 'approved' && (!s.expires_at || new Date(s.expires_at) > now)
    );
    if (activeSub) {
      const daysLeft = activeSub.expires_at
        ? Math.max(
            1,
            Math.ceil(
              (new Date(activeSub.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            )
          )
        : null;
      return { status: 'active' as const, daysLeft };
    }

    const pendingSub = courseSubs.find((s) => s.status === 'pending');
    if (pendingSub) return { status: 'pending' as const, daysLeft: null };

    const expiredSub = courseSubs.find(
      (s) => s.status === 'approved' && s.expires_at && new Date(s.expires_at) <= now
    );
    if (expiredSub) return { status: 'expired' as const, daysLeft: 0 };

    return { status: 'available' as const, daysLeft: null };
  };

  const toggleCart = (courseId: string) => {
    setCartIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const handleProceedCartCheckout = () => {
    if (cartIds.length === 0) return;
    const primaryId = cartIds[0];
    const query = cartIds.length > 1 ? `?courses=${cartIds.join(',')}` : '';
    router.push(`/checkout/${primaryId}${query}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center dir-rtl" dir="rtl">
        <div className="text-slate-400 text-sm animate-pulse">جاري تحميل متجر الكورسات...</div>
      </div>
    );
  }

  const enrolledCourses = courses.filter((c) => {
    const state = getCourseAccessState(c.id).status;
    return state === 'active' || state === 'pending' || state === 'expired';
  });

  const filteredCourses = courses.filter((c) => {
    const matchesStage = stageFilter === 'all' || c.academic_stage === stageFilter;
    const q = searchQuery.trim().toLowerCase();
    const teacherName = (c.profiles?.full_name || '').toLowerCase();
    const matchesQuery =
      !q ||
      c.title.toLowerCase().includes(q) ||
      c.subject.toLowerCase().includes(q) ||
      teacherName.includes(q) ||
      (c.description || '').toLowerCase().includes(q);
    return matchesStage && matchesQuery;
  });

  const filteredBundles = bundles.filter(
    (b) => stageFilter === 'all' || b.academic_stage === stageFilter
  );

  const cartCourses = courses.filter((c) => cartIds.includes(c.id));
  const cartTotal = cartCourses.reduce((sum, c) => sum + Number(c.price || 0), 0);

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 pb-28 dir-rtl text-right" dir="rtl">
      {/* Top Navigation */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-4 sm:px-8 py-4 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-[#FBBF24] text-[#1E3A8A] flex items-center justify-center text-lg font-black">
              ك
            </span>
            <div>
              <h1 className="text-base sm:text-lg font-black text-white">منصة كشكول</h1>
              <p className="text-xs text-slate-400">أهلاً بك، {studentName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {(userRole === 'teacher' || userRole === 'admin') && (
              <Link
                href="/teacher"
                className="text-xs font-black bg-[#1E3A8A] hover:bg-blue-800 text-white px-3.5 py-2 rounded-xl transition"
              >
                لوحة المدرس
              </Link>
            )}
            {userRole === 'admin' && (
              <Link
                href="/admin"
                className="text-xs font-black bg-[#FBBF24]/15 border border-[#FBBF24]/40 text-[#FBBF24] hover:bg-[#FBBF24]/25 px-3.5 py-2 rounded-xl transition"
              >
                لوحة الإدارة
              </Link>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-2 rounded-xl transition cursor-pointer"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Main Mode Switcher: Course Shop vs. My Enrolled Courses */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-2 rounded-2xl">
          <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveView('store')}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
                activeView === 'store'
                  ? 'bg-[#FBBF24] text-[#0F172A] shadow'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              🛒 متجر الكورسات ({courses.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveView('my_courses')}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
                activeView === 'my_courses'
                  ? 'bg-[#1E3A8A] text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              📚 دروسي ({enrolledCourses.length})
            </button>
          </div>

          {activeView === 'store' && (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن مادة، كورس، أو اسم المدرس..."
              className="w-full sm:w-80 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FBBF24]"
            />
          )}
        </div>

        {activeView === 'store' ? (
          <>
            {/* Academic Stage Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { key: 'all', label: 'جميع المراحل' },
                  { key: 'primary', label: 'المرحلة الابتدائية' },
                  { key: 'prep', label: 'المرحلة الإعدادية' },
                  { key: 'secondary', label: 'المرحلة الثانوية' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStageFilter(tab.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-black border transition cursor-pointer ${
                    stageFilter === tab.key
                      ? 'bg-[#1E3A8A] border-[#FBBF24] text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Discount Bundles Shelf */}
            {filteredBundles.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <span>🎁 باقات التوفير الشاملة</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredBundles.map((bundle) => (
                    <div
                      key={bundle.id}
                      className="bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-900 border border-emerald-500/40 rounded-2xl p-5 flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[11px] font-black bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-lg">
                            {STAGE_LABELS[bundle.academic_stage]} - الصف {bundle.grade_level}
                          </span>
                          <span className="text-xs font-bold text-[#FBBF24]">
                            صلاحية {bundle.duration_days} يوم
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg font-black text-white">
                          {bundle.title}
                        </h3>
                        {bundle.description && (
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            {bundle.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {bundle.courses.map((c) => (
                            <span
                              key={c.id}
                              className="text-[11px] bg-slate-950/80 border border-slate-800 text-slate-200 px-2.5 py-1 rounded-lg"
                            >
                              ✓ {c.title}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                        <div>
                          <span className="text-xl font-black text-white">{bundle.price} ج.م</span>
                          {bundle.original_price && (
                            <span className="mr-2 text-xs text-slate-500 line-through">
                              {bundle.original_price} ج.م
                            </span>
                          )}
                        </div>
                        <Link
                          href={`/checkout/bundle?bundleId=${bundle.id}`}
                          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition"
                        >
                          اشترك في الباقة
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Course Store Grid */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-black text-white">
                الكورسات المتاحة للاشتراك
              </h2>

              {filteredCourses.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-sm">
                  لا توجد كورسات مطابقة لبحثك حالياً.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredCourses.map((course) => {
                    const access = getCourseAccessState(course.id);
                    const inCart = cartIds.includes(course.id);
                    const count = lessonCounts[course.id] || 0;

                    return (
                      <div
                        key={course.id}
                        className={`bg-slate-900/90 border rounded-2xl p-5 flex flex-col justify-between gap-4 transition ${
                          inCart
                            ? 'border-[#FBBF24] shadow-lg shadow-amber-500/10'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-black text-[#FBBF24] bg-[#FBBF24]/10 px-2.5 py-1 rounded-lg">
                              {course.subject}
                            </span>
                            <span className="text-[11px] text-slate-400 font-bold">
                              {STAGE_LABELS[course.academic_stage]} • صف {course.grade_level}
                            </span>
                          </div>

                          <h3 className="text-base font-black text-white leading-snug">
                            {course.title}
                          </h3>

                          {course.profiles?.full_name && (
                            <div className="text-xs font-bold text-emerald-400">
                              👨‍🏫 أ/ {course.profiles.full_name}
                            </div>
                          )}

                          {course.description && (
                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                              {course.description}
                            </p>
                          )}

                          <div className="flex items-center gap-3 text-[11px] text-slate-300 pt-1">
                            <span>🎬 {count} دروس</span>
                            <span>📄 ورق الدرس PDF</span>
                            <span>📝 اختبارات</span>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-800 space-y-3">
                          <div className="flex items-baseline justify-between">
                            <div>
                              <span className="text-xl font-black text-white">
                                {course.price} ج.م
                              </span>
                              <span className="text-[11px] text-slate-400 mr-1">/ شهري</span>
                            </div>
                            {course.term_price && (
                              <span className="text-[11px] text-emerald-400 font-bold">
                                الترم: {course.term_price} ج.م
                              </span>
                            )}
                          </div>

                          {access.status === 'active' ? (
                            <Link
                              href={`/courses/${course.id}`}
                              className="block w-full text-center py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition"
                            >
                              دخول الكورس الآن ←
                            </Link>
                          ) : access.status === 'pending' ? (
                            <div className="w-full text-center py-2.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 font-black text-xs rounded-xl">
                              ⏳ طلبك قيد المراجعة
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/checkout/${course.id}`}
                                className="flex-1 text-center py-2.5 bg-[#FBBF24] hover:bg-amber-400 text-[#0F172A] font-black text-xs rounded-xl transition"
                              >
                                {access.status === 'expired' ? 'تجديد الاشتراك' : 'اشترك الآن'}
                              </Link>
                              <button
                                type="button"
                                onClick={() => toggleCart(course.id)}
                                className={`px-3 py-2.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                                  inCart
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                                }`}
                              >
                                {inCart ? 'في السلة ✓' : '+ للسلة'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : (
          /* My Enrolled Courses Tab */
          <section className="space-y-4">
            <h2 className="text-base sm:text-lg font-black text-white">كورساتي المشترك بها</h2>
            {enrolledCourses.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
                <p className="text-sm text-slate-400">لم تشترك في أي كورس بعد.</p>
                <button
                  type="button"
                  onClick={() => setActiveView('store')}
                  className="px-5 py-2.5 bg-[#FBBF24] text-[#0F172A] font-black text-xs rounded-xl cursor-pointer"
                >
                  تصفح متجر الكورسات
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {enrolledCourses.map((course) => {
                  const access = getCourseAccessState(course.id);
                  return (
                    <div
                      key={course.id}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-[#FBBF24]">
                            {course.subject}
                          </span>
                          {access.status === 'active' && (
                            <span className="text-[11px] font-bold bg-emerald-500/15 text-emerald-300 px-2.5 py-0.5 rounded">
                              {access.daysLeft ? `متبقي ${access.daysLeft} يوم` : 'مفعّل'}
                            </span>
                          )}
                          {access.status === 'pending' && (
                            <span className="text-[11px] font-bold bg-amber-500/15 text-amber-300 px-2.5 py-0.5 rounded">
                              قيد المراجعة
                            </span>
                          )}
                          {access.status === 'expired' && (
                            <span className="text-[11px] font-bold bg-red-500/15 text-red-300 px-2.5 py-0.5 rounded">
                              منتهي الصلاحية
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-black text-white">{course.title}</h3>
                        {course.profiles?.full_name && (
                          <p className="text-xs text-slate-400 mt-1">
                            أ/ {course.profiles.full_name}
                          </p>
                        )}
                      </div>

                      {access.status === 'active' ? (
                        <Link
                          href={`/courses/${course.id}`}
                          className="block w-full text-center py-2.5 bg-[#1E3A8A] hover:bg-blue-800 text-white font-black text-xs rounded-xl transition"
                        >
                          متابعة المذاكرة ←
                        </Link>
                      ) : access.status === 'expired' ? (
                        <Link
                          href={`/checkout/${course.id}`}
                          className="block w-full text-center py-2.5 bg-[#FBBF24] text-[#0F172A] font-black text-xs rounded-xl transition"
                        >
                          تجديد الاشتراك الآن
                        </Link>
                      ) : (
                        <div className="text-center text-xs text-slate-400 py-2">
                          جاري مراجعة إيصال التحويل...
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Floating Multi-Course Shopping Cart Bar */}
      {cartIds.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-3xl mx-auto bg-slate-900/95 border-2 border-[#FBBF24] rounded-2xl p-4 shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs sm:text-sm font-black text-white">
              🛒 السلة: {cartIds.length} {cartIds.length === 1 ? 'كورس' : 'كورسات'} مختارة
            </p>
            <p className="text-xs text-[#FBBF24] font-bold">
              الإجمالي الشهري: {cartTotal} ج.م
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCartIds([])}
              className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
            >
              إفراغ
            </button>
            <button
              type="button"
              onClick={handleProceedCartCheckout}
              className="px-5 py-2.5 bg-[#FBBF24] hover:bg-amber-400 text-[#0F172A] font-black text-xs sm:text-sm rounded-xl transition cursor-pointer"
            >
              إتمام الاشتراك الآن ←
            </button>
          </div>
        </div>
      )}
    </div>
  );
}