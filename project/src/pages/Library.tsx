import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Book, Search, Filter, RefreshCw, FileText, X, Sparkles, BookOpen, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { getUser } from '../utils/storage';
import { NCERT_CHAPTERS } from '../constants/ncert';
import { getStudyResources } from '../utils/studyResources';
import {
  getPastPapers,
  getPastPaperQuestions,
  getWorksheets,
  getChapterText,
  askQuestionStream,
  type PastPaperItem,
  type WorksheetItem,
} from '../api';

export const Library = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();
  const referencedChapter = (location.state?.chapter as string | undefined) || '';
  const [searchTerm, setSearchTerm] = useState('');
  const [chapterSearch, setChapterSearch] = useState('');
  const [classFilter, setClassFilter] = useState((user?.class || '10').toString());
  const [subjectFilter, setSubjectFilter] = useState(user?.subjects?.[0] || '');
  const [pastPapers, setPastPapers] = useState<PastPaperItem[]>([]);
  const [worksheets, setWorksheets] = useState<WorksheetItem[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [loadingWorksheets, setLoadingWorksheets] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState('');

  const resources = getStudyResources(classFilter, subjectFilter);

  useEffect(() => {
    if (referencedChapter && resources.chapters.includes(referencedChapter)) {
      setSelectedChapter(referencedChapter);
      return;
    }
    setSelectedChapter(resources.chapters[0] || '');
  }, [resources.chapters, referencedChapter]);

  const filteredChapters = resources.chapters.filter((chapter) =>
    chapter.toLowerCase().includes(chapterSearch.toLowerCase())
  );

  const templateWorksheets: WorksheetItem[] = useMemo(() => {
    return resources.worksheets.map((w) => ({
      id: `template_${w.id}`,
      title: w.title,
      class_num: classFilter,
      subject: resources.subject,
      chapter: w.chapter,
      question_type: w.questionType,
      difficulty: w.difficulty,
      num_questions: w.numQuestions,
      board: 'Clarity',
      year: 0,
      source_paper_id: `template_${w.id}`,
      pdf_url: undefined,
      questions: [],
    }));
  }, [resources.worksheets, classFilter, resources.subject]);

  const mergedWorksheets: WorksheetItem[] = useMemo(() => {
    const dedup = new Map<string, WorksheetItem>();

    // Prefer data-backed worksheets first.
    worksheets.forEach((w) => {
      const key = `${w.chapter.toLowerCase()}|${w.question_type}|${w.num_questions}|${w.title.toLowerCase()}`;
      dedup.set(key, w);
    });

    // Add previously generated template sets if equivalent worksheet is missing.
    templateWorksheets.forEach((w) => {
      const key = `${w.chapter.toLowerCase()}|${w.question_type}|${w.num_questions}|${w.title.toLowerCase()}`;
      if (!dedup.has(key)) {
        dedup.set(key, w);
      }
    });

    return Array.from(dedup.values());
  }, [worksheets, templateWorksheets]);

  const filteredWorksheets = useMemo(() => {
    if (!searchTerm) return mergedWorksheets;
    const term = searchTerm.toLowerCase();
    return mergedWorksheets.filter(w =>
      w.title.toLowerCase().includes(term) || w.chapter.toLowerCase().includes(term)
    );
  }, [mergedWorksheets, searchTerm]);

  const filteredPastPapers = useMemo(() => {
    if (!searchTerm) return pastPapers;
    const term = searchTerm.toLowerCase();
    return pastPapers.filter(p =>
      p.chapter.toLowerCase().includes(term) || p.board.toLowerCase().includes(term)
    );
  }, [pastPapers, searchTerm]);

  const difficultyStyles: Record<string, string> = {
    Easy: 'bg-emerald-100 text-emerald-700',
    Medium: 'bg-amber-100 text-amber-700',
    Hard: 'bg-rose-100 text-rose-700',
  };

  useEffect(() => {
    const loadPapers = async () => {
      setLoadingPapers(true);
      try {
        const response = await getPastPapers({
          class_num: classFilter,
          subject: resources.subject,
          limit: 12,
        });
        setPastPapers(response.papers);
      } catch {
        setPastPapers([]);
      } finally {
        setLoadingPapers(false);
      }
    };

    loadPapers();
  }, [classFilter, resources.subject]);

  const loadWorksheets = async (forceRefresh = false) => {
    setLoadingWorksheets(true);
    try {
      const response = await getWorksheets({
        class_num: classFilter,
        subject: resources.subject,
        limit: 24,
        refresh: forceRefresh,
      });
      setWorksheets(response.worksheets || []);
    } catch {
      setWorksheets([]);
    } finally {
      setLoadingWorksheets(false);
    }
  };

  useEffect(() => {
    loadWorksheets();
  }, [classFilter, resources.subject]);


  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] transition-colors duration-300">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">NCERT Worksheets & Past Papers</h1>
            <p className="text-slate-500 font-medium">Access practice worksheets, mock sets, and authentic board papers for Class {classFilter}.</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
              {['9', '10', '11', '12'].map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setClassFilter(c);
                    const nextResources = getStudyResources(c, '');
                    setSubjectFilter(nextResources.subject);
                  }}
                  className={`px-5 py-2 rounded-xl text-sm font-black transition-all ${classFilter === c
                    ? 'bg-[#1D9E75] text-white shadow-lg shadow-[#1D9E75]/20'
                    : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                >
                  Class {c}
                </button>
              ))}
            </div>

            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#1D9E75] transition-colors" size={20} />
              <input
                type="text"
                placeholder="Search worksheets or papers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-6 py-3.5 w-full md:w-72 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-[#1D9E75]/10 outline-none transition-all font-bold"
              />
            </div>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          {resources.subjects.map((subject) => (
            <button
              key={subject}
              onClick={() => setSubjectFilter(subject)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${resources.subject === subject
                ? 'bg-[#1D9E75] text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700'
                }`}
            >
              {subject}
            </button>
          ))}
        </div>

        <Card className="p-5 mb-8 bg-gradient-to-r from-sky-50 to-emerald-50 dark:from-slate-800 dark:to-slate-900 border border-sky-100 dark:border-slate-700 rounded-3xl">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 text-center">
            Select Class, then Subject, then generate practice worksheets or solve authentic CBSE past papers.
          </p>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
          <Card className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">Auto-Loaded Chapters</h3>
            <input
              type="text"
              placeholder="Search chapter name..."
              value={chapterSearch}
              onChange={(e) => setChapterSearch(e.target.value)}
              className="w-full mb-4 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700"
            />
            <div className="flex flex-wrap gap-2">
              {filteredChapters.map((chapter) => (
                <button
                  key={chapter}
                  onClick={() => {
                    setSelectedChapter(chapter);
                    navigate('/ask', { state: { subject: resources.subject, chapter } });
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-[#1D9E75] hover:text-white transition-all"
                >
                  {chapter}
                </button>
              ))}
              {filteredChapters.length === 0 && (
                <p className="text-sm text-slate-500">No chapter matched your search.</p>
              )}
            </div>
          </Card>

          <Card className="p-6 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl">
            <div className="flex items-center justify-between mb-4 gap-3">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Worksheet Sets</h3>
              <Button
                variant="outline"
                className="h-9 px-3 rounded-xl text-xs"
                onClick={() => loadWorksheets(true)}
                disabled={loadingWorksheets}
              >
                <RefreshCw size={14} className="mr-2" />
                Refresh
              </Button>
            </div>
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {loadingWorksheets && (
                <p className="text-sm text-slate-500">Loading internet worksheets...</p>
              )}
              {filteredWorksheets.length === 0 ? (
                <p className="text-sm text-slate-500">No worksheet dataset found for this class and subject.</p>
              ) : filteredWorksheets.map((worksheet) => (
                <div
                  key={worksheet.id}
                  className="p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                >
                  <p className="text-sm font-black text-slate-900 dark:text-white">{worksheet.title}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {worksheet.year > 0 ? `Board ${worksheet.year}` : 'Clarity Generated'} • {worksheet.chapter}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${difficultyStyles[worksheet.difficulty]}`}>
                      {worksheet.difficulty}
                    </span>
                    <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-indigo-100 text-indigo-700">
                      {worksheet.question_type}
                    </span>
                    <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-slate-200 text-slate-700">
                      {worksheet.board}
                    </span>
                  </div>
                  <Button
                    className="mt-3 h-9 px-3 rounded-xl text-xs"
                    onClick={() => navigate('/practice', {
                      state: {
                        subject: resources.subject,
                        chapter: worksheet.chapter,
                        questionType: worksheet.question_type,
                        numQuestions: worksheet.num_questions,
                        questions: worksheet.questions,
                      },
                    })}
                  >
                    Start Worksheet
                  </Button>
                  {(worksheet.pdf_url || worksheet.source_url) && (
                    <Button
                      variant="outline"
                      className="mt-2 h-9 px-3 rounded-xl text-xs"
                      onClick={() => window.open(worksheet.pdf_url || worksheet.source_url, '_blank')}
                    >
                      <FileText size={14} className="mr-2" />
                      Open PDF
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="p-6 mt-8 bg-white dark:bg-[#0f172a] border-none shadow-xl rounded-3xl">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Actual Past Papers</h3>
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Class {classFilter} • {resources.subject}
            </span>
          </div>

          {loadingPapers ? (
            <p className="text-sm text-slate-500">Loading past papers...</p>
          ) : filteredPastPapers.length === 0 ? (
            <p className="text-sm text-slate-500">No dataset papers found for this class and subject yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPastPapers.map((paper) => (
                <div
                  key={paper.id}
                  className="p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">{paper.chapter}</p>
                      <p className="text-xs text-slate-500 mt-1">{paper.board} {paper.year}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${difficultyStyles[paper.difficulty] || 'bg-slate-200 text-slate-700'}`}>
                      {paper.difficulty}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-3">{paper.questions.length} questions in dataset</p>

                  <Button
                    className="mt-3 h-9 px-3 rounded-xl text-xs"
                    onClick={async () => {
                      try {
                        const fullPaper = await getPastPaperQuestions(paper.id);
                        navigate('/practice', {
                          state: {
                            subject: paper.subject,
                            chapter: paper.chapter,
                            questionType: 'past-paper',
                            numQuestions: Math.min(fullPaper.questions.length || 5, 10),
                            questions: fullPaper.questions,
                          },
                        });
                      } catch {
                        navigate('/practice', {
                          state: {
                            subject: paper.subject,
                            chapter: paper.chapter,
                            questionType: 'past-paper',
                            numQuestions: Math.min(paper.questions.length || 5, 10),
                            questions: paper.questions,
                          },
                        });
                      }
                    }}
                  >
                    Start This Past Paper
                  </Button>
                  {(paper.pdf_url || paper.source_url) && (
                    <Button
                      variant="outline"
                      className="mt-2 h-9 px-3 rounded-xl text-xs"
                      onClick={() => window.open(paper.pdf_url || paper.source_url, '_blank')}
                    >
                      <FileText size={14} className="mr-2" />
                      Open PDF
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
