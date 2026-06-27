import re

with open('src/pages/Onboarding.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace steps array
new_steps = '''    const steps = [
        { title: 'Welcome', subtitle: 'Set up your personal AI tutor in under 1 minute' },
        { title: 'About You', subtitle: 'Name, class, and school details' },
        { title: 'Subjects', subtitle: 'Pick all subjects you study' },
        { title: 'Goal', subtitle: 'Your target this year' },
        { title: 'Finish', subtitle: 'Review and begin your journey' },
    ];'''
content = re.sub(r'const steps = \[\n.*?\];', new_steps, content, flags=re.DOTALL)

# Update validateStep
new_validate = '''const validateStep = () => {
        if (step === 1) {
            if (!name.trim() || !school.trim()) {
                import_toast.error('Please fill in your full name and school.');
                return false;
            }
            if (name.trim().length < 2) {
                import_toast.error('Name must be at least 2 characters.');
                return false;
            }
            if (!selectedClass) {
                import_toast.error('Please select your class.');
                return false;
            }
        }
        if (step === 2 && selectedSubjects.length === 0) {
            import_toast.error('Pick at least one subject to continue.');
            return false;
        }
        if (step === 3 && !goal) {
            import_toast.error('Select your target goal.');
            return false;
        }
        return true;
    };'''
content = re.sub(r'const validateStep = \(\) => \{[\s\S]*?return true;\n    \};', new_validate.replace('import_toast', 'toast'), content, flags=re.DOTALL)

# Update step 1 render to include Class selection and remove location
step1_pattern = r'\{step === 1 && \([\s\S]*?\{step === 2 && \('
new_step1 = '''{step === 1 && (
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-black text-[#1a1a2e] mb-1.5 uppercase tracking-wider">Full Name</label>
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rahul Sharma" className="w-full bg-[#FCFAF8] border-2 border-[#1a1a2e]/20 rounded-xl px-4 py-3 font-semibold focus:outline-none focus:border-[#1a1a2e] focus:ring-4 focus:ring-[#1a1a2e]/10 transition-all placeholder:font-normal placeholder:text-[#1a1a2e]/30 text-[#1a1a2e]"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-black text-[#1a1a2e] mb-1.5 uppercase tracking-wider">School Name</label>
                                    <input type="text" value={school} onChange={e => setSchool(e.target.value)} placeholder="e.g. DPS R.K. Puram" className="w-full bg-[#FCFAF8] border-2 border-[#1a1a2e]/20 rounded-xl px-4 py-3 font-semibold focus:outline-none focus:border-[#1a1a2e] focus:ring-4 focus:ring-[#1a1a2e]/10 transition-all placeholder:font-normal placeholder:text-[#1a1a2e]/30 text-[#1a1a2e]"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-black text-[#1a1a2e] mb-3 uppercase tracking-wider">Your Class</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {CLASSES.map(cls => (
                                            <button key={cls} onClick={() => setSelectedClass(cls)} className={p-4 rounded-xl border-2 text-center transition-all }>
                                                <div className="text-xl font-black mb-1">Class {cls}</div>
                                                <div className={	ext-[10px] font-bold uppercase tracking-wider }>Board Prep</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {step === 2 && ('''
content = re.sub(step1_pattern, new_step1, content, flags=re.DOTALL)

# Update step 2 (Subjects)
step2_pattern = r'\{step === 2 && \([\s\S]*?\{step === 3 && \('
content = re.sub(step2_pattern, r'{step === 999 && (\n<div></div>\n)}\n{step === 2 && (', content, flags=re.DOTALL) # remove old step 2 (class)
step3_pattern = r'\{step === 3 && \([\s\S]*?\{step === 4 && \('
content = re.sub(step3_pattern, r'{step === 2 && (\n' + re.search(r'\{step === 3 && \(([\s\S]*?)\)\}\n                    \{step === 4 && \(', content).group(1) + r')}' + '\n{step === 3 && (', content, flags=re.DOTALL)

# Update step 3 (Goal)
step5_pattern = r'\{step === 5 && \(([\s\S]*?)\)\}'
goal_content = re.search(step5_pattern, content).group(1)
content = re.sub(r'\{step === 3 && \([\s\S]*?\{step === 4 && \(', r'{step === 3 && (' + goal_content + r')}' + '\n{step === 4 && (', content, flags=re.DOTALL)

# Update step 4 (Finish)
step12_pattern = r'\{step === 12 && \(([\s\S]*?)\)\}'
finish_content = re.search(step12_pattern, content).group(1)
content = re.sub(r'\{step === 4 && \([\s\S]*?\{step === 5 && \(', r'{step === 4 && (' + finish_content + r')}' + '\n{step === 5 && (', content, flags=re.DOTALL)

# Remove all other steps up to 12
content = re.sub(r'\{step === 5 && \([\s\S]*?\{step === 12 && \([\s\S]*?\)\}', '', content, flags=re.DOTALL)

with open('src/pages/Onboarding.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
