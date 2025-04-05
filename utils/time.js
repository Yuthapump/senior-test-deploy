function getThaiTimestamp() {
  const now = new Date();
  const thailandTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return thailandTime.toISOString().slice(0, 19).replace("T", " ");
}

module.exports = { getThaiTimestamp };
