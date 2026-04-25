'use strict';

const fs = require('fs');
const path = require('path');

const SCORES_FILE = path.join(__dirname, '..', 'highscores.json');

function readFile() {
  try {
    if (!fs.existsSync(SCORES_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(SCORES_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeFile(data) {
  try {
    fs.writeFileSync(SCORES_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write highscores:', e.message);
  }
}

function getHighscores() {
  return readFile();
}

// entry: { roomName, score, deliveries, date }
function addHighscore(entry) {
  const scores = readFile();
  scores.push({
    roomName: entry.roomName || 'Unknown',
    score: entry.score || 0,
    deliveries: entry.deliveries || 0,
    date: entry.date || new Date().toISOString()
  });
  // Sort descending by score
  scores.sort((a, b) => b.score - a.score);
  // Keep top 5
  const top5 = scores.slice(0, 5);
  writeFile(top5);
  return top5;
}

module.exports = { getHighscores, addHighscore };
