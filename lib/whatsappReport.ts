export interface StudentReportData {
  studentName: string;
  studentPhone?: string | null;
  parentPhone?: string | null;
  completedLessons: number;
  totalAssignedLessons: number;
  averageQuizScore: number | null;
  quizzesTaken: number;
  lastActiveAt?: string | null;
  recentLessonTitle?: string | null;
  recentQuizScore?: number | null;
}

/**
 * Normalizes Egyptian mobile numbers (e.g. 01012345678 or +20 101 234 5678)
 * into international digits without '+' for https://wa.me/
 */
export function formatEgyptianWhatsAppNumber(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';

  // Local Egyptian format: 010..., 011..., 012..., 015... (11 digits starting with 01)
  if (digits.startsWith('01') && digits.length === 11) {
    return `2${digits}`; // becomes 2010...
  }
  // Missing leading zero: 10... (10 digits)
  if (digits.startsWith('1') && digits.length === 10) {
    return `20${digits}`;
  }
  // Already starts with 20...
  if (digits.startsWith('20') && digits.length === 12) {
    return digits;
  }
  return digits;
}

export function buildParentWhatsAppMessage(data: StudentReportData): string {
  const attendancePercent =
    data.totalAssignedLessons > 0
      ? Math.round((data.completedLessons / data.totalAssignedLessons) * 100)
      : 0;

  const lastSeenText = data.lastActiveAt
    ? new Date(data.lastActiveAt).toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'غير مسجل بعد';

  const quizSummary =
    data.averageQuizScore !== null
      ? `${data.averageQuizScore}% (من إجمالي ${data.quizzesTaken} اختبارات)`
      : 'لم يؤدِّ اختبارات بعد';

  let evaluationLine = 'مستوى ممتاز، نتمنى له دوام التفوق 🌟';
  if (data.averageQuizScore !== null) {
    if (data.averageQuizScore >= 85) {
      evaluationLine = 'مستوى متميز جداً، نشكر متابعتكم المستمرة 🌟';
    } else if (data.averageQuizScore >= 65) {
      evaluationLine = 'مستوى جيد، ويحتاج لمراجعة إضافية لرفع الدرجات 📈';
    } else {
      evaluationLine = 'يحتاج إلى متابعة ومراجعة الدروس والاختبارات القادمة ⚠️';
    }
  }

  const lines = [
    `السلام عليكم ورحمة الله وبركاته 🌷`,
    `تحية طيبة من *منصة كشكول التعليمية* لولي أمر الطالب/ة:`,
    `👤 *الاسم:* ${data.studentName || 'طالب كشكول'}`,
    ``,
    `📊 *تقرير المتابعة والحضور:*`,
    `• *الحضور وإتمام الدروس:* ${data.completedLessons} من ${data.totalAssignedLessons} دروس (${attendancePercent}%)`,
    `• *متوسط درجات الاختبارات:* ${quizSummary}`,
    ...(data.recentLessonTitle
      ? [
          `• *آخر درس:* ${data.recentLessonTitle}${
            data.recentQuizScore !== null && data.recentQuizScore !== undefined
              ? ` (درجة الاختبار: ${data.recentQuizScore}%)`
              : ''
          }`,
        ]
      : []),
    `• *آخر تواجد على المنصة:* ${lastSeenText}`,
    ``,
    `📝 *ملاحظة التقييم:* ${evaluationLine}`,
    ``,
    `مع أطيب التمنيات بالنجاح والتفوق 🎓`,
  ];

  return lines.join('\n');
}

export function buildWhatsAppUrl(parentPhone: string, message: string): string {
  const cleanPhone = formatEgyptianWhatsAppNumber(parentPhone);
  const encoded = encodeURIComponent(message);
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}