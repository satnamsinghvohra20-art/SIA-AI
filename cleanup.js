const fs = require("fs");
try { fs.unlinkSync("checkGit.js"); } catch(_) {}
console.log("Cleaned checkGit.js");
