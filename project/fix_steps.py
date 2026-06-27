import sys

with open('src/pages/Onboarding.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# I want to find the line that starts with {step === 2 && ( and the line {step === 12 && ( and the end of the step 12 block.
start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if '{step === 2 && (' in line:
        start_idx = i
        break

if start_idx != -1:
    # Now find the end of the steps block. The last step was {step === 12 && (
    # We can find </Card> which marks the end of all steps.
    for i in range(start_idx, len(lines)):
        if '</Card>' in line:
            pass # wait, better search </Card>
    for i in range(start_idx, len(lines)):
        if '</Card>' in lines[i]:
            end_idx = i
            break

if start_idx != -1 and end_idx != -1:
    new_blocks = '''
                    {step === 2 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {availableSubjects.map((subject) => {
                                const selected = selectedSubjects.includes(subject);
                                return (
                                    <button
                                        key={subject}
                                        onClick={() => toggleSubject(subject)}
                                        className={p-4 rounded-2xl border-2 transition-all text-sm font-bold min-h-[92px] flex flex-col justify-between }
                                    >
                                        <span className="leading-tight break-words">{subject}</span>
                                        <span className={w-5 h-5 rounded-full border-2 flex items-center justify-center }>
                                            {selected && <Check size={13} className="text-white" />}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-3">
                            {GOALS.map((entry) => (
                                <button
                                    key={entry}
                                    onClick={() => setGoal(entry)}
                                    className={w-full p-4 rounded-2xl border-2 text-left font-bold }
                                >
                                    {entry}
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 4 && (
                        <div className="text-center py-6 space-y-5">
                            <div className="text-5xl">??</div>
                            <h2 className="text-3xl font-black text-[#2C241B] ">Ready to Start</h2>
                            <p className="text-stone-600 font-semibold max-w-lg mx-auto">
                                {name || 'Student'}, your tutor is now tuned for Class {selectedClass}, {selectedSubjects.length} subjects, and a {goal || 'custom'} goal.
                            </p>
                        </div>
                    )}
'''
    new_lines = lines[:start_idx] + [new_blocks] + lines[end_idx:]
    with open('src/pages/Onboarding.tsx', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("Successfully replaced steps rendering")
else:
    print("Could not find blocks")
