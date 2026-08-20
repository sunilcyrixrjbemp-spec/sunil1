const fs = require('fs');
const path = require('path');

const dataFile = path.resolve(__dirname, 'july_full_data.json');
const rawData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const { users, expenses, legs, advances, editLogs } = rawData;

// Let's see all unique comments from editLogs
const comments = editLogs.map(l => l.comment).filter(Boolean);
console.log(`Total edit log comments: ${comments.length}`);

const uniqueComments = {};
for (const c of comments) {
  const trimmed = c.trim();
  uniqueComments[trimmed] = (uniqueComments[trimmed] || 0) + 1;
}

const sorted = Object.entries(uniqueComments).sort((a, b) => b[1] - a[1]);
console.log(`Unique edit log comment patterns: ${sorted.length}`);
console.log("\nTop 30 common edit log comments:");
sorted.slice(0, 30).forEach(([comment, count], idx) => {
  console.log(`${idx + 1}. (${count}x) "${comment}"`);
});
