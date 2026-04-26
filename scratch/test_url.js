const filePath = "pdfs/Sem 4/English AEC.pdf";
const encodedPath = encodeURI(filePath);
const baseUrl = "https://harshx091.github.io/Exam_Papers/pdfs.html?sem=4";
const fullUrl = new URL(encodedPath, baseUrl).href;
console.log("Full URL:", fullUrl);
