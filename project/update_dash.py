import sys
import re

with open('src/pages/Dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Import apiClient and saveUser
if 'apiClient' not in content:
    content = content.replace("from '../api';", "apiClient, \n} from '../api';")
if 'saveUser' not in content:
    content = content.replace("getUser } from '../utils/storage';", "getUser, saveUser } from '../utils/storage';")

# 2. Add Tutor State and handler
state_insertion = '''
  const [showTutorModal, setShowTutorModal] = useState(false);
  const [tutorPersonality, setTutorPersonality] = useState(user?.teacherPersonality || 'Kind');
  const [tutorPace, setTutorPace] = useState(user?.preferredPace || 'Balanced');
  const [isUpdatingTutor, setIsUpdatingTutor] = useState(false);

  const handleUpdateTutor = async () => {
    setIsUpdatingTutor(true);
    try {
      await apiClient.put('/me', { teacherPersonality: tutorPersonality, preferredPace: tutorPace });
      if (user) {
         saveUser({ ...user, teacherPersonality: tutorPersonality, preferredPace: tutorPace });
      }
      toast.success("Tutor customized successfully!");
      setShowTutorModal(false);
    } catch {
      toast.error("Failed to update tutor settings");
    } finally {
      setIsUpdatingTutor(false);
    }
  };
'''
if 'const [showTutorModal' not in content:
    content = content.replace('  const [stats, setStats] = useState<StatsResponse | null>(null);', '  const [stats, setStats] = useState<StatsResponse | null>(null);\n' + state_insertion)

# 3. Add Diagnostic Banner
banner_code = '''
      <Navbar />
      {(stats && stats.total_questions === 0) && (
        <div className="bg-[#8C5A35] text-white p-4 text-center font-bold flex items-center justify-center gap-3 relative z-20 cursor-pointer shadow-md" onClick={() => navigate('/onboarding')}>
          <Sparkles size={18} className="text-yellow-300" />
          <span>Unlock Personalized Paths: Take your 5-minute Baseline Diagnostic Quiz now!</span>
          <ArrowRight size={18} />
        </div>
      )}
'''
if 'Baseline Diagnostic Quiz' not in content:
    content = content.replace('<Navbar />', banner_code, 1)

# 4. Add Customize Tutor Button
button_code = '''              <Button
                variant="outline"
                className="rounded-full border-white/30 text-white hover:bg-white/10"
                onClick={() => setShowTutorModal(true)}
              >
                <Brain size={18} className="mr-2" />
                Customize Tutor
              </Button>'''
if 'Customize Tutor' not in content:
    content = content.replace('Access Parent Portal ?\n              </Button>', 'Access Parent Portal ?\n              </Button>\n' + button_code)

# 5. Add Daily Mission Progress Bar
mission_old = '''                          <p className="text-xs text-stone-500 font-medium">{task.subject} • 30 mins</p>
                        </div>
                      </div>
                    ))}'''

mission_new = '''                          <p className="text-xs text-stone-500 font-medium mb-2">{task.subject} • 30 mins</p>
                          <div className="h-1.5 w-full bg-stone-200 rounded-full overflow-hidden">
                            <div className="h-full bg-[#8C5A35] rounded-full" style={{ width: ${chapterReadiness?.readiness_score || 25}% }} />
                          </div>
                        </div>
                      </div>
                    ))}'''
content = content.replace(mission_old, mission_new)

# 6. Add Tutor Modal UI
modal_ui = '''
      {showTutorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#FCFAF8] p-8 rounded-3xl max-w-md w-full shadow-2xl border-3 border-[#2C241B]">
            <h2 className="text-2xl font-black text-[#2C241B] mb-4">Customize Tutor</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm font-bold text-stone-600 block mb-2">Personality</label>
                <select className="w-full p-3 rounded-xl border-2 border-stone-200" value={tutorPersonality} onChange={(e) => setTutorPersonality(e.target.value)}>
                  <option value="Kind">Kind & Encouraging</option>
                  <option value="Socratic">Socratic (Questions)</option>
                  <option value="Direct">Direct & Strict</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-stone-600 block mb-2">Pacing</label>
                <select className="w-full p-3 rounded-xl border-2 border-stone-200" value={tutorPace} onChange={(e) => setTutorPace(e.target.value)}>
                  <option value="Balanced">Balanced</option>
                  <option value="Fast">Fast & Challenging</option>
                  <option value="Slow">Slow & Detailed</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button className="px-5 py-2 font-bold text-stone-500 hover:bg-stone-200 rounded-xl" onClick={() => setShowTutorModal(false)}>Cancel</button>
              <button className="px-5 py-2 font-bold bg-[#8C5A35] text-white rounded-xl" disabled={isUpdatingTutor} onClick={handleUpdateTutor}>{isUpdatingTutor ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
'''
if 'Customize Tutor</h2>' not in content:
    content = content.replace('    </div>\n  );\n};', modal_ui + '\n    </div>\n  );\n};')

with open('src/pages/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Dashboard UI Updated Successfully.")
