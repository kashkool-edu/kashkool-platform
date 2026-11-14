'use client';

import { useState } from 'react';

export interface QuizQuestion {
  id: string;
  question_text: string;
  options: string[];
  correct_option_index: number;
  explanation: string | null;
  order_index: number;
}

interface LessonQuizProps {
  questions: QuizQuestion[];
  previousScore: number | null;
  onCompleteQuiz: (scorePercent: number) => Promise<void>;
}

export default function LessonQuiz({
  questions,
  previousScore,
  onCompleteQuiz,
}: LessonQuizProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [scorePercent, setScorePercent] = useState<number | null>(previousScore);
  const [saving, setSaving] = useState(false);

  if (questions.length === 0) return null;

  const handleSelect = (questionId: string, optionIdx: number) => {
    if (submitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIdx }));
  };

  const handleSubmit = async () => {
    let correctCount = 0;
    questions.forEach((q) => {
      if (selectedAnswers[q.id] === q.correct_option_index) {
        correctCount += 1;
      }
    });

    const percent = Math.round((correctCount / questions.length) * 100);
    setScorePercent(percent);
    setSubmitted(true);
    setSaving(true);
    await onCompleteQuiz(percent);
    setSaving(false);
  };

  const handleRetry = () => {
    setSelectedAnswers({});
    setSubmitted(false);
  };

  const allAnswered = questions.every((q) => selectedAnswers[q.id] !== undefined);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-800">
        <div>
          <span className="text-[11px] font-bold text-[#FBBF24] block">تقييم الفهم السريع</span>
          <h3 className="text-base sm:text-lg font-black text-white">اختبار نهاية الدرس</h3>
        </div>

        {scorePercent !== null && (
          <div
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black border ${
              scorePercent >= 50
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
            }`}
          >
            أعلى درجة: {scorePercent}%
          </div>
        )}
      </div>

      <div className="space-y-6">
        {questions.map((q, qIdx) => {
          const userChoice = selectedAnswers[q.id];
          return (
            <div key={q.id} className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
              <p className="text-sm font-bold text-white mb-3 leading-relaxed">
                <span className="text-[#FBBF24] ml-1.5">{qIdx + 1}.</span>
                {q.question_text}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {q.options.map((opt, optIdx) => {
                  const isChosen = userChoice === optIdx;
                  const isCorrect = q.correct_option_index === optIdx;

                  let style =
                    'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600';

                  if (!submitted && isChosen) {
                    style = 'bg-[#1E3A8A]/70 border-[#FBBF24] text-white';
                  } else if (submitted) {
                    if (isCorrect) {
                      style = 'bg-emerald-500/20 border-emerald-500 text-emerald-200';
                    } else if (isChosen && !isCorrect) {
                      style = 'bg-red-500/20 border-red-500 text-red-200';
                    } else {
                      style = 'bg-slate-900/50 border-slate-800/50 text-slate-500';
                    }
                  }

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      disabled={submitted}
                      onClick={() => handleSelect(q.id, optIdx)}
                      className={`text-right px-3.5 py-2.5 rounded-lg border text-xs sm:text-sm font-semibold transition cursor-pointer disabled:cursor-default ${style}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {submitted && q.explanation && (
                <p className="mt-3 text-xs text-slate-300 bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
                  <span className="font-bold text-[#FBBF24]">التفسير: </span>
                  {q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        {!submitted ? (
          <button
            type="button"
            disabled={!allAnswered || saving}
            onClick={handleSubmit}
            className="w-full sm:w-auto px-6 py-3 bg-[#FBBF24] hover:bg-amber-400 disabled:opacity-40 text-[#0F172A] font-black text-sm rounded-xl transition cursor-pointer"
          >
            {saving ? 'جاري حفظ النتيجة...' : 'تسليم الإجابات'}
          </button>
        ) : (
          <div className="flex flex-wrap items-center justify-between w-full gap-3">
            <p className="text-sm font-bold text-white">
              نتيجتك: <span className="text-[#FBBF24]">{scorePercent}%</span>
              {scorePercent !== null && scorePercent >= 50
                ? ' — تم تسجيل الدرس كمكتمل ✓'
                : ' — حاول مرة أخرى لاجتياز الدرس'}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
            >
              إعادة الاختبار
            </button>
          </div>
        )}
      </div>
    </div>
  );
}