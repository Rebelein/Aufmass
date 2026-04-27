with open('src/pages/HomePage.tsx', 'r') as f:
    content = f.read()

# Find the first '}\nyDown' and cut everything from there onwards up to the real end.
# Actually, the file has the correct end at the very bottom, but the first one is at the middle.
# Let's just remove the block from `</motion.div>\n  );\n}\nyDown` up to the actual file end.
# Wait, no. The Dialog code is AT THE VERY END, but the previous replace didn't remove the original `</motion.div>\n  );\n}` properly.

import re
content = re.sub(r'      </ResizableSidePanel>\n    </motion\.div>\n  \);\n}\nyDown=\{\(e\) => \{', '      </ResizableSidePanel>\n\n      <Dialog open={isQuickMeasurementDialogOpen} onOpenChange={setIsQuickMeasurementDialogOpen}>\n        <DialogContent className="sm:max-w-md bg-card border-border shadow-2xl">\n          <DialogHeader>\n            <DialogTitle className="text-2xl font-black text-foreground flex items-center gap-3">\n              <div className="bg-purple-500/10 p-2 rounded-xl"><Zap className="text-purple-500" size={24} /></div>\n              Schnellaufmaß\n            </DialogTitle>\n          </DialogHeader>\n          <div className="py-6 space-y-4">\n            <p className="text-muted-foreground text-sm">\n              Erstelle schnell und unkompliziert ein Aufmaß ohne es einer Baustelle zuordnen zu müssen.\n            </p>\n            <div className="space-y-2">\n              <Label className="text-foreground font-bold">Bezeichnung</Label>\n              <Input \n                autoFocus\n                className="h-12 bg-background border-border text-foreground focus:ring-purple-500/50" \n                value={quickMeasurementName} \n                onChange={(e) => setQuickMeasurementName(e.target.value)} \n                placeholder="z.B. Heizungskeller Meier, Bestellung MusterGmbH" \n                onKeyDown={(e) => {', content)

with open('src/pages/HomePage.tsx', 'w') as f:
    f.write(content)
