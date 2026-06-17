export const CBSE_BLUEPRINT: Record<string, {
  sections: { type: string; marks: number; count: number }[];
  totalMarks: number;
  durationMins: number;
}> = {
  "Class 10 Science": {
    sections: [
      { type: "MCQ (1 mark)", marks: 1, count: 20 },
      { type: "Short Answer I (2 marks)", marks: 2, count: 5 },
      { type: "Short Answer II (3 marks)", marks: 3, count: 7 },
      { type: "Long Answer (5 marks)", marks: 5, count: 3 },
    ],
    totalMarks: 80,
    durationMins: 180
  },
  "Class 10 Maths": {
    sections: [
      { type: "MCQ (1 mark)", marks: 1, count: 20 },
      { type: "Short Answer I (2 marks)", marks: 2, count: 5 },
      { type: "Short Answer II (3 marks)", marks: 3, count: 6 },
      { type: "Long Answer (5 marks)", marks: 5, count: 4 },
    ],
    totalMarks: 80,
    durationMins: 180
  },
  "Class 10 SST": {
    sections: [
      { type: "MCQ (1 mark)", marks: 1, count: 20 },
      { type: "Short Answer (3 marks)", marks: 3, count: 10 },
      { type: "Long Answer (5 marks)", marks: 5, count: 4 },
    ],
    totalMarks: 80,
    durationMins: 180
  },
  "Class 12 Physics": {
    sections: [
      { type: "MCQ (1 mark)", marks: 1, count: 16 },
      { type: "Short Answer I (2 marks)", marks: 2, count: 5 },
      { type: "Short Answer II (3 marks)", marks: 3, count: 7 },
      { type: "Long Answer (5 marks)", marks: 5, count: 3 },
    ],
    totalMarks: 70,
    durationMins: 180
  }
};
