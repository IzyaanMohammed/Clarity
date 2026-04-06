import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Book, ExternalLink, Search, Filter, RefreshCw, FileText } from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { getUser } from '../utils/storage';
import { NCERT_CHAPTERS } from '../constants/ncert';
import { buildNcertChapterUrl, getStudyResources } from '../utils/studyResources';
import {
  getPastPapers,
  getPastPaperQuestions,
  getWorksheets,
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

  const filteredBooks = resources.textbooks.filter(book =>
    (book.subject.toLowerCase().includes(searchTerm.toLowerCase()) || book.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">NCERT Digital Library</h1>
            <p className="text-slate-500 font-medium">Instant access to official textbooks for Class {classFilter}.</p>
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
                placeholder="Search textbooks..."
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
            Select Class, then Subject, then open a chapter or worksheet. Everything below auto-updates to match your selection.
          </p>
        </Card>

        {filteredBooks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredBooks.map((book, index) => (
              <Card key={index} className="p-0 overflow-hidden bg-white dark:bg-[#0f172a] border-none shadow-xl shadow-slate-200/50 dark:shadow-none hover:scale-[1.03] transition-all rounded-[32px] group">
                <div className="h-48 bg-gradient-to-br from-[#1D9E75]/5 to-[#1D9E75]/20 flex items-center justify-center relative overflow-hidden">
                  <Book size={64} className="text-[#1D9E75] relative z-10" />
                  <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,transparent)] dark:bg-grid-slate-700/25" />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg uppercase tracking-widest">
                      {book.subject}
                    </span>
                  </div>
                  <h3 className="font-black text-xl text-slate-900 dark:text-white mb-6 line-clamp-1">{book.title}</h3>
                  <Button
                    className="w-full bg-[#1D9E75] hover:bg-[#16805d] rounded-2xl font-bold py-6 group"
                    onClick={() => {
                      const chapterIndex = Math.max(1, resources.chapters.findIndex((c) => c === selectedChapter) + 1);
                      const directUrl = buildNcertChapterUrl(book.url, chapterIndex);
                      window.open(directUrl, '_blank');
                    }}
                  >
                    <ExternalLink size={18} className="mr-2 group-hover:rotate-12 transition-transform" />
                    Open Textbook
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full mt-2 rounded-2xl font-bold"
                    onClick={() => {
                      const chapter = resources.chapters[0] || NCERT_CHAPTERS[book.class]?.[book.subject]?.[0] || '';
                      navigate('/ask', { state: { subject: book.subject, chapter } });
                    }}
                  >
                    Ask AI About This Chapter
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full mt-2 rounded-2xl font-bold"
                    onClick={() => navigate('/textbook-hub', { state: { selectedBook: book } })}
                  >
                    Open In Textbook Hub
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white dark:bg-[#0f172a] rounded-[40px] shadow-sm border-2 border-dashed border-slate-100 dark:border-slate-800">
            <Filter size={48} className="mx-auto text-slate-200 mb-4" />
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">No textbooks found</h3>
            <p className="text-slate-500 mt-1">Try a different search or class filter.</p>
          </div>
        )}

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
              {mergedWorksheets.length === 0 ? (
                <p className="text-sm text-slate-500">No worksheet dataset found for this class and subject.</p>
              ) : mergedWorksheets.map((worksheet) => (
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
          ) : pastPapers.length === 0 ? (
            <p className="text-sm text-slate-500">No dataset papers found for this class and subject yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pastPapers.map((paper) => (
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

        {/* Pro Call to Action */}
        <div className="mt-16 p-10 bg-slate-900 rounded-[40px] text-center relative overflow-hidden shadow-2xl">
          <div className="relative z-10">
            <h2 className="text-3xl font-black text-white mb-4">Unlock Smart Highlights</h2>
            <p className="text-slate-400 font-medium mb-8 max-w-2xl mx-auto">
              Upgrade to Clarity Pro to highlight any paragraph in these books and get instant AI-generated summaries,
              predicted board questions, and formula sheets.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button
                className="bg-white text-slate-900 hover:bg-slate-100 font-black px-10 py-4 rounded-2xl shadow-lg transition-transform active:scale-95"
                onClick={() => navigate('/settings')}
              >
                Go Pro Now
              </Button>
              <Button
                variant="outline"
                className="border-slate-700 text-white hover:bg-white/5 font-black px-10 py-4 rounded-2xl"
                onClick={() => navigate('/settings')}
              >
                Compare Plans
              </Button>
            </div>
          </div>
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#1D9E75]/20 rounded-full blur-[80px]" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]" />
        </div>
      </div>
    </div>
  );
};
