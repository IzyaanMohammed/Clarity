import { useState } from 'react';
import { Book, Download, ExternalLink, Search, Filter } from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { getUser } from '../utils/storage';

const NCERT_BOOKS = [
  // Class 12
  { class: '12', subject: 'Physics', title: 'Physics Part I', url: 'https://ncert.nic.in/textbook.php?leph1=0-8' },
  { class: '12', subject: 'Physics', title: 'Physics Part II', url: 'https://ncert.nic.in/textbook.php?leph2=0-6' },
  { class: '12', subject: 'Chemistry', title: 'Chemistry Part I', url: 'https://ncert.nic.in/textbook.php?lech1=0-5' },
  { class: '12', subject: 'Chemistry', title: 'Chemistry Part II', url: 'https://ncert.nic.in/textbook.php?lech2=0-4' },
  { class: '12', subject: 'Maths', title: 'Mathematics Part I', url: 'https://ncert.nic.in/textbook.php?lemh1=0-6' },
  { class: '12', subject: 'Maths', title: 'Mathematics Part II', url: 'https://ncert.nic.in/textbook.php?lemh2=0-7' },
  { class: '12', subject: 'Biology', title: 'Biology', url: 'https://ncert.nic.in/textbook.php?lebo1=0-13' },
  { class: '12', subject: 'English', title: 'Flamingo', url: 'https://ncert.nic.in/textbook.php?lefl1=0-8' },
  
  // Class 11
  { class: '11', subject: 'Physics', title: 'Physics Part I', url: 'https://ncert.nic.in/textbook.php?keph1=0-8' },
  { class: '11', subject: 'Physics', title: 'Physics Part II', url: 'https://ncert.nic.in/textbook.php?keph2=0-7' },
  { class: '11', subject: 'Chemistry', title: 'Chemistry Part I', url: 'https://ncert.nic.in/textbook.php?kech1=0-6' },
  { class: '11', subject: 'Chemistry', title: 'Chemistry Part II', url: 'https://ncert.nic.in/textbook.php?kech2=0-3' },
  { class: '11', subject: 'Biology', title: 'Biology', url: 'https://ncert.nic.in/textbook.php?kebo1=0-19' },
  { class: '11', subject: 'Maths', title: 'Mathematics', url: 'https://ncert.nic.in/textbook.php?kemh1=0-14' },
  
  // Class 10
  { class: '10', subject: 'Science', title: 'Science', url: 'https://ncert.nic.in/textbook.php?jesc1=0-13' },
  { class: '10', subject: 'Maths', title: 'Mathematics', url: 'https://ncert.nic.in/textbook.php?jemh1=0-14' },
  { class: '10', subject: 'Social Science', title: 'Contemporary India', url: 'https://ncert.nic.in/textbook.php?jess1=0-7' },
  { class: '10', subject: 'English', title: 'First Flight', url: 'https://ncert.nic.in/textbook.php?jeff1=0-9' },
  
  // Class 9
  { class: '9', subject: 'Science', title: 'Science', url: 'https://ncert.nic.in/textbook.php?iesc1=0-12' },
  { class: '9', subject: 'Maths', title: 'Mathematics', url: 'https://ncert.nic.in/textbook.php?iemh1=0-12' },
  { class: '9', subject: 'Social Science', title: 'Democratic Politics', url: 'https://ncert.nic.in/textbook.php?ieps1=0-5' },
  { class: '9', subject: 'English', title: 'Beehive', url: 'https://ncert.nic.in/textbook.php?iebe1=0-9' },
];

export const Library = () => {
  const user = getUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState(user?.class || '10');

  const filteredBooks = NCERT_BOOKS.filter(book => 
    (book.class === classFilter) &&
    (book.subject.toLowerCase().includes(searchTerm.toLowerCase()) || book.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
                  onClick={() => setClassFilter(c)}
                  className={`px-5 py-2 rounded-xl text-sm font-black transition-all ${
                    classFilter === c
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
                    onClick={() => window.open(book.url, '_blank')}
                  >
                    <ExternalLink size={18} className="mr-2 group-hover:rotate-12 transition-transform" />
                    Open Textbook
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

        {/* Pro Call to Action */}
        <div className="mt-16 p-10 bg-slate-900 rounded-[40px] text-center relative overflow-hidden shadow-2xl">
          <div className="relative z-10">
            <h2 className="text-3xl font-black text-white mb-4">Unlock Smart Highlights</h2>
            <p className="text-slate-400 font-medium mb-8 max-w-2xl mx-auto">
              Upgrade to NcertAI Pro to highlight any paragraph in these books and get instant AI-generated summaries, 
              predicted board questions, and formula sheets.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button className="bg-white text-slate-900 hover:bg-slate-100 font-black px-10 py-4 rounded-2xl shadow-lg transition-transform active:scale-95">
                Go Pro Now
              </Button>
              <Button variant="outline" className="border-slate-700 text-white hover:bg-white/5 font-black px-10 py-4 rounded-2xl">
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
