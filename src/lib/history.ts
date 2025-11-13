const KEY = 'mednote-history-v1';

export function loadHistory() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

export function saveHistoryItem(item: any) {
  const arr = loadHistory();
  arr.unshift(item); 
  localStorage.setItem(KEY, JSON.stringify(arr));
  window.dispatchEvent(new Event('history-updated')); 
}

export function clearHistory() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event('history-updated'));
}
