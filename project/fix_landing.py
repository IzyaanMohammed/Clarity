import re

with open('src/pages/Landing.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the Simulated workspace widget
terminal_pattern = r'\{\/\* Top Right: Simulated workspace widget \*\/\}[\s\S]*?(?=</section>)'

new_widget = '''{/* Top Right: Simulated workspace widget */}
                        <div className="lg:col-span-5 w-full flex flex-col justify-center">
                            <div className="w-full bg-[#FCFAF8] border-1.5 border-[#1a1a2e] rounded-3xl overflow-hidden flex flex-col shadow-[8px_8px_0px_0px_rgba(26,26,46,1)]">
                                {/* Snippet Header */}
                                <div className="bg-[#fcfbf9] px-4 py-3 flex items-center justify-between border-b border-[#1a1a2e]/10">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#1a1a2e] inline-block" />
                                        <span className="text-[10px] font-black text-[#1a1a2e] uppercase tracking-wider">Live Demo Widget</span>
                                    </div>
                                </div>
                                <DemoWidget />
                            </div>
                        </div>
                    '''

content = re.sub(terminal_pattern, new_widget, content, flags=re.DOTALL)

with open('src/pages/Landing.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
