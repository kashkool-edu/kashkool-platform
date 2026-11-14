'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import ContentShield from '@/components/ContentShield';
import LessonQuiz, { QuizQuestion } from '@/components/LessonQuiz';

interface Course {
  id: string;
  title: string;
  subject: string;
  academic_stage: 'primary' | 'prep' | 'secondary';
  grade_level: number;
}

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  youtube_video_id: string;
  warak_pdf_url: string | null;
  order_index: number;
  is_free_preview: boolean;
}

interface ProgressRecord {
  lesson_id: string;
  is_completed: boolean;
  quiz_score: number | null;
}

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('kashkool_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('kashkool_device_id', id);
  }
  return id;
}

function CoursePlayerContent() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeTab, setActiveTab] = useState<'video' | 'warak'>('video');
  const [hasAccess, setHasAccess] = useState(false);
  const [deviceBlocked, setDeviceBlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const [progressMap, setProgressMap] = useState<Record<string, ProgressRecord>>({});
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [markingComplete, setMarkingComplete] = useState(false);

  const [studentInfo, setStudentInfo] = useState({
    id: '',
    name: 'طالب كشكول',
    phone: '',
  });

  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadCourseContent() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!isMounted) return;
      if (!user) {
        router.push('/login');
        return;
      }

      // 1. Fetch Profile & Enforce Single-Device Lock
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name, phone_number, active_device_id')
        .eq('id', user.id)
        .single();

      if (!isMounted) return;
      const localDeviceId = getOrCreateDeviceId();
      const isAdmin = profile?.role === 'admin';

      if (!profile?.active_device_id) {
        await supabase
          .from('profiles')
          .update({
            active_device_id: localDeviceId,
            last_active_at: new Date().toISOString(),
          })
          .eq('id', user.id);
      } else if (profile.active_device_id !== localDeviceId) {
        setDeviceBlocked(true);
        setLoading(false);
        return;
      }

      if (!isMounted) return;

      channel = supabase
        .channel(`device-lock-${user.id}-${crypto.randomUUID()}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            const updatedDeviceId = payload.new?.active_device_id;
            if (updatedDeviceId && updatedDeviceId !== localDeviceId) {
              setDeviceBlocked(true);
            }
          }
        )
        .subscribe();

      setStudentInfo({
        id: user.id,
        name: profile?.full_name || user.email?.split('@')[0] || 'طالب كشكول',
        phone: profile?.phone_number || '',
      });

      // 2. Fetch Course Metadata
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (!isMounted) return;
      if (!courseData) {
        router.push('/dashboard');
        return;
      }
      setCourse(courseData);

      // 3. Check Subscription
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle();

      if (!isMounted) return;
      setHasAccess(isAdmin || sub?.status === 'approved');

      // 4. Fetch Lessons
      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true });

      if (!isMounted) return;
      if (lessonsData && lessonsData.length > 0) {
        setLessons(lessonsData);
        setActiveLesson(lessonsData[0]);
      }

      // 5. Fetch Student Lesson Progress
      const { data: progressData } = await supabase
        .from('lesson_progress')
        .select('lesson_id, is_completed, quiz_score')
        .eq('user_id', user.id)
        .eq('course_id', courseId);

      if (!isMounted) return;
      if (progressData) {
        const map: Record<string, ProgressRecord> = {};
        progressData.forEach((p) => {
          map[p.lesson_id] = p;
        });
        setProgressMap(map);
      }

      setLoading(false);
    }

    if (courseId) loadCourseContent();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [courseId, router]);

  // Fetch quiz questions whenever activeLesson changes
  useEffect(() => {
    let active = true;
    async function loadQuiz() {
      if (!activeLesson?.id) {
        setQuizQuestions([]);
        return;
      }
      const { data } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('lesson_id', activeLesson.id)
        .order('order_index', { ascending: true });

      if (active) {
        setQuizQuestions((data as QuizQuestion[]) || []);
      }
    }
    loadQuiz();
    return () => {
      active = false;
    };
  }, [activeLesson?.id]);

  const handleSaveProgress = async (lessonId: string, completed: boolean, quizScore?: number) => {
    if (!studentInfo.id) return;
    setMarkingComplete(true);

    const existing = progressMap[lessonId];
    const bestScore =
      quizScore !== undefined
        ? Math.max(quizScore, existing?.quiz_score ?? 0)
        : existing?.quiz_score ?? null;

    const { error } = await supabase.from('lesson_progress').upsert(
      {
        user_id: studentInfo.id,
        lesson_id: lessonId,
        course_id: courseId,
        is_completed: completed,
        quiz_score: bestScore,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,lesson_id' }
    );

    if (!error) {
      setProgressMap((prev) => ({
        ...prev,
        [lessonId]: {
          lesson_id: lessonId,
          is_completed: completed,
          quiz_score: bestScore,
        },
      }));
    }
    setMarkingComplete(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center dir-rtl" dir="rtl">
        <div className="text-slate-400 text-sm animate-pulse">جاري تجهيز قاعة الدرس...</div>
      </div>
    );
  }

  if (deviceBlocked) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-slate-100 flex items-center justify-center p-4 dir-rtl text-right" dir="rtl">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/40 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center mx-auto mb-4 text-2xl font-black">
            🛡️
          </div>
          <h2 className="text-xl font-black text-white mb-2">الحساب مرتبط بجهاز آخر</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            لحماية محتوى المعلمين، يسمح كشكول بتشغيل الحساب على جهاز واحد فقط. تواصل مع الدعم الفني إذا قمت بتغيير هاتفك أو جهازك.
          </p>
          <Link
            href="/dashboard"
            className="inline-block w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl transition"
          >
            العودة للوحة التحكم
          </Link>
        </div>
      </div>
    );
  }

  const completedCount = lessons.filter((l) => progressMap[l.id]?.is_completed).length;
  const progressPercent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;
  const isCurrentLessonDone = activeLesson ? Boolean(progressMap[activeLesson.id]?.is_completed) : false;

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 dir-rtl text-right" dir="rtl">
      <header className="bg-slate-900/90 border-b border-slate-800 px-4 sm:px-8 py-4 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg transition"
            >
              ← دروسي
            </Link>
            <div>
              <span className="text-[11px] font-bold text-[#FBBF24] block">{course?.subject}</span>
              <h1 className="text-sm sm:text-base font-black text-white line-clamp-1">{course?.title}</h1>
            </div>
          </div>

          <div className="text-lg font-black text-white flex items-center gap-2 shrink-0">
            <span className="w-7 h-7 rounded-md bg-[#FBBF24] text-[#1E3A8A] flex items-center justify-center text-sm font-extrabold">ك</span>
            <span className="hidden sm:inline">كشكول</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {!hasAccess && lessons.length === 0 ? (
          <div className="max-w-lg mx-auto my-12 bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#FBBF24]/15 text-[#FBBF24] flex items-center justify-center mx-auto mb-4 text-2xl font-black">
              🔒
            </div>
            <h2 className="text-xl font-black text-white mb-2">هذا الكورس غير مفعّل لحسابك</h2>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              اشترك الآن عبر فودافون كاش أو إنستا باي للوصول الفوري لجميع فيديوهات الشرح وورق الدرس.
            </p>
            <Link
              href={`/checkout/${courseId}`}
              className="inline-block w-full py-3.5 bg-[#FBBF24] hover:bg-amber-400 text-[#0F172A] font-black rounded-xl transition"
            >
              اشترك في الكورس الآن
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 p-1.5 rounded-xl">
                <div className="flex gap-1.5 w-full">
                  <button
                    onClick={() => setActiveTab('video')}
                    className={`flex-1 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                      activeTab === 'video'
                        ? 'bg-[#1E3A8A] text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    شرح الفيديو
                  </button>
                  <button
                    onClick={() => setActiveTab('warak')}
                    disabled={!activeLesson?.warak_pdf_url}
                    className={`flex-1 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer disabled:opacity-40 ${
                      activeTab === 'warak'
                        ? 'bg-[#FBBF24] text-[#0F172A] shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ورق الدرس (PDF)
                  </button>
                </div>
              </div>

              {activeLesson ? (
                <>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <ContentShield
                      studentName={studentInfo.name}
                      studentPhone={studentInfo.phone}
                      studentId={studentInfo.id}
                    >
                      {activeTab === 'video' ? (
                        <div className="relative aspect-video w-full h-full bg-black">
                          <div className="absolute top-0 left-0 right-0 h-14 z-20 bg-transparent" />
                          <div className="absolute bottom-0 right-0 w-36 h-12 z-20 bg-transparent" />

                          <iframe
                            className="w-full h-full"
                            src={`https://www.youtube-nocookie.com/embed/${activeLesson.youtube_video_id}?rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&enablejsapi=1&fs=0`}
                            title={activeLesson.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-[650px] bg-slate-950 flex flex-col">
                          <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                            <span className="text-xs font-bold text-[#FBBF24]">ملخص ورق الدرس (محمي بعلامة مائية)</span>
                          </div>
                          <iframe
                            src={`${activeLesson.warak_pdf_url}#toolbar=0&navpanes=0`}
                            className="w-full flex-1 border-0"
                            title="Warak El-Dars PDF"
                          />
                        </div>
                      )}
                    </ContentShield>

                    <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg sm:text-xl font-black text-white mb-1.5">
                          {activeLesson.title}
                        </h2>
                        {activeLesson.description && (
                          <p className="text-sm text-slate-400 leading-relaxed">
                            {activeLesson.description}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={markingComplete}
                        onClick={() => handleSaveProgress(activeLesson.id, !isCurrentLessonDone)}
                        className={`shrink-0 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer border ${
                          isCurrentLessonDone
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                            : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        {isCurrentLessonDone ? 'تم إكمال الدرس ✓' : 'تحديد كمكتمل'}
                      </button>
                    </div>
                  </div>

                  {/* End-of-Lesson Multiple-Choice Quiz */}
                  <LessonQuiz
                    key={activeLesson.id}
                    questions={quizQuestions}
                    previousScore={progressMap[activeLesson.id]?.quiz_score ?? null}
                    onCompleteQuiz={async (score) => {
                      await handleSaveProgress(activeLesson.id, score >= 50 || isCurrentLessonDone, score);
                    }}
                  />
                </>
              ) : (
                <div className="bg-slate-800/30 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-sm">
                  لم يتم إضافة دروس لهذا الكورس بعد.
                </div>
              )}
            </div>

            {/* Sidebar: Course Progress + Lessons List */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 h-fit">
              <div className="pb-3 mb-3 border-b border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-black text-sm text-white">محتوى الكورس</h3>
                  <span className="text-xs font-bold text-[#FBBF24]">
                    {completedCount}/{lessons.length} ({progressPercent}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                {lessons.map((lesson, idx) => {
                  const isSelected = activeLesson?.id === lesson.id;
                  const isDone = Boolean(progressMap[lesson.id]?.is_completed);
                  const quizScore = progressMap[lesson.id]?.quiz_score;

                  return (
                    <button
                      key={lesson.id}
                      onClick={() => {
                        setActiveLesson(lesson);
                        setActiveTab('video');
                      }}
                      className={`w-full text-right p-3.5 rounded-xl border transition flex items-start gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-[#1E3A8A]/60 border-[#FBBF24] text-white'
                          : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800/80'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-md text-xs font-black flex items-center justify-center shrink-0 mt-0.5 ${
                          isDone
                            ? 'bg-emerald-500 text-slate-950'
                            : isSelected
                            ? 'bg-[#FBBF24] text-[#0F172A]'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isDone ? '✓' : idx + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-xs sm:text-sm font-bold leading-snug">{lesson.title}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {lesson.warak_pdf_url && (
                            <span className="text-[10px] font-bold text-[#FBBF24] bg-[#FBBF24]/10 px-2 py-0.5 rounded">
                              + ورق الدرس PDF
                            </span>
                          )}
                          {quizScore !== null && quizScore !== undefined && (
                            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded">
                              الاختبار: {quizScore}%
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CoursePlayerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center dir-rtl" dir="rtl">
          <div className="text-slate-400 text-sm animate-pulse">جاري التحميل...</div>
        </div>
      }
    >
      <CoursePlayerContent />
    </Suspense>
  );
}