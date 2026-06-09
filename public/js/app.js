'use strict';

/**
 * Client logic for the website downloader: submit a request with options,
 * stream status over a per-session token channel, drive the progress UI, and
 * manage the download history panel.
 */
(function () {
  var socket = io.connect(document.URL);

  if (!localStorage.token) localStorage.token = generateToken(20);
  var token = localStorage.token;

  var el = function (id) {
    return document.getElementById(id);
  };
  var ui = {
    form: el('download-form'),
    website: el('website'),
    download: el('download'),
    stop: el('stop'),
    status: el('status'),
    label: el('status-label'),
    message: el('status-message'),
    bar: el('progress-bar'),
    fileCount: el('file-count'),
    currentFile: el('current-file'),
    sizeInfo: el('size-info'),
    link: el('download-link'),
    log: el('log'),
    historyList: el('history-list'),
    refreshHistory: el('refresh-history'),
  };

  var LABEL_CLASS = {
    queued: 'label-default',
    busy: 'label-warning',
    downloading: 'label-info',
    compressing: 'label-primary',
    done: 'label-success',
    cancelled: 'label-warning',
    error: 'label-danger',
  };

  // --- helpers ------------------------------------------------------------

  function generateToken(n) {
    var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var out = '';
    for (var i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    var units = ['B', 'KB', 'MB', 'GB', 'TB'];
    var i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + units[i];
  }

  function numValue(id) {
    var v = el(id).value;
    return v === '' ? undefined : Number(v);
  }

  function collectOptions() {
    return {
      depth: numValue('opt-depth'),
      maxSizeMb: numValue('opt-maxSize'),
      waitSeconds: numValue('opt-wait'),
      include: el('opt-include').value || undefined,
      exclude: el('opt-exclude').value || undefined,
      pageRequisites: el('opt-pageReq').checked,
      followExternal: el('opt-external').checked,
    };
  }

  function setRunning(running) {
    ui.download.disabled = running;
    ui.stop.hidden = !running;
  }

  function setProgress(determinate, percent) {
    if (determinate) {
      ui.bar.classList.remove('active');
      ui.bar.style.width = Math.max(0, Math.min(100, percent)) + '%';
    } else {
      ui.bar.classList.add('active');
      ui.bar.style.width = '100%';
    }
  }

  function setStatus(status, message) {
    ui.label.className = 'label ' + (LABEL_CLASS[status] || 'label-default');
    ui.label.textContent = status;
    ui.message.textContent = message || '';
  }

  function appendLog(text) {
    if (!text) return;
    var lines = (ui.log.textContent + text).split('\n').slice(-14);
    ui.log.textContent = lines.join('\n');
    ui.log.scrollTop = ui.log.scrollHeight;
  }

  // --- submit / cancel ----------------------------------------------------

  ui.form.addEventListener('submit', function (e) {
    e.preventDefault();
    var website = ui.website.value.trim();
    try {
      // Cheap UX-only check; the server is the real security boundary.
      void new URL(/^https?:\/\//i.test(website) ? website : 'http://' + website);
    } catch {
      ui.status.hidden = false;
      setStatus('error', 'Please enter a valid URL.');
      return;
    }

    ui.status.hidden = false;
    ui.link.hidden = true;
    ui.fileCount.textContent = '0';
    ui.currentFile.textContent = '';
    ui.sizeInfo.textContent = '';
    ui.log.textContent = '';
    setRunning(true);
    setStatus('queued', 'Submitting…');
    setProgress(false);
    socket.emit('request', { token: token, website: website, options: collectOptions() });
  });

  ui.stop.addEventListener('click', function () {
    socket.emit('cancel', { token: token });
    setStatus('cancelled', 'Cancelling…');
    setRunning(false);
  });

  // --- incoming status ----------------------------------------------------

  socket.on(token, function (event) {
    switch (event.status) {
      case 'queued':
        setStatus('queued', event.message);
        setProgress(false);
        break;
      case 'busy':
        setStatus('busy', event.message);
        setRunning(false);
        break;
      case 'downloading':
        setStatus('downloading', 'Downloading…');
        setProgress(false);
        if (typeof event.fileCount === 'number') ui.fileCount.textContent = event.fileCount;
        if (event.currentFile) ui.currentFile.textContent = event.currentFile;
        appendLog(event.message);
        break;
      case 'compressing':
        setStatus('compressing', 'Compressing…');
        if (event.total) setProgress(true, Math.round((event.processed / event.total) * 100));
        else setProgress(false);
        if (event.processed) ui.sizeInfo.textContent = formatBytes(event.processed);
        break;
      case 'done':
        setStatus('done', 'Completed!');
        setProgress(true, 100);
        setRunning(false);
        ui.sizeInfo.textContent = formatBytes(event.bytes || 0);
        ui.link.hidden = false;
        ui.link.href = '/sites/' + encodeURIComponent(event.file) + '.zip';
        loadHistory();
        break;
      case 'cancelled':
        setStatus('cancelled', event.message || 'Cancelled.');
        setProgress(true, 0);
        setRunning(false);
        loadHistory();
        break;
      case 'error':
        setStatus('error', event.message || 'Something went wrong.');
        setProgress(true, 0);
        setRunning(false);
        break;
      default:
        break;
    }
  });

  // --- history ------------------------------------------------------------

  function loadHistory() {
    fetch('/api/history')
      .then(function (r) {
        return r.json();
      })
      .then(renderHistory)
      .catch(function () {});
  }

  function renderHistory(items) {
    ui.historyList.innerHTML = '';
    if (!items || !items.length) {
      var empty = document.createElement('li');
      empty.className = 'muted';
      empty.textContent = 'No downloads yet.';
      ui.historyList.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      var li = document.createElement('li');

      var link = document.createElement('a');
      link.href = item.url;
      link.textContent = item.name;
      link.setAttribute('download', '');

      var meta = document.createElement('span');
      meta.className = 'muted history-meta';
      meta.textContent = formatBytes(item.size) + ' · ' + new Date(item.modified).toLocaleString();

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-xs btn-link history-delete';
      del.textContent = 'Delete';
      del.addEventListener('click', function () {
        deleteHistory(item.name);
      });

      li.appendChild(link);
      li.appendChild(meta);
      li.appendChild(del);
      ui.historyList.appendChild(li);
    });
  }

  function deleteHistory(name) {
    fetch('/api/history/' + encodeURIComponent(name), { method: 'DELETE' })
      .then(loadHistory)
      .catch(function () {});
  }

  ui.refreshHistory.addEventListener('click', loadHistory);
  loadHistory();
})();
