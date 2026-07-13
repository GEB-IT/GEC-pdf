const { PDFDocument, StandardFonts, rgb } = PDFLib;

let templateConfig;
let latestUrl;

const activityOptions = [
  'Arrivo',
  'Arrivo e welcome coffee',
  "Visita all'Experience Center",
  'Pranzo',
  'Attività ludica',
  'Cena',
  'Pausa caffè',
  'Chiusura'
];

const externalActivityOptions = [
  { value: 'Attività esterna', label: 'generica' },
  { value: 'ADI Design Museum', label: 'ADI Design Museum' },
  { value: 'San Fedele chiesa e museo', label: 'San Fedele chiesa e museo' },
  { value: 'Triennale museo design', label: 'Triennale museo design' },
  { value: 'Labirinto Pomodoro', label: 'Labirinto Pomodoro' },
  { value: 'MUDEC', label: 'MUDEC' },
  { value: 'Battello sul naviglio', label: 'Battello sul naviglio' },
  { value: 'Highline Milano', label: 'Highline Milano' },
  { value: 'San Siro museum', label: 'San Siro museum' },
  { value: 'ARMANI silos', label: 'ARMANI silos' },
  { value: 'Pizza making', label: 'Pizza making' },
  { value: 'Dromokart', label: 'Dromokart' },
  { value: 'Mercatino cocktail game', label: 'Mercatino cocktail game' }
];

const form = document.getElementById('pdfForm');
const previewBtn = document.getElementById('previewBtn');
const resetBtn = document.getElementById('resetBtn');
const resultPanel = document.getElementById('resultPanel');
const pdfPreview = document.getElementById('pdfPreview');
const downloadLink = document.getElementById('downloadLink');
const dayButtons = document.querySelectorAll('[data-day-button]');

async function loadConfig() {
  const res = await fetch('template.json');
  templateConfig = await res.json();
}

function hexToRgb01(hex) {
  const value = hex.replace('#', '');
  const bigint = parseInt(value, 16);
  return rgb(((bigint >> 16) & 255) / 255, ((bigint >> 8) & 255) / 255, (bigint & 255) / 255);
}

function getValue(name) {
  return String(new FormData(form).get(name) || '').trim();
}

function getDayCount() {
  return Number(getValue('numeroGiorni') || '1');
}

function parseIsoDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function dateToIso(date) {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function nextDayIso(value) {
  const date = parseIsoDate(value);
  if (!date) return '';
  date.setDate(date.getDate() + 1);
  return dateToIso(date);
}

function formatItalianDate(value) {
  const date = parseIsoDate(value);
  if (!date) return value || '';

  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function formatItalianDateWithoutYear(value) {
  const date = parseIsoDate(value);
  if (!date) return value || '';

  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long'
  }).format(date);
}

function formatRsvpText(value) {
  const formattedDate = formatItalianDateWithoutYear(value);
  return formattedDate ? `RSVP entro il ${formattedDate}` : '';
}

function populateTimeSelects() {
  const options = [];
  for (let hour = 7; hour <= 23; hour += 1) {
    for (const minute of [0, 30]) {
      if (hour === 7 && minute === 0) continue;
      if (hour === 23 && minute === 30) continue;
      const label = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      options.push(label);
    }
  }

  document.querySelectorAll('[data-time-select]').forEach((select) => {
    options.forEach((time) => {
      const option = document.createElement('option');
      option.value = time;
      option.textContent = time;
      select.appendChild(option);
    });
  });
}

function createExternalActivitySelect(select) {
  const detailSelect = document.createElement('select');
  detailSelect.id = select.id.replace(/^(att\d+)(_d\d+)$/, '$1_external$2');
  detailSelect.name = detailSelect.id;
  detailSelect.className = 'activity-detail';
  detailSelect.hidden = true;

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Scegli attività esterna';
  detailSelect.appendChild(placeholder);

  externalActivityOptions.forEach((activity) => {
    const option = document.createElement('option');
    option.value = activity.value;
    option.textContent = activity.label;
    detailSelect.appendChild(option);
  });

  select.insertAdjacentElement('afterend', detailSelect);
  return detailSelect;
}

function populateActivitySelects() {
  document.querySelectorAll('[data-activity-select]').forEach((select) => {
    const customInput = document.getElementById(select.id.replace(/^(att\d+)(_d\d+)$/, '$1_custom$2'));
    const externalSelect = createExternalActivitySelect(select);

    activityOptions.forEach((activity) => {
      const option = document.createElement('option');
      option.value = activity;
      option.textContent = activity;
      select.appendChild(option);
    });

    const otherOption = document.createElement('option');
    otherOption.value = '__other__';
    otherOption.textContent = 'Altro';
    select.appendChild(otherOption);

    select.addEventListener('change', () => {
      const isOther = select.value === '__other__';
      const isExternalActivity = select.value === 'Attività ludica';

      if (customInput) {
        customInput.hidden = !isOther;
        customInput.required = isOther;
        if (!isOther) customInput.value = '';
        if (isOther) customInput.focus();
      }

      if (externalSelect) {
        externalSelect.hidden = !isExternalActivity;
        externalSelect.required = isExternalActivity;
        if (!isExternalActivity) externalSelect.value = '';
        if (isExternalActivity) externalSelect.focus();
      }
    });
  });
}

function getActivityValue(day, index) {
  const selected = getValue(`att${index}_d${day}`);
  if (selected === '__other__') return getValue(`att${index}_custom_d${day}`);
  if (selected === 'Attività ludica') return getValue(`att${index}_external_d${day}`);
  return selected;
}

function buildAgendaText(day, index) {
  const time = getValue(`orario${index}_d${day}`);
  const activity = getActivityValue(day, index);
  if (time && activity) return `${time} - ${activity}`;
  return time || activity;
}

function drawAlignedText(page, text, box, font, color) {
  if (!text) return;
  const size = box.fontSize || 14;
  let printable = text;
  let textWidth = font.widthOfTextAtSize(printable, size);
  while (textWidth > box.width && printable.length > 3) {
    printable = printable.slice(0, -2).trim() + '...';
    textWidth = font.widthOfTextAtSize(printable, size);
  }

  let x = box.x;
  if (box.align === 'right') x = box.x + box.width - textWidth;
  if (box.align === 'center') x = box.x + (box.width - textWidth) / 2;

  page.drawText(printable, {
    x,
    y: box.y,
    size,
    font,
    color,
    maxWidth: box.width
  });
}

function drawDay(page, day, font, boldFont, color) {
  drawAlignedText(page, formatItalianDate(getValue(`data1_d${day}`)), templateConfig.fields.data1, boldFont, color);
  drawAlignedText(page, templateConfig.fixedFields.luogo1.value, templateConfig.fixedFields.luogo1, font, color);
  for (let i = 1; i <= 5; i += 1) {
    drawAlignedText(page, buildAgendaText(day, i), templateConfig.drawFields[`orario${i}_att${i}`], font, color);
  }
  drawAlignedText(page, formatRsvpText(getValue(`data2_d${day}`)), templateConfig.fields.data2, boldFont, color);
}

async function generatePdf() {
  if (!templateConfig) await loadConfig();

  const dayCount = getDayCount();
  const templateBytes = await fetch(templateConfig.template).then(r => r.arrayBuffer());
  const templateDoc = await PDFDocument.load(templateBytes);
  const pdfDoc = await PDFDocument.create();

  const copiedPages = await pdfDoc.copyPages(templateDoc, Array.from({ length: dayCount }, () => 0));
  copiedPages.forEach((page) => pdfDoc.addPage(page));

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const white = hexToRgb01(templateConfig.styles.textColor);

  for (let day = 1; day <= dayCount; day += 1) {
    drawDay(pdfDoc.getPages()[day - 1], day, font, boldFont, white);
  }

  return await pdfDoc.save();
}

function showPdf(bytes, downloadImmediately = false) {
  if (latestUrl) URL.revokeObjectURL(latestUrl);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  latestUrl = URL.createObjectURL(blob);
  pdfPreview.src = latestUrl;
  downloadLink.href = latestUrl;
  resultPanel.hidden = false;
  resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (downloadImmediately) downloadLink.click();
}

function syncDay2Dates() {
  const dataGiorno1 = document.getElementById('data1_d1');
  const rsvpGiorno1 = document.getElementById('data2_d1');
  const dataGiorno2 = document.getElementById('data1_d2');
  const rsvpGiorno2 = document.getElementById('data2_d2');

  if (dataGiorno2) dataGiorno2.value = nextDayIso(dataGiorno1.value);
  if (rsvpGiorno2) rsvpGiorno2.value = rsvpGiorno1.value;
}

function updateDayVisibility() {
  const dayCount = getDayCount();
  const day2Section = document.querySelector('[data-day-section="2"]');
  dayButtons.forEach((button) => {
    const isActive = Number(button.dataset.dayButton) === dayCount;
    button.classList.toggle('active', isActive);
  });
  if (day2Section) day2Section.hidden = dayCount !== 2;
  if (dayCount === 2) syncDay2Dates();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    showPdf(await generatePdf(), true);
  } catch (error) {
    alert(`Errore durante la generazione del PDF: ${error.message}`);
  }
});

previewBtn.addEventListener('click', async () => {
  try {
    showPdf(await generatePdf(), false);
  } catch (error) {
    alert(`Errore durante la generazione dell'anteprima: ${error.message}`);
  }
});

dayButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const input = button.querySelector('input[type="radio"]');
    if (input) input.checked = true;
    updateDayVisibility();
  });
});
document.getElementById('data1_d1').addEventListener('change', () => {
  if (getDayCount() === 2) syncDay2Dates();
});
document.getElementById('data2_d1').addEventListener('change', () => {
  if (getDayCount() === 2) syncDay2Dates();
});

function resetFormData() {
  form.reset();

  const oneDayInput = form.querySelector('input[name="numeroGiorni"][value="1"]');
  if (oneDayInput) oneDayInput.checked = true;

  document.querySelectorAll('[data-activity-select]').forEach((select) => {
    select.value = '';
    const customInput = document.getElementById(select.id.replace(/^(att\d+)(_d\d+)$/, '$1_custom$2'));
    const externalSelect = document.getElementById(select.id.replace(/^(att\d+)(_d\d+)$/, '$1_external$2'));
    if (customInput) {
      customInput.value = '';
      customInput.hidden = true;
      customInput.required = false;
    }
    if (externalSelect) {
      externalSelect.value = '';
      externalSelect.hidden = true;
      externalSelect.required = false;
    }
  });

  updateDayVisibility();

  if (latestUrl) {
    URL.revokeObjectURL(latestUrl);
    latestUrl = null;
  }
  pdfPreview.removeAttribute('src');
  downloadLink.removeAttribute('href');
  resultPanel.hidden = true;
  document.getElementById('generator').scrollIntoView({ behavior: 'smooth' });
}

resetBtn.addEventListener('click', resetFormData);

populateTimeSelects();
populateActivitySelects();
updateDayVisibility();
loadConfig();
