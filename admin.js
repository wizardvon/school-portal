// Script for managing school events in the admin portal
let events = [];

async function fetchEvents() {
  const res = await fetch('events.json');
  events = await res.json();
  renderTable();
}

function renderTable() {
  const tbody = document.querySelector('#eventsTable tbody');
  tbody.innerHTML = '';
  events.forEach((ev, i) => {
    const tr = document.createElement('tr');

    const imgTd = document.createElement('td');
    const img = document.createElement('img');
    img.src = ev.image;
    img.alt = ev.alt;
    imgTd.appendChild(img);

    const capTd = document.createElement('td');
    capTd.textContent = ev.caption;

    const actTd = document.createElement('td');
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.className = 'btn';
    editBtn.type = 'button';
    editBtn.onclick = () => loadForm(i);

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.className = 'btn danger';
    delBtn.type = 'button';
    delBtn.onclick = () => deleteEvent(i);

    actTd.append(editBtn, delBtn);
    tr.append(imgTd, capTd, actTd);
    tbody.appendChild(tr);
  });
}

function loadForm(i) {
  const ev = events[i];
  document.getElementById('eventIndex').value = i;
  document.getElementById('eventCaption').value = ev.caption;
  document.getElementById('eventAlt').value = ev.alt;
  document.getElementById('formTitle').textContent = 'Edit Event';
  document.getElementById('cancelEdit').style.display = 'inline-block';
}

document.getElementById('cancelEdit').addEventListener('click', () => {
  resetForm();
});

function resetForm() {
  document.getElementById('eventIndex').value = -1;
  document.getElementById('eventForm').reset();
  document.getElementById('formTitle').textContent = 'Add Event';
  document.getElementById('cancelEdit').style.display = 'none';
}

async function deleteEvent(i) {
  if (!confirm('Delete this event?')) return;
  events.splice(i, 1);
  try {
    await saveEvents('Remove event');
  } catch (err) {
    alert(err.message);
  }
  renderTable();
}

async function saveEvents(message) {
  const token = document.getElementById('ghToken').value.trim();
  const owner = document.getElementById('ghOwner').value.trim();
  const repo = document.getElementById('ghRepo').value.trim();
  if (!token || !owner || !repo) {
    alert('GitHub settings required.');
    return;
  }
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(events, null, 2))));
  const sha = await getSha('events.json', token, owner, repo);
  try {
    await githubUpload('events.json', content, message, token, owner, repo, sha);
  } catch (err) {
    alert(err.message);
    throw err;
  }
}

async function getSha(path, token, owner, repo) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (res.status === 200) {
    const data = await res.json();
    return data.sha;
  }
  return undefined;
}

async function githubUpload(path, content, message, token, owner, repo, sha) {
  const body = { message, content };
  if (sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    let text = '';
    try {
      text = await res.text();
    } catch (e) { /* ignore */ }
    throw new Error(`GitHub upload failed (${res.status}): ${text}`);
  }
}

document.getElementById('eventForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const idx = parseInt(document.getElementById('eventIndex').value, 10);
  const caption = document.getElementById('eventCaption').value.trim();
  const alt = document.getElementById('eventAlt').value.trim();
  const token = document.getElementById('ghToken').value.trim();
  const owner = document.getElementById('ghOwner').value.trim();
  const repo = document.getElementById('ghRepo').value.trim();
  if (!token || !owner || !repo) { alert('GitHub settings required.'); return; }
  const file = document.getElementById('eventImage').files[0];

  const finalize = async (imgPath) => {
    if (idx >= 0) {
      events[idx] = { image: imgPath || events[idx].image, alt, caption };
      try {
        await saveEvents('Update event');
      } catch (err) {
        alert(err.message);
        return;
      }
    } else {
      events.push({ image: imgPath, alt, caption });
      try {
        await saveEvents('Add event');
      } catch (err) {
        alert(err.message);
        return;
      }
    }
    renderTable();
    resetForm();
  };

  if (file) {
    const reader = new FileReader();
    reader.onload = async () => {
      const content = reader.result.split(',')[1];
      const path = `assets/events/${Date.now()}_${file.name}`;
      try {
        await githubUpload(path, content, 'Upload event image', token, owner, repo);
        finalize(path);
      } catch (err) {
        alert(err.message);
      }
    };
    reader.readAsDataURL(file);
  } else {
    finalize(idx >= 0 ? events[idx].image : '');
  }
});

fetchEvents();
