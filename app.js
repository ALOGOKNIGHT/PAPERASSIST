const importedQuestions = window.PAPERCRAFT_QUESTION_BANK || [];
const questionBankFiles = {
  'JEE Main|Physics': 'jee-main-physics.json.gz',
  'JEE Main|Chemistry': 'jee-main-chemistry.json.gz',
  'JEE Main|Mathematics': 'jee-main-mathematics.json.gz',
  'NEET|Physics': 'neet-physics.json.gz',
  'NEET|Chemistry': 'neet-chemistry.json.gz',
  'NEET|Biology': 'neet-biology.json.gz',
};
const demoOptions = {
  'demo-jee-chem-bonding':['CO₂','H₂O','NH₃','CH₄'], 'demo-jee-chem-equilibrium':['Q = K','Q < K','Q > K','Q = 0'],
  'demo-jee-math-integrals':['9','6','3','18'], 'demo-jee-math-algebra':['0','1','−1','b²'],
  'demo-neet-bio-cell':['Mitochondrion','Golgi apparatus','Ribosome','Lysosome'], 'demo-neet-bio-genetics':['9:3:3:1','3:1','1:1','1:2:1'],
  'demo-neet-chem-organic':['Bromine water','Benedict solution','Biuret reagent','Iodine solution'], 'demo-neet-chem-atomic':['3','1','5','7'],
  'demo-neet-physics-motion':['Acceleration','Velocity','Displacement','Mass'], 'demo-neet-physics-optics':['At 2F','At F','At infinity','Between F and 2F'],
  'demo-jee-physics-energy':['½mv²','mv','mgh','ma'], 'demo-jee-physics-motion':['at','½at²','a/t','2at'],
};
const demoQuestion = (id, exam, subject, chapter, name, text) => ({ id, exam, subject, chapter, name, text, questionHtml: '', options: (demoOptions[id]||['First choice','Second choice','Third choice','Fourth choice']).map((text,index)=>({label:String.fromCharCode(65+index),text})), type:'Single correct', marks:'4 marks', paper:`${exam} ${exam === 'NEET' ? 'Practice' : 'Demo'}`, year:'Demo', level:'Medium', difficultyEstimated:false, difficultyMissing:false });
const sampleQuestions = [
  demoQuestion('demo-jee-chem-bonding','JEE Main','Chemistry','Chemical Bonding','Chemical Bonding','Which molecule has a linear geometry?'),
  demoQuestion('demo-jee-chem-equilibrium','JEE Main','Chemistry','Equilibrium','Equilibrium','For a reaction at equilibrium, how is K related to Q?'),
  demoQuestion('demo-jee-math-integrals','JEE Main','Mathematics','Definite Integration','Definite Integration','Evaluate the definite integral of 2x from 0 to 3.'),
  demoQuestion('demo-jee-math-algebra','JEE Main','Mathematics','Quadratic Equations','Quadratic Equations','If the roots of a quadratic are equal, what is its discriminant?'),
  demoQuestion('demo-neet-bio-cell','NEET','Biology','Cell: The Unit of Life','Cell Biology','Which organelle is the primary site of ATP synthesis?'),
  demoQuestion('demo-neet-bio-genetics','NEET','Biology','Principles of Inheritance','Genetics','What phenotypic ratio is expected in a Mendelian dihybrid cross?'),
  demoQuestion('demo-neet-chem-organic','NEET','Chemistry','Organic Chemistry','Organic Chemistry','Which reagent is commonly used to test for an unsaturated bond?'),
  demoQuestion('demo-neet-chem-atomic','NEET','Chemistry','Atomic Structure','Atomic Structure','How many orbitals are present in a p subshell?'),
  demoQuestion('demo-neet-physics-motion','NEET','Physics','Laws of Motion','Laws of Motion','A constant net force acts on a body. Which quantity remains constant?'),
  demoQuestion('demo-neet-physics-optics','NEET','Physics','Ray Optics','Ray Optics','For a convex lens, where is the image formed when the object is at 2F?'),
  demoQuestion('demo-jee-physics-energy','JEE Main','Physics','Work, Energy and Power','Work, Energy and Power','A body of mass m moves at speed v. Write its kinetic energy.'),
  demoQuestion('demo-jee-physics-motion','JEE Main','Physics','Kinematics','Kinematics','A body starts from rest with constant acceleration a. Find its speed after time t.'),
];
const customQuestionStorageKey = 'papercraft-custom-questions-v1';
const pdfQuestionStorageKey = 'papercraft-pdf-imported-questions-v1';
const deletedQuestionsStorageKey = 'papercraft-deleted-question-ids-v1';
const editedQuestionsStorageKey = 'papercraft-question-edits-v1';
let savedCustomQuestions = [];
let savedPdfQuestions = [];
let deletedQuestionIds = [];
let editedBankQuestions = {};
try {
  const storedCustomQuestions = JSON.parse(localStorage.getItem(customQuestionStorageKey) || '[]');
  if (Array.isArray(storedCustomQuestions)) savedCustomQuestions = storedCustomQuestions;
} catch (error) {
  console.warn('Could not load saved custom questions.', error);
}
try {
  const storedPdfQuestions = JSON.parse(localStorage.getItem(pdfQuestionStorageKey) || '[]');
  if (Array.isArray(storedPdfQuestions)) savedPdfQuestions = storedPdfQuestions;
} catch (error) {
  console.warn('Could not load PDF-imported questions.', error);
}
try {
  const storedDeletedQuestionIds = JSON.parse(localStorage.getItem(deletedQuestionsStorageKey) || '[]');
  if (Array.isArray(storedDeletedQuestionIds)) deletedQuestionIds = storedDeletedQuestionIds;
} catch (error) {
  console.warn('Could not load removed question IDs.', error);
}
try {
  const storedQuestionEdits = JSON.parse(localStorage.getItem(editedQuestionsStorageKey) || '{}');
  if (storedQuestionEdits && typeof storedQuestionEdits === 'object' && !Array.isArray(storedQuestionEdits)) editedBankQuestions = storedQuestionEdits;
} catch (error) {
  console.warn('Could not load saved question edits.', error);
}
// Keep mock demo prompts out of the real question bank; only imported and educator-authored questions belong here.
let questions = [...importedQuestions, ...savedCustomQuestions, ...savedPdfQuestions].map(question => editedBankQuestions[question.id] ? { ...question, ...editedBankQuestions[question.id] } : question);
const loadedQuestionBanks = new Set();
const questionBankLoads = new Map();
const homePage = document.querySelector('#home-page');
const studioView = document.querySelector('#studio-view');
const authOverlay = document.querySelector('#auth-overlay');
const authForm = document.querySelector('#auth-form');
const authMessage = document.querySelector('#auth-message');
const authSubmit = document.querySelector('#auth-submit');
let authMode = 'login';
let mode = 'coaching';
let activeWorkflowTab = 'details';
let activeSchoolStep = 'details';
const supabaseConfig = window.PAPERCRAFT_SUPABASE_CONFIG || {};
const supabaseReady = Boolean(supabaseConfig.url && supabaseConfig.publishableKey && window.supabase?.createClient);
const supabaseClient = supabaseReady
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey)
  : null;

function setAuthMessage(message, state = 'info') {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.dataset.state = state;
  authMessage.classList.toggle('hidden', !message);
}

let currentUser = null;

function renderSignedInUser(user) {
  currentUser = user;
  const email = user?.email || '';
  const initials = email ? email.split('@')[0].split(/[._-]/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() : '?';
  const profileName = document.querySelector('#profile-name');
  const profileLabel = document.querySelector('#profile-label');
  if (profileName) profileName.textContent = email ? email.split('@')[0] : 'Guest educator';
  if (profileLabel) profileLabel.textContent = email || 'Guest workspace';
  document.querySelectorAll('.profile-avatar,.top-actions .avatar.small').forEach(avatar => { avatar.textContent = initials || '?'; });
  document.querySelector('#logout-button')?.classList.toggle('hidden', !user);
  window.dispatchEvent(new Event('papercraft-session-ready'));
}

function navigateView() {
  const route = location.hash.slice(1) || 'home';
  const appRoutes = ['studio', 'bank', 'drafts', 'coaching', 'school'];
  const inApp = appRoutes.includes(route);
  if (inApp && !currentUser) {
    location.hash = 'home';
    showAuth('login');
    return;
  }
  homePage.classList.toggle('hidden', inApp);
  studioView.classList.toggle('hidden', !inApp);
  if (!inApp) return;
  const dashboard = document.querySelector('#dashboard-home');
  const papers = document.querySelector('#my-papers-view');
  const builder = document.querySelector('.builder');
  const workflowHeader = document.querySelector('#workflow-header');
  const coachingTabs = document.querySelector('#coaching-tabs');
  const schoolTabs = document.querySelector('#school-tabs');
  const bank = document.querySelector('#bank');
  const isDashboard = route === 'studio';
  const isPapers = route === 'drafts';
  const isWorkflow = ['bank', 'coaching', 'school'].includes(route);
  if (route === 'school') mode = 'school';
  if (route === 'coaching' || route === 'bank') mode = 'coaching';
  document.querySelector('#coaching-preview-controls')?.classList.toggle('hidden', mode !== 'coaching');
  if (route === 'bank') activeWorkflowTab = 'questions';
  if (isDashboard) {
    document.querySelectorAll('.mode-card').forEach(card => { card.classList.remove('selected'); card.setAttribute('aria-pressed', 'false'); });
    dashboard?.classList.remove('hidden'); papers?.classList.add('hidden'); builder?.classList.add('hidden'); bank?.classList.add('hidden');
    workflowHeader?.classList.add('hidden'); coachingTabs?.classList.add('hidden'); schoolTabs?.classList.add('hidden');
  } else if (isPapers) {
    dashboard?.classList.add('hidden'); papers?.classList.remove('hidden'); builder?.classList.add('hidden'); bank?.classList.add('hidden');
    workflowHeader?.classList.add('hidden'); coachingTabs?.classList.add('hidden'); schoolTabs?.classList.add('hidden');
  } else if (isWorkflow) {
    dashboard?.classList.add('hidden'); papers?.classList.add('hidden'); builder?.classList.remove('hidden');
    workflowHeader?.classList.remove('hidden');
    coachingTabs?.classList.toggle('hidden', mode !== 'coaching');
    schoolTabs?.classList.toggle('hidden', mode !== 'school');
    const coachingStep = ['details', 'questions', 'preview'].indexOf(activeWorkflowTab);
    coachingTabs.dataset.step = Math.max(0, coachingStep);
    coachingTabs.querySelectorAll('.workflow-tab').forEach(button => {
      const active = button.dataset.coachingTab === activeWorkflowTab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    const schoolStep = ['details', 'sections', 'preview'].indexOf(activeSchoolStep);
    schoolTabs.dataset.step = Math.max(0, schoolStep);
    schoolTabs.querySelectorAll('.workflow-tab').forEach(button => {
      const active = button.dataset.schoolTab === activeSchoolStep;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    document.querySelector('#coaching-settings')?.classList.toggle('hidden', mode === 'school');
    document.querySelector('#school-settings')?.classList.toggle('hidden', mode !== 'school');
    document.querySelector('#paper-preview')?.classList.toggle('school-preview', mode === 'school');
    document.querySelector('#coaching-preview-content')?.classList.toggle('hidden', mode === 'school');
    document.querySelector('#school-preview-content')?.classList.toggle('hidden', mode !== 'school');
    document.querySelectorAll('.mode-card').forEach(card => { const active=card.dataset.mode===mode; card.classList.toggle('selected',active); card.setAttribute('aria-pressed',String(active)); });
    document.querySelector('#bank')?.classList.toggle('hidden', mode === 'school' || activeWorkflowTab !== 'questions');
    document.querySelector('.setup-layout')?.classList.toggle('hidden', mode === 'coaching' && activeWorkflowTab === 'questions');
    document.querySelector('.setup-layout')?.setAttribute('data-tab', mode === 'school' ? activeSchoolStep : activeWorkflowTab);
    document.querySelector('#workflow-kicker').textContent = mode === 'school' ? 'SCHOOL EXAMINATION' : 'COACHING INSTITUTE';
    document.querySelector('#workflow-title').textContent = mode === 'school' ? 'Build your school paper' : 'Build your coaching paper';
    document.querySelector('#bank-heading').textContent = activeWorkflowTab === 'questions' ? 'Add questions' : 'Pick your questions';
    document.querySelector('#builder-title')?.replaceChildren(document.createTextNode(mode === 'school' ? 'School paper' : 'Coaching paper'));
    document.querySelector('#bank')?.classList.toggle('school-disabled', mode === 'school');
    document.querySelector('#school-settings')?.querySelector('.school-details-group')?.classList.toggle('hidden', mode === 'school' && activeSchoolStep !== 'details');
    document.querySelector('#school-settings')?.querySelector('.school-section-step')?.classList.toggle('hidden', mode === 'school' && activeSchoolStep !== 'sections');
    document.querySelector('.nav-item[href="#bank"]')?.classList.toggle('hidden', mode === 'school');
    document.querySelector('.setup-layout')?.classList.toggle('preview-only', mode === 'school' ? activeSchoolStep === 'preview' : activeWorkflowTab === 'preview');
  }
  document.querySelector('.nav-item[href="#studio"]')?.classList.toggle('active', isDashboard);
  document.querySelector('.nav-item[href="#bank"]')?.classList.toggle('active', route === 'bank' || (route === 'coaching' && activeWorkflowTab === 'questions'));
  document.querySelector('.nav-item[href="#bank"]')?.classList.toggle('hidden', !isWorkflow || mode !== 'coaching');
  document.querySelector('.nav-item[href="#drafts"]')?.classList.toggle('active', isPapers);
  document.querySelector('.breadcrumb strong').textContent = isPapers ? 'My papers' : isDashboard ? 'Paper studio' : route === 'bank' || activeWorkflowTab === 'questions' ? 'Add questions' : 'Paper studio';
  if (route === 'bank' || (route === 'coaching' && activeWorkflowTab === 'questions')) render();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', navigateView);
navigateView();

function showAuth(nextMode) {
  authMode = nextMode;
  const signup = authMode === 'signup';
  document.querySelector('#auth-title').textContent = signup ? 'Create your account' : 'Welcome back';
  document.querySelector('#auth-description').textContent = signup ? 'Get your educator workspace ready.' : 'Log in to continue creating exam papers.';
  document.querySelector('#auth-submit').innerHTML = `${signup ? 'Sign up' : 'Log in'} <span>→</span>`;
  document.querySelector('#auth-password').autocomplete = signup ? 'new-password' : 'current-password';
  document.querySelector('#auth-switch-prompt').textContent = signup ? 'Already have an account?' : 'New to PaperCraft?';
  document.querySelector('#auth-switch').textContent = signup ? 'Log in' : 'Create an account';
  document.querySelector('#auth-password').value = '';
  setAuthMessage(supabaseReady ? '' : 'Supabase is not configured yet. Add your project URL and publishable key to data/supabase-config.js.', supabaseReady ? 'info' : 'error');
  authOverlay.classList.remove('hidden');
  document.body.classList.add('auth-open');
  document.querySelector('#auth-email').focus();
}
document.querySelectorAll('[data-auth]').forEach(button => button.addEventListener('click', () => showAuth(button.dataset.auth)));
document.querySelector('#auth-switch').addEventListener('click', () => showAuth(authMode === 'signup' ? 'login' : 'signup'));
function closeAuth() {
  authOverlay.classList.add('hidden');
  document.body.classList.remove('auth-open');
}
document.querySelector('.auth-close').addEventListener('click', closeAuth);
authOverlay.addEventListener('click', event => { if (event.target === authOverlay) closeAuth(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !authOverlay.classList.contains('hidden')) closeAuth(); });
authForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabaseClient) {
    setAuthMessage('Supabase is not configured yet. Add your project URL and publishable key to data/supabase-config.js.', 'error');
    return;
  }
  const email = document.querySelector('#auth-email').value.trim();
  const password = document.querySelector('#auth-password').value;
  let originalLabel = authSubmit.innerHTML;
  authSubmit.disabled = true;
  authSubmit.innerHTML = 'Please wait…';
  authForm.setAttribute('aria-busy', 'true');
  setAuthMessage('', 'info');
  try {
    if (authMode === 'signup') {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;
      if (data.session) {
        setAuthMessage('Your account is ready. Opening your workspace…', 'success');
        renderSignedInUser(data.user);
        closeAuth();
        location.hash = 'studio';
      } else {
        setAuthMessage('Account created. Check your inbox for the confirmation link, then log in.', 'success');
        authMode = 'login';
        document.querySelector('#auth-title').textContent = 'Check your email';
        document.querySelector('#auth-description').textContent = 'Confirm your email address, then come back to log in.';
        originalLabel = 'Log in <span>→</span>';
      }
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      renderSignedInUser(data.user);
      closeAuth();
      location.hash = 'studio';
    }
  } catch (error) {
    setAuthMessage(error.message || 'Authentication failed. Please try again.', 'error');
  } finally {
    authSubmit.disabled = false;
    authSubmit.innerHTML = originalLabel;
    authForm.removeAttribute('aria-busy');
  }
});
document.querySelector('#logout-button')?.addEventListener('click', async () => {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) toast(error.message);
  else {
    toast('You have signed out.');
    location.hash = 'home';
  }
});
if (supabaseClient) {
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) setAuthMessage(error.message, 'error');
    renderSignedInUser(data?.session?.user || null);
    navigateView();
  });
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    renderSignedInUser(session?.user || null);
    navigateView();
  });
} else {
  renderSignedInUser(null);
}

document.querySelectorAll('a[href="#studio"], a[href="#coaching"], a[href="#school"]').forEach(link => {
  link.addEventListener('click', event => {
    if (!currentUser) {
      event.preventDefault();
      showAuth('login');
    }
  });
});
const selected = new Set();
let activeLevel = 'All';
let activeType = 'All types';
let activeSource = 'All sources';
let activeChapter = 'All chapters';
let activeExamFamily = 'JEE';
let showAll = false;
const selectedMarks = new Map();
const list = document.querySelector('#question-list');
const typeFilter = document.querySelector('#type-filter');
const sourceFilter = document.querySelector('#source-filter');
function refreshBankFilters() {
  const questionTypes = [...new Set(questions.map(q => q.type))].sort();
  const selectedType = typeFilter.value;
  typeFilter.innerHTML = '<option>All types</option>' + questionTypes.map(type => `<option value="${escapeHTML(type)}">${escapeHTML(type)}</option>`).join('');
  if (questionTypes.includes(selectedType)) typeFilter.value = selectedType;
  const questionSources = [...new Set(questions.map(q => q.year && q.year !== 'Demo' ? `${q.paper} · ${q.year}` : q.paper))].sort();
  const selectedSource = sourceFilter.value;
  sourceFilter.innerHTML = '<option>All sources</option>' + questionSources.map(source => `<option value="${escapeHTML(source)}">${escapeHTML(source)}</option>`).join('');
  if (questionSources.includes(selectedSource)) sourceFilter.value = selectedSource;
}

let svgDefinitionRoot = null;
const mountedSvgDefinitions = new Set();
function mountSvgDefinitions(definitions = []) {
  const additions = definitions.filter(definition => !mountedSvgDefinitions.has(definition));
  if (!additions.length) return;
  if (!svgDefinitionRoot) {
    svgDefinitionRoot = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgDefinitionRoot.setAttribute('aria-hidden', 'true');
    svgDefinitionRoot.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    document.body.prepend(svgDefinitionRoot);
  }
  additions.forEach(definition => mountedSvgDefinitions.add(definition));
  svgDefinitionRoot.insertAdjacentHTML('beforeend', additions.join(''));
}

const svgDefinitions = window.PAPERCRAFT_MATH_SVG_DEFINITIONS || [];
mountSvgDefinitions(svgDefinitions);

function ensureQuestionBankLoaded(exam, subject) {
  const subjects = subject === 'Full syllabus'
    ? (exam === 'NEET' ? ['Physics', 'Chemistry', 'Biology'] : ['Physics', 'Chemistry', 'Mathematics'])
    : [subject];
  const requests = subjects.map(name => {
    const key = `${exam}|${name}`;
    const filename = questionBankFiles[key];
    if (!filename || loadedQuestionBanks.has(key)) return Promise.resolve();
    if (questionBankLoads.has(key)) return questionBankLoads.get(key);
    const request = fetch(`data/question-banks/${filename}`)
      .then(async response => {
        if (!response.ok) throw new Error(`Could not load the ${exam} ${name} question bank.`);
        if (!('DecompressionStream' in window)) throw new Error('This browser does not support compressed question banks.');
        const stream = new Blob([await response.arrayBuffer()]).stream().pipeThrough(new DecompressionStream('gzip'));
        return new Response(stream).json();
      })
      .then(bank => {
        const existingIds = new Set(questions.map(question => question.id));
        const additions = (bank.questions || []).filter(question => !existingIds.has(question.id)).map(question => editedBankQuestions[question.id] ? { ...question, ...editedBankQuestions[question.id] } : question);
        questions.push(...additions);
        mountSvgDefinitions(bank.mathSvgDefinitions || []);
        loadedQuestionBanks.add(key);
        questionBankLoads.delete(key);
        refreshBankFilters();
      })
      .catch(error => {
        questionBankLoads.delete(key);
        throw error;
      });
    questionBankLoads.set(key, request);
    return request;
  });
  return Promise.all(requests);
}

function getMatchingQuestions(includeLevel = true) {
  const subject = document.querySelector('#subject-select')?.value || 'Physics';
  const exam = document.querySelector('#exam-select')?.value || 'JEE Main';
  return questions.filter(q =>
    !deletedQuestionIds.includes(q.id) &&
    q.exam === exam &&
    (subject === 'Full syllabus' || q.subject === subject) &&
    (activeChapter === 'All chapters' || q.chapter === activeChapter) &&
    (activeSource === 'All sources' || (q.year && q.year !== 'Demo' ? `${q.paper} · ${q.year}` : q.paper) === activeSource) &&
    (!includeLevel || activeLevel === 'All' || q.level === activeLevel) &&
    (activeType === 'All types' || q.type === activeType)
  );
}

function renderBankNavigation() {
  const exam = document.querySelector('#exam-select')?.value || 'JEE Main';
  const subject = document.querySelector('#subject-select')?.value || 'Physics';
  const family = exam.startsWith('NEET') ? 'NEET' : 'JEE';
  activeExamFamily = family;
  document.querySelectorAll('.bank-exam').forEach(button => button.classList.toggle('active', button.dataset.examFamily === family));
  const subjects = exam === 'NEET' ? ['Physics', 'Chemistry', 'Biology'] : ['Physics', 'Chemistry', 'Mathematics'];
  const subjectHost = document.querySelector('#bank-subjects');
  subjectHost.innerHTML = subjects.map(name => `<button class="subject-chip ${name === subject ? 'active' : ''}" data-subject="${escapeHTML(name)}">${escapeHTML(name)}</button>`).join('');
  subjectHost.querySelectorAll('[data-subject]').forEach(button => button.addEventListener('click', () => {
    document.querySelector('#subject-select').value = button.dataset.subject;
    const customSubject = document.querySelector('#custom-q-subject');
    if (customSubject && [...customSubject.options].some(option => option.value === button.dataset.subject)) customSubject.value = button.dataset.subject;
    activeChapter = 'All chapters';
    render();
  }));
  const matching = questions.filter(q => q.exam === exam && !deletedQuestionIds.includes(q.id) && (subject === 'Full syllabus' || q.subject === subject));
  const chapters = [...new Set(matching.map(q => q.chapter))].sort((a,b) => a.localeCompare(b));
  const search = (document.querySelector('#chapter-search')?.value || '').trim().toLowerCase();
  const visible = chapters.filter(chapter => chapter.toLowerCase().includes(search));
  document.querySelector('#chapter-list').innerHTML = `<button class="chapter-chip ${activeChapter === 'All chapters' ? 'active' : ''}" data-chapter="All chapters"><span>All chapters</span><b>${matching.length}</b></button>` + visible.map(chapter => `<button class="chapter-chip ${activeChapter === chapter ? 'active' : ''}" data-chapter="${escapeHTML(chapter)}"><span>${escapeHTML(chapter)}</span><b>${matching.filter(q => q.chapter === chapter).length}</b></button>`).join('');
  document.querySelectorAll('.chapter-chip').forEach(button => button.addEventListener('click', () => { activeChapter = button.dataset.chapter; render(); }));
  document.querySelector('#bank-breadcrumb').innerHTML = `<span>${family}</span><b>›</b><span>${escapeHTML(subject)}</span><b>›</b><strong>${escapeHTML(activeChapter)}</strong>`;
}

function updateDifficultyCounts() {
  const matching = getMatchingQuestions(false);
  const counts = { All: matching.length, Easy: 0, Medium: 0, Hard: 0 };
  matching.forEach(q => { if (counts[q.level] !== undefined) counts[q.level] += 1; });
  document.querySelectorAll('.difficulty').forEach(button => {
    const count = button.querySelector('span');
    if (count) count.textContent = counts[button.dataset.level] ?? 0;
  });
}

function renderCoachingPreview() {
  const host = document.querySelector('#coaching-preview-questions');
  if (!host) return;
  if (window.MathJax?.typesetClear) window.MathJax.typesetClear([host]);
  const chosen = [...selected].map(id => questions.find(q => q.id === id)).filter(Boolean);
  const optionLineCount = Number(document.querySelector('#preview-option-lines')?.value || 0);
  host.innerHTML = chosen.length ? chosen.map((q, index) => `
    <div class="paper-question" draggable="true" data-paper-question="${escapeHTML(q.id)}">
      <div class="paper-question-main"><span class="paper-question-number">${index + 1}.</span><div class="paper-question-copy"><div class="paper-question-content">${q.questionHtml || escapeHTML(q.text)}</div>${(q.imageUrls || []).map(url => `<img class="paper-question-image" src="${escapeHTML(url)}" alt="Question illustration"/>`).join('')}</div></div>
      ${q.options.length ? `<div class="paper-options option-rows-${optionLineCount}">${q.options.map(option => `<div class="paper-option"><div><b>${escapeHTML(option.label)}.</b> ${option.html || escapeHTML(option.text)}</div></div>`).join('')}</div>` : ''}
      <div class="paper-question-tools"><button type="button" data-move="up" data-id="${escapeHTML(q.id)}" aria-label="Move question up" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="down" data-id="${escapeHTML(q.id)}" aria-label="Move question down" ${index === chosen.length - 1 ? 'disabled' : ''}>↓</button><label>Marks <input data-mark-id="${escapeHTML(q.id)}" type="number" min="1" max="20" value="${selectedMarks.get(q.id) || Number.parseInt(q.marks,10) || 1}"/></label><button type="button" data-remove-id="${escapeHTML(q.id)}" aria-label="Remove question">×</button></div>
    </div>`).join('') : '<div class="paper-empty-note">Add questions from your bank to build this paper.</div>';
  typesetQuestionMath(host);
  host.querySelectorAll('[data-remove-id]').forEach(button => button.addEventListener('click', () => { selected.delete(button.dataset.removeId); render(); toast('Question removed from your paper.'); }));
  host.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', () => moveQuestion(button.dataset.id, button.dataset.move)));
  host.querySelectorAll('[data-mark-id]').forEach(input => input.addEventListener('change', () => { selectedMarks.set(input.dataset.markId, Number(input.value) || 1); render(); saveCurrentPaper(); }));
  host.querySelectorAll('[data-paper-question]').forEach(row => {
    row.addEventListener('dragstart', event => { event.dataTransfer.setData('text/plain',row.dataset.paperQuestion); event.dataTransfer.effectAllowed='move'; row.classList.add('dragging'); });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    row.addEventListener('dragover', event => { event.preventDefault(); row.classList.add('drag-target'); });
    row.addEventListener('dragleave', () => row.classList.remove('drag-target'));
    row.addEventListener('drop', event => { event.preventDefault(); row.classList.remove('drag-target'); const moving=event.dataTransfer.getData('text/plain'); if(moving && moving!==row.dataset.paperQuestion){const order=[...selected];const from=order.indexOf(moving),to=order.indexOf(row.dataset.paperQuestion);if(from>=0&&to>=0){order.splice(from,1);order.splice(to,0,moving);selected.clear();order.forEach(id=>selected.add(id));render();}} });
  });
}

const pendingMathTypeset = new Set();
function typesetQuestionMath(container) {
  if (!container?.isConnected) return;
  if (window.MathJax?.typesetPromise) {
    window.MathJax.typesetPromise([container]).catch(error => console.warn('Could not render pasted equation.', error));
    return;
  }
  pendingMathTypeset.add(container);
  const loader = document.querySelector('#MathJax-script');
  if (loader && !loader.dataset.paperCraftTypesetPending) {
    loader.dataset.paperCraftTypesetPending = 'true';
    loader.addEventListener('load', () => {
      const containers = [...pendingMathTypeset].filter(item => item.isConnected);
      pendingMathTypeset.clear();
      if (containers.length && window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise(containers).catch(error => console.warn('Could not render pasted equation.', error));
      }
    }, { once: true });
  }
}

function moveQuestion(id, direction) {
  const order = [...selected];
  const from = order.indexOf(id);
  const to = from + (direction === 'up' ? -1 : 1);
  if (from < 0 || to < 0 || to >= order.length) return;
  [order[from], order[to]] = [order[to], order[from]];
  selected.clear(); order.forEach(questionId => selected.add(questionId)); render();
}

function render() {
  const route = location.hash.slice(1);
  const bankIsVisible = mode === 'coaching' && (route === 'bank' || (route === 'coaching' && activeWorkflowTab === 'questions'));
  const exam = document.querySelector('#exam-select')?.value || 'JEE Main';
  const subject = document.querySelector('#subject-select')?.value || 'Physics';
  const bankKey = `${exam}|${subject}`;
  if (bankIsVisible && subject !== 'Full syllabus' && questionBankFiles[bankKey] && !loadedQuestionBanks.has(bankKey)) {
    list.innerHTML = '<div class="empty-state"><strong>Loading question bank…</strong><span>Large chapter banks load only when you open them.</span></div>';
    document.querySelector('#showing-count').textContent = 'Loading questions…';
    ensureQuestionBankLoaded(exam, subject).then(() => render()).catch(error => {
      console.error(error);
      list.innerHTML = '<div class="empty-state"><strong>Could not load this question bank.</strong><span>Check your connection and reload the page.</span></div>';
      document.querySelector('#showing-count').textContent = 'Question bank unavailable';
    });
    return;
  }
  if (bankIsVisible && subject === 'Full syllabus') {
    const needed = (exam === 'NEET' ? ['Physics', 'Chemistry', 'Biology'] : ['Physics', 'Chemistry', 'Mathematics'])
      .filter(name => questionBankFiles[`${exam}|${name}`] && !loadedQuestionBanks.has(`${exam}|${name}`));
    if (needed.length) {
      list.innerHTML = '<div class="empty-state"><strong>Loading question banks…</strong><span>Full syllabus includes several subject banks.</span></div>';
      document.querySelector('#showing-count').textContent = 'Loading questions…';
      ensureQuestionBankLoaded(exam, subject).then(() => render()).catch(error => {
        console.error(error);
        list.innerHTML = '<div class="empty-state"><strong>Could not load these question banks.</strong><span>Check your connection and reload the page.</span></div>';
        document.querySelector('#showing-count').textContent = 'Question bank unavailable';
      });
      return;
    }
  }
  const matching = getMatchingQuestions();
  const visible = showAll ? matching : matching.slice(0, 4);
  renderBankNavigation();
  list.innerHTML = visible.length ? visible.map((q, i) => `<article class="question-row"><span class="q-number">${String(i + 1).padStart(2, '0')}</span><div class="question-row-copy"><div class="q-title">${escapeHTML(q.name)} <span class="question-chapter">${escapeHTML(q.chapter)}</span></div><div class="question-list-prompt">${q.questionHtml || escapeHTML(q.text)}</div><div class="question-list-full hidden"><div class="question-list-full-prompt">${q.questionHtml || escapeHTML(q.text)}</div>${(q.imageUrls || []).map(url => `<img src="${escapeHTML(url)}" alt="Question illustration" loading="lazy"/>`).join('')}<div class="question-list-full-options">${(q.options || []).map(option => `<div><b>${escapeHTML(option.label)}.</b> ${option.html || escapeHTML(option.text)}</div>`).join('')}</div></div><div class="q-meta"><span class="tag ${String(q.level || 'Medium').toLowerCase()}" title="${q.difficultyMissing ? 'Difficulty was missing from the import; provisionally set to Medium. Review recommended.' : q.difficultyEstimated ? 'Estimated difficulty; review recommended' : 'Difficulty from source'}">${escapeHTML(q.level || 'Medium')}</span><span class="source-tag">${escapeHTML(q.paper || '')}${q.year && q.year !== 'Demo' ? ` · ${escapeHTML(q.year)}` : ''}</span><span>${escapeHTML(q.type || '')}</span><span>${escapeHTML(q.marks || '')}</span></div></div><div class="question-row-actions"><button class="view-bank-question" data-view-question-id="${escapeHTML(q.id)}" aria-expanded="false">View</button><button class="edit-bank-question" data-edit-question-id="${escapeHTML(q.id)}">Edit</button><button class="add-button ${selected.has(q.id) ? 'added' : ''}" data-id="${escapeHTML(q.id)}" aria-label="${selected.has(q.id) ? 'Remove' : 'Add'} question">${selected.has(q.id) ? '✓' : '+'}</button><button class="delete-bank-question" data-delete-question-id="${escapeHTML(q.id)}" aria-label="Delete ${escapeHTML(q.name)} from question bank" title="Remove from this browser’s question bank">−</button></div></article>`).join('') : '<div class="empty-state"><strong>No questions in this chapter yet.</strong><span>Try another chapter or clear the filters.</span></div>';
  document.querySelector('#selected-count').textContent = selected.size;
  document.querySelector('#showing-count').textContent = `Showing ${visible.length} of ${matching.length} questions`;
  updateDifficultyCounts();
  renderCoachingPreview();
  list.querySelectorAll('.add-button').forEach(button => button.addEventListener('click', () => { const id = button.dataset.id; selected.has(id) ? selected.delete(id) : selected.add(id); render(); saveCurrentPaper(); toast(selected.has(id) ? 'Question added to your paper.' : 'Question removed from your paper.'); }));
  list.querySelectorAll('[data-view-question-id]').forEach(button => button.addEventListener('click', () => {
    const row = button.closest('.question-row');
    const full = row?.querySelector('.question-list-full');
    const compact = row?.querySelector('.question-list-prompt');
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(expanded));
    button.textContent = expanded ? 'Less' : 'View';
    full?.classList.toggle('hidden', !expanded);
    compact?.classList.toggle('hidden', expanded);
  }));
  list.querySelectorAll('[data-edit-question-id]').forEach(button => button.addEventListener('click', () => openBankQuestionEditor(button.dataset.editQuestionId)));
  list.querySelectorAll('[data-delete-question-id]').forEach(button => button.addEventListener('click', () => requestDeleteBankQuestion(button.dataset.deleteQuestionId)));
}
document.querySelectorAll('.difficulty').forEach(button => button.addEventListener('click', () => { document.querySelector('.difficulty.active')?.classList.remove('active'); button.classList.add('active'); activeLevel = button.dataset.level; render(); }));
document.querySelector('#subject-select').addEventListener('change', () => { activeChapter = 'All chapters'; render(); updateCoachingHeader(); });
document.querySelector('#type-filter').addEventListener('change', e => { activeType = e.target.value; render(); });
document.querySelector('#source-filter').addEventListener('change', e => { activeSource = e.target.value; render(); });
document.querySelector('#chapter-search').addEventListener('input', renderBankNavigation);
document.querySelectorAll('.bank-exam').forEach(button => button.addEventListener('click', () => {
  const exam = button.dataset.examFamily === 'NEET' ? 'NEET' : 'JEE Main';
  const examEl = document.querySelector('#exam-select');
  if (examEl) examEl.value = exam;
  const firstSubject = [...new Set(questions.filter(q => q.exam === exam && !deletedQuestionIds.includes(q.id)).map(q => q.subject))][0];
  const subjEl = document.querySelector('#subject-select');
  if (subjEl) subjEl.value = firstSubject || 'Physics';
  const customSubject = document.querySelector('#custom-q-subject');
  if (customSubject && [...customSubject.options].some(option => option.value === (firstSubject || 'Physics'))) customSubject.value = firstSubject || 'Physics';
  activeChapter = 'All chapters'; activeSource = 'All sources'; activeType = 'All types'; activeLevel = 'All';
  if (document.querySelector('#source-filter')) document.querySelector('#source-filter').value='All sources';
  if (document.querySelector('#type-filter')) document.querySelector('#type-filter').value='All types';
  updateCoachingHeader();render();
}));
document.querySelector('.filter-button').addEventListener('click', () => {
  const panel = document.querySelector('#more-filters-panel');
  const isOpen = panel.classList.toggle('hidden') === false;
  document.querySelector('.filter-button span').textContent = isOpen ? 'Hide filters' : 'More filters';
});
document.querySelector('#load-more').addEventListener('click', event => { showAll = !showAll; event.currentTarget.innerHTML = showAll ? 'Show fewer <span>↑</span>' : 'View all questions <span>→</span>'; render(); });
document.querySelectorAll('.mode-card').forEach(card => card.addEventListener('click', () => {
  startNewPaper(card.dataset.mode, 'details');
}));
const schoolSections = [
  { number: 'Section I', name: 'Objective questions', template: 'Multiple choice questions', marks: '1 mark each' },
  { number: 'Section II', name: 'Short answer questions', template: 'Question & answer', marks: '2 marks each' },
];
const templates = ['Multiple choice questions', 'Fill in the blanks', 'Unseen passage', 'Short answer', 'Long answer', 'Question & answer'];
function renderSchoolSections() {
  const host = document.querySelector('#school-sections');
  host.innerHTML = schoolSections.map((s, i) => `<div class="school-section-card"><div class="section-card-heading"><strong>SECTION ${String(i + 1).padStart(2, '0')}</strong><div class="section-reorder"><button class="remove-section" data-move-section="up" data-index="${i}" aria-label="Move section up" ${i===0?'disabled':''}>↑</button><button class="remove-section" data-move-section="down" data-index="${i}" aria-label="Move section down" ${i===schoolSections.length-1?'disabled':''}>↓</button><button class="delete-section" data-index="${i}" aria-label="Remove section">×</button></div></div><div class="section-fields"><label class="field"><span>Section number</span><input data-section="number" data-index="${i}" value="${escapeHTML(s.number)}" /></label><label class="field"><span>Section name</span><input data-section="name" data-index="${i}" value="${escapeHTML(s.name)}" /></label></div><label class="field"><span>Question template</span><div class="select-wrap"><select data-section="template" data-index="${i}">${templates.map(t => `<option ${s.template === t ? 'selected' : ''}>${escapeHTML(t)}</option>`).join('')}</select><span>⌄</span></div></label><label class="field"><span>Marks per question</span><input data-section="marks" data-index="${i}" value="${escapeHTML(s.marks)}" /></label></div>`).join('');
  host.querySelectorAll('[data-section]').forEach(input => {
    const updateSection = () => { schoolSections[Number(input.dataset.index)][input.dataset.section] = input.value; renderSchoolPreview(); saveCurrentPaper(); };
    input.addEventListener('input', updateSection);
    input.addEventListener('change', updateSection);
  });
  host.querySelectorAll('.delete-section').forEach(btn => btn.addEventListener('click', () => { schoolSections.splice(Number(btn.dataset.index), 1); renderSchoolSections(); renderSchoolPreview(); saveCurrentPaper(); }));
  host.querySelectorAll('[data-move-section]').forEach(btn => btn.addEventListener('click', () => { const from=Number(btn.dataset.index), to=from+(btn.dataset.moveSection==='up'?-1:1); if(to<0||to>=schoolSections.length)return; [schoolSections[from],schoolSections[to]]=[schoolSections[to],schoolSections[from]]; renderSchoolSections(); renderSchoolPreview(); saveCurrentPaper(); }));
  document.querySelector('#school-section-count').textContent = `${schoolSections.length} section${schoolSections.length === 1 ? '' : 's'}`;
}
function dateLabel(value) { if (!value) return 'Date'; const [y,m,d] = value.split('-'); return `${d}/${m}/${y.slice(-2)}`; }
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function exampleFor(section, index) {
  const number = index * 2 + 1;
  if (section.template === 'Fill in the blanks') return `<div class="school-example"><b>${number}.</b> Fill in the blanks:<br/>(i) Every prime number greater than 2 is ______.<br/>(ii) The sum of the angles of a triangle is ______.</div>`;
  if (section.template === 'Unseen passage') return `<div class="school-example"><b>Read the passage and answer the questions:</b><p>Mathematics helps us describe patterns in nature and solve everyday problems. Careful observation and logical reasoning lead us to clear solutions.</p><b>${number}.</b> What does mathematics help us describe?<br/><b>${number + 1}.</b> Which skills help us find solutions?</div>`;
  if (section.template === 'Short answer') return `<div class="school-example"><b>${number}.</b> Solve the pair of equations 2x + y = 7 and x − y = 2. Show your method.</div>`;
  if (section.template === 'Long answer') return `<div class="school-example"><b>${number}.</b> Prove the stated result, showing each step and a labelled diagram where appropriate.</div>`;
  if (section.template === 'Question & answer') return `<div class="school-example"><b>${number}.</b> Answer the following question:<br/>Explain the steps used to solve a pair of simultaneous linear equations.</div>`;
  return `<div class="school-example"><b>${number}.</b> Choose the correct answer:<br/>The HCF of 96 and 404 is:<div class="school-options">(a) 2 &nbsp; (b) 4 &nbsp; (c) 8 &nbsp; (d) 12</div><div class="school-or">OR</div><b>${number + 1}.</b> The decimal representation of 13/3125 terminates after how many decimal places?</div>`;
}
function renderSchoolPreview() {
  if (mode !== 'school') return;
  const get = selector => document.querySelector(selector).value;
  document.querySelector('#school-preview-name').textContent = get('#school-name') || 'School name';
  document.querySelector('#school-preview-address').textContent = get('#school-address');
  document.querySelector('#school-preview-exam').textContent = get('#school-exam');
  document.querySelector('#school-preview-class').textContent = get('#school-class').toUpperCase();
  document.querySelector('#school-preview-duration').textContent = `Time: ${get('#school-duration')}`;
  document.querySelector('#school-preview-subject').textContent = `Subject: ${get('#school-subject')}`;
  document.querySelector('#school-preview-marks').textContent = `F.M. ${get('#school-marks')}`;
  document.querySelector('#school-preview-date').textContent = `Date: ${dateLabel(get('#school-date'))}`;
  const instructionItems = get('#school-instructions').split(/\n+/).map(line => line.trim()).filter(Boolean);
  document.querySelector('#school-preview-instructions').innerHTML = instructionItems.map(line => `<li>${escapeHTML(line)}</li>`).join('');
  document.querySelector('#school-preview-sections').innerHTML = schoolSections.map((section, index) => `<section class="school-preview-section"><h3>${escapeHTML(section.number.toUpperCase())}</h3><p class="school-section-caption">Has ${section.template === 'Multiple choice questions' ? '6' : '5'} questions of ${escapeHTML(section.marks)}. Internal choice is provided where indicated.</p><div class="school-section-name">${escapeHTML(section.name)}</div>${exampleFor(section, index)}</section>`).join('');
}
document.querySelector('#add-section').addEventListener('click', () => { schoolSections.push({ number: `Section ${['I','II','III','IV','V'][schoolSections.length] || schoolSections.length + 1}`, name: 'New section', template: 'Question & answer', marks: '2 marks each' }); renderSchoolSections(); renderSchoolPreview(); saveCurrentPaper(); });
renderSchoolSections();
const bindPreview = (selector, callback) => document.querySelector(selector).addEventListener('input', callback);
['#school-name','#school-address','#school-class','#school-subject','#school-date','#school-exam','#school-duration','#school-marks','#school-instructions'].forEach(s => bindPreview(s, renderSchoolPreview));
bindPreview('#paper-name', () => { if (mode === 'coaching') document.querySelector('#preview-paper-title').textContent = document.querySelector('#paper-name').value; });
bindPreview('#coaching-date', () => document.querySelector('#preview-date').textContent = dateLabel(document.querySelector('#coaching-date').value));
bindPreview('#coaching-address', () => {
  const address = document.querySelector('#preview-address');
  address.textContent = document.querySelector('#coaching-address').value.trim();
  address.classList.toggle('hidden', !address.textContent);
});
bindPreview('#syllabus', () => document.querySelector('#preview-syllabus').innerHTML = `Topics Covered<br/>${document.querySelector('#syllabus').value.replaceAll('\n','<br/>')}`);
bindPreview('#coaching-instructions', () => { if (mode === 'coaching') document.querySelector('#preview-instructions').textContent = document.querySelector('#coaching-instructions').value; });
function applyCoachingPreviewSettings(persist = true) {
  const paper = document.querySelector('#paper-preview');
  const content = document.querySelector('#coaching-preview-content');
  const font = document.querySelector('#preview-paper-font').value;
  const border = document.querySelector('#preview-page-border').value;
  const questionFontSize = Number(document.querySelector('#preview-question-font-size').value);
  const optionFontSize = Number(document.querySelector('#preview-option-font-size').value);
  const sectionSpacing = document.querySelector('#preview-section-spacing').value;
  const questionSpacing = document.querySelector('#preview-question-spacing').value;
  const numberWidth = document.querySelector('#preview-number-width').value;
  document.querySelector('#paper-font').value = font;
  content.style.fontFamily = font;
  paper.style.setProperty('--paper-question-font', `${questionFontSize}pt`);
  paper.style.setProperty('--paper-question-font-screen', `${(questionFontSize * 2 / 3).toFixed(2)}px`);
  paper.style.setProperty('--paper-option-font', `${optionFontSize}pt`);
  paper.style.setProperty('--paper-option-font-screen', `${(optionFontSize * 2 / 3).toFixed(2)}px`);
  paper.classList.toggle('page-border-thin', border === 'thin');
  paper.classList.toggle('page-border-double', border === 'double');
  paper.style.setProperty('--paper-section-spacing', `${sectionSpacing}px`);
  paper.style.setProperty('--paper-question-spacing', `${questionSpacing}px`);
  paper.style.setProperty('--paper-number-width', `${numberWidth}px`);
  document.querySelector('#preview-section-spacing-output').value = `${sectionSpacing} px`;
  document.querySelector('#preview-question-spacing-output').value = `${questionSpacing} px`;
  document.querySelector('#preview-number-width-output').value = `${numberWidth} px`;
  document.querySelector('#preview-question-font-output').value = `${questionFontSize} pt`;
  document.querySelector('#preview-option-font-output').value = `${optionFontSize} pt`;
  document.querySelector('#preview-section-spacing-output').textContent = `${sectionSpacing} px`;
  document.querySelector('#preview-question-spacing-output').textContent = `${questionSpacing} px`;
  document.querySelector('#preview-number-width-output').textContent = `${numberWidth} px`;
  document.querySelector('#preview-question-font-output').textContent = `${questionFontSize} pt`;
  document.querySelector('#preview-option-font-output').textContent = `${optionFontSize} pt`;
  content.dataset.optionLines = document.querySelector('#preview-option-lines').value;
  renderCoachingPreview();
  if (persist && mode === 'coaching') saveCurrentPaper();
}

document.querySelector('#paper-font').addEventListener('input', () => {
  document.querySelector('#preview-paper-font').value = document.querySelector('#paper-font').value;
  applyCoachingPreviewSettings(false);
});
document.querySelector('#paper-font').addEventListener('change', () => {
  document.querySelector('#preview-paper-font').value = document.querySelector('#paper-font').value;
  applyCoachingPreviewSettings();
});
document.querySelector('#preview-paper-font').addEventListener('change', () => applyCoachingPreviewSettings());
document.querySelector('#preview-page-border').addEventListener('change', () => applyCoachingPreviewSettings());
document.querySelector('#preview-option-lines').addEventListener('change', () => applyCoachingPreviewSettings());
['#preview-question-font-size', '#preview-option-font-size', '#preview-section-spacing', '#preview-question-spacing', '#preview-number-width'].forEach(selector => {
  const control = document.querySelector(selector);
  control.addEventListener('input', () => applyCoachingPreviewSettings(false));
  control.addEventListener('change', () => applyCoachingPreviewSettings());
});
applyCoachingPreviewSettings(false);
bindPreview('#logo-size', () => { const size=`${document.querySelector('#logo-size').value}px`; document.querySelector('#preview-logo').style.width=size; document.querySelector('#school-preview-logo').style.width=size; document.querySelector('#logo-size-output').textContent = `${document.querySelector('#logo-size').value} px`; });
document.querySelector('#logo-position').addEventListener('change', e => { const image = document.querySelector('#preview-logo'); image.style.marginLeft = e.target.value === 'left' ? '0' : e.target.value === 'right' ? 'auto' : 'auto'; image.style.marginRight = e.target.value === 'right' ? '0' : 'auto'; document.querySelector('#logo-placeholder').style.marginLeft = e.target.value === 'left' ? '0' : e.target.value === 'right' ? 'auto' : 'auto'; document.querySelector('#logo-placeholder').style.marginRight = e.target.value === 'right' ? '0' : 'auto'; document.querySelector('.paper-school-head').style.textAlign = e.target.value; });
let currentLogoUrl = null;
function showLogoFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Choose an image file for your logo.'); return; }
  if (file.size > 5 * 1024 * 1024) { toast('Choose a logo smaller than 5 MB.'); return; }
  if (currentLogoUrl) URL.revokeObjectURL(currentLogoUrl);
  currentLogoUrl = URL.createObjectURL(file);
  ['#preview-logo','#school-preview-logo'].forEach(selector => { const img=document.querySelector(selector); if(img){img.src=currentLogoUrl;img.classList.remove('hidden');} });
  document.querySelector('#logo-placeholder').classList.add('hidden');
  document.querySelector('#preview-school').classList.add('hidden');
  toast('Logo added to the live preview.');
}
document.querySelector('#logo-upload').addEventListener('change', e => showLogoFile(e.target.files[0]));
document.querySelector('#school-logo-upload').addEventListener('change', e => showLogoFile(e.target.files[0]));
document.querySelectorAll('.logo-dropzone').forEach(zone => {
  zone.addEventListener('dragover', event => { event.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', event => { event.preventDefault(); zone.classList.remove('dragover'); showLogoFile(event.dataTransfer.files[0]); });
});
document.querySelector('#sections-toggle').addEventListener('click', e => { const on = e.currentTarget.classList.toggle('on'); e.currentTarget.setAttribute('aria-pressed', on); document.querySelector('#preview-section-title').classList.toggle('hidden', !on); document.querySelector('#sections-label').textContent = on ? 'Use subject sections' : 'Single continuous paper'; });
document.querySelectorAll('.layout-option').forEach(button => button.addEventListener('click', () => { document.querySelector('.layout-option.active')?.classList.remove('active'); button.classList.add('active'); document.querySelector('#paper-preview').classList.toggle('column-layout', button.dataset.layout === 'columns'); }));
function updateCoachingHeader() {
  const subject = document.querySelector('#coaching-subject-heading')?.value?.trim() || 'Subject';
  const exam = document.querySelector('#exam-select')?.value || 'JEE Main';
  const subEl = document.querySelector('#preview-school-sub');
  if (subEl) subEl.textContent = `${subject.toUpperCase()}  ·  ${exam.toUpperCase()}`;
  const titleEl = document.querySelector('#preview-section-title');
  if (titleEl) titleEl.textContent = subject.toUpperCase();
  const addressEl = document.querySelector('#preview-address');
  if (addressEl) {
    addressEl.textContent = document.querySelector('#coaching-address')?.value?.trim() || '';
    addressEl.classList.toggle('hidden', !addressEl.textContent);
  }
}
document.querySelector('#coaching-subject-heading').addEventListener('input', updateCoachingHeader);
updateCoachingHeader();
let toastTimer;
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2400); }
document.querySelector('#continue-button').addEventListener('click', () => setCoachingTab('preview'));
document.querySelector('#new-paper').addEventListener('click', () => { startNewPaper('coaching'); });
document.querySelector('#create-paper-from-list').addEventListener('click', () => { startNewPaper('coaching'); });
const sidebar = document.querySelector('#studio-sidebar');
const sidebarToggle = document.querySelector('.mobile-menu');
const sidebarBackdrop = document.querySelector('#sidebar-backdrop');
function setSidebarOpen(open) {
  const wasOpen = sidebar?.classList.contains('open');
  sidebar?.classList.toggle('open', open);
  if (sidebar) sidebar.inert = !open;
  sidebarToggle?.setAttribute('aria-expanded', String(open));
  sidebarToggle?.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  sidebarBackdrop?.classList.toggle('hidden', !open);
  document.body.classList.toggle('sidebar-open', open);
  if (!open && wasOpen && sidebar?.contains(document.activeElement)) sidebarToggle?.focus();
}
setSidebarOpen(false);
sidebarToggle?.addEventListener('click', () => setSidebarOpen(!sidebar?.classList.contains('open')));
sidebarBackdrop?.addEventListener('click', () => setSidebarOpen(false));
document.querySelectorAll('.sidebar .nav-item').forEach(link => link.addEventListener('click', () => setSidebarOpen(false)));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && sidebar?.classList.contains('open')) setSidebarOpen(false); });
document.querySelector('#back-to-studio').addEventListener('click', () => { location.hash = 'studio'; });
document.querySelector('#preview-zoom').addEventListener('click', () => document.querySelector('#paper-preview').classList.toggle('zoomed'));
document.querySelector('#preview-expand').addEventListener('click', event => {
  const expanded = document.querySelector('.preview-column').classList.toggle('expanded');
  event.currentTarget.setAttribute('aria-pressed', String(expanded));
  event.currentTarget.setAttribute('aria-label', expanded ? 'Close expanded preview' : 'Expand preview');
});
document.querySelector('#print-paper').addEventListener('click', () => window.print());
render();

const papersStorageKey = 'papercraft-local-papers-v1';
const activePaperStorageKey = 'papercraft-active-paper-v1';
const demoPapers = [
  {id:'demo-paper-1',title:'JEE Main · Weekly Practice 04',kind:'Coaching',exam:'JEE Main',questions:24,updated:'2026-10-04',status:'Ready'},
  {id:'demo-paper-2',title:'Class X · Mathematics Pre-board',kind:'School',exam:'School examination',questions:32,updated:'2026-10-02',status:'Draft'},
  {id:'demo-paper-3',title:'NEET Biology · Cell & Genetics',kind:'Coaching',exam:'NEET',questions:18,updated:'2026-09-28',status:'Draft'},
];
function getSavedPapers() {
  try {
    const saved = JSON.parse(localStorage.getItem(papersStorageKey));
    if (Array.isArray(saved)) return saved;
  } catch (error) { console.warn('Saved papers could not be read.', error); }
  localStorage.setItem(papersStorageKey, JSON.stringify(demoPapers));
  return [...demoPapers];
}
let savedPapers = getSavedPapers();
let paperKindFilter = 'All';
let paperView = 'grid';
let pendingDeleteId = null;
let pendingDeleteQuestionId = null;
function savePapers() {
  try {
    localStorage.setItem(papersStorageKey, JSON.stringify(savedPapers));
  } catch (error) {
    console.error('PaperCraft could not save papers to this browser.', error);
    const indicator = document.querySelector('#autosave-status');
    if (indicator) indicator.innerHTML = '<i></i> Save failed';
    indicator?.classList.add('save-error');
    toast('Paper could not be saved in this browser. Check available storage and try again.');
    return false;
  }
  const indicator=document.querySelector('#autosave-status'); if(indicator)indicator.innerHTML='<i></i> Saved locally';
  indicator?.classList.remove('save-error');
  document.querySelector('#autosave-status')?.classList.add('just-saved');
  setTimeout(() => document.querySelector('#autosave-status')?.classList.remove('just-saved'), 900);
  renderRecentPapers();
  renderMyPapers();
  return true;
}
function paperTitle() { return mode === 'school' ? document.querySelector('#school-exam').value.trim() : document.querySelector('#paper-name').value.trim(); }
function saveCurrentPaper() {
  const title = paperTitle() || (mode === 'school' ? 'Untitled school paper' : 'Untitled coaching paper');
  let paper = savedPapers.find(item => item.id === window.activePaperId);
  if (!paper) {
    paper = { id: `paper-${Date.now()}`, title, kind: mode === 'school' ? 'School' : 'Coaching', exam: mode === 'school' ? 'School examination' : (document.querySelector('#exam-select')?.value || 'JEE Main'), questions: selected.size, updated: new Date().toISOString(), status: 'Draft' };
    savedPapers.unshift(paper); window.activePaperId = paper.id;
  }
  try { localStorage.setItem(activePaperStorageKey, paper.id); } catch (error) { console.warn('Active paper could not be remembered.', error); }
  paper.title = title;
  paper.kind = mode === 'school' ? 'School' : 'Coaching';
  paper.exam = mode === 'school' ? 'School examination' : (document.querySelector('#exam-select')?.value || 'JEE Main');
  paper.questions = selected.size;
  paper.selectedQuestions = [...selected];
  paper.selectedMarks = Object.fromEntries(selectedMarks);
  paper.sections = mode === 'school' ? structuredClone(schoolSections) : undefined;
  paper.form = Object.fromEntries([...document.querySelectorAll('#coaching-settings input:not([type=file]),#coaching-settings select,#coaching-settings textarea,#coaching-preview-controls input,#coaching-preview-controls select,#school-settings input:not([type=file]),#school-settings select,#school-settings textarea')].filter(field => field.id).map(field => [field.id, field.value]));
  paper.updated = new Date().toISOString();
  paper.status = 'Draft';
  return savePapers();
}
function restoreSavedPaper(paper) {
  if (!paper) return;
  mode = paper.kind === 'School' ? 'school' : 'coaching';
  window.activePaperId = paper.id;
  try { localStorage.setItem(activePaperStorageKey, paper.id); } catch (error) { console.warn('Active paper could not be remembered.', error); }
  selected.clear(); (paper.selectedQuestions || []).forEach(id => selected.add(id));
  selectedMarks.clear(); Object.entries(paper.selectedMarks || {}).forEach(([id,value]) => selectedMarks.set(id,Number(value)));
  if (mode === 'school' && Array.isArray(paper.sections)) {
    schoolSections.splice(0, schoolSections.length, ...structuredClone(paper.sections));
    renderSchoolSections();
  }
  Object.entries(paper.form || {}).forEach(([id,value]) => {
    const field = document.getElementById(id);
    if (field && field.type !== 'file') field.value = value;
  });
  applyCoachingPreviewSettings(false);
  if (mode === 'school') document.querySelector('#school-exam').value = paper.title;
  else {
    document.querySelector('#paper-name').value = paper.title;
    if (['JEE Main','JEE Advanced','NEET'].includes(paper.exam) && document.querySelector('#exam-select')) document.querySelector('#exam-select').value = paper.exam;
  }
  document.querySelector('#paper-preview').classList.toggle('school-preview', mode === 'school');
  document.querySelector('#coaching-preview-content').classList.toggle('hidden', mode === 'school');
  document.querySelector('#school-preview-content').classList.toggle('hidden', mode !== 'school');
  activeWorkflowTab = 'details'; activeSchoolStep = 'details';
  location.hash = mode;
  navigateView();
  if (mode === 'school') renderSchoolPreview();
  else { updateCoachingHeader(); render(); }
}
function paperCardMarkup(paper, compact = false) {
  const date = new Date(paper.updated).toLocaleDateString(undefined, {month:'short',day:'numeric'});
  return `<article class="saved-paper ${compact ? 'compact' : ''}"><button class="paper-card-open" data-paper-action="open" data-id="${escapeHTML(paper.id)}" aria-label="Open ${escapeHTML(paper.title)}"><span class="paper-thumb"><span class="thumb-topline"></span><span class="thumb-heading">${escapeHTML(paper.title.slice(0,22))}</span><span class="thumb-lines"></span><span class="thumb-lines short"></span><span class="thumb-choice">◯ &nbsp; ◯ &nbsp; ◯ &nbsp; ◯</span><span class="thumb-lines"></span></span><span class="paper-card-meta"><span class="paper-kind ${paper.kind.toLowerCase()}">${escapeHTML(paper.kind)}</span><span class="paper-status">${escapeHTML(paper.status || 'Draft')}</span></span><strong>${escapeHTML(paper.title)}</strong><span class="paper-card-detail">${date} · ${Number(paper.questions)||0} questions</span></button><div class="paper-actions"><button data-paper-action="open" data-id="${escapeHTML(paper.id)}">Open</button><button data-paper-action="duplicate" data-id="${escapeHTML(paper.id)}">Duplicate</button><button data-paper-action="download" data-id="${escapeHTML(paper.id)}">Download PDF</button><button data-paper-action="delete" data-id="${escapeHTML(paper.id)}" aria-label="Delete ${escapeHTML(paper.title)}">Delete</button></div></article>`;
}
function renderRecentPapers() {
  const host = document.querySelector('#recent-papers');
  if (!host) return;
  const recent = [...savedPapers].sort((a,b) => new Date(b.updated) - new Date(a.updated)).slice(0,3);
  host.innerHTML = recent.length ? recent.map(paper => paperCardMarkup(paper, true)).join('') : '<div class="recent-empty">Your next paper can start with either format above.</div>';
  bindPaperActions(host);
}
function renderMyPapers() {
  const host = document.querySelector('#papers-grid');
  if (!host) return;
  const query = document.querySelector('#papers-search').value.trim().toLowerCase();
  let results = savedPapers.filter(p => (paperKindFilter === 'All' || p.kind === paperKindFilter) && p.title.toLowerCase().includes(query));
  const sort = document.querySelector('#papers-sort').value;
  results.sort(sort === 'name' ? (a,b) => a.title.localeCompare(b.title) : (a,b) => sort === 'oldest' ? new Date(a.updated)-new Date(b.updated) : new Date(b.updated)-new Date(a.updated));
  host.classList.toggle('list-view', paperView === 'list');
  host.innerHTML = results.length ? results.map(p => paperCardMarkup(p)).join('') : '<div class="papers-empty"><span>▤</span><h2>No papers found</h2><p>Try another filter, or start a new paper from your workspace.</p><button class="primary-button" data-create-from-empty>＋ New paper</button></div>';
  bindPaperActions(host);
  host.querySelector('[data-create-from-empty]')?.addEventListener('click', () => startNewPaper('coaching'));
}
function bindPaperActions(host) {
  host.querySelectorAll('[data-paper-action]').forEach(button => button.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation();
    const paper = savedPapers.find(item => item.id === button.dataset.id);
    if (!paper) return;
    const action = button.dataset.paperAction;
    if (action === 'open') {
      restoreSavedPaper(paper);
    } else if (action === 'duplicate') {
      savedPapers.unshift({...paper,id:`paper-${Date.now()}`,title:`${paper.title} (copy)`,updated:new Date().toISOString(),status:'Draft'});
      savePapers(); toast('Paper duplicated.');
    } else if (action === 'download') {
      window.activePaperId = paper.id; mode = paper.kind === 'School' ? 'school' : 'coaching';
      selected.clear(); (paper.selectedQuestions || []).forEach(id => selected.add(id));
      selectedMarks.clear(); Object.entries(paper.selectedMarks || {}).forEach(([id,value]) => selectedMarks.set(id,Number(value)));
      Object.entries(paper.form || {}).forEach(([id,value]) => { const field=document.getElementById(id); if(field && field.type !== 'file') field.value=value; });
      applyCoachingPreviewSettings(false);
      if (mode === 'school' && Array.isArray(paper.sections)) { schoolSections.splice(0, schoolSections.length, ...structuredClone(paper.sections)); renderSchoolSections(); }
      if(mode==='school')document.querySelector('#school-exam').value=paper.title;else{document.querySelector('#paper-name').value=paper.title;if(['JEE Main','JEE Advanced','NEET'].includes(paper.exam)&&document.querySelector('#exam-select'))document.querySelector('#exam-select').value=paper.exam;}
      document.querySelector('#paper-preview').classList.toggle('school-preview', mode === 'school');
      document.querySelector('#coaching-preview-content').classList.toggle('hidden', mode === 'school');
      document.querySelector('#school-preview-content').classList.toggle('hidden', mode !== 'school');
      location.hash = mode; navigateView(); if(mode==='school')renderSchoolPreview();else{updateCoachingHeader();render();} setTimeout(() => window.print(), 100);
    } else if (action === 'delete') {
      pendingDeleteId = paper.id; document.querySelector('#delete-confirm').classList.remove('hidden'); document.querySelector('#confirm-delete').focus();
    }
  }));
}
function startNewPaper(nextMode, startTab = 'details') {
  mode = nextMode; window.activePaperId = null; selected.clear(); selectedMarks.clear();
  if (nextMode === 'school') document.querySelector('#school-exam').value = 'Pre-Board Examination 2026-27';
  else document.querySelector('#paper-name').value = 'Untitled paper';
  activeWorkflowTab = nextMode === 'coaching' ? startTab : 'details'; activeSchoolStep = 'details';
  document.querySelectorAll('.mode-card').forEach(card => { const active = card.dataset.mode === nextMode; card.classList.toggle('selected',active); card.setAttribute('aria-pressed',String(active)); });
  document.querySelector('#paper-preview').classList.toggle('school-preview', nextMode === 'school');
  document.querySelector('#coaching-preview-content').classList.toggle('hidden', nextMode === 'school');
  document.querySelector('#school-preview-content').classList.toggle('hidden', nextMode !== 'school');
  const route = nextMode === 'coaching' && activeWorkflowTab === 'questions' ? 'bank' : nextMode;
  location.hash = route; navigateView();
  if (nextMode === 'school') renderSchoolPreview(); else { updateCoachingHeader(); render(); }
  saveCurrentPaper();
}
document.querySelector('#save-paper-button')?.addEventListener('click', () => {
  clearTimeout(autosaveTimer);
  if (saveCurrentPaper()) toast('Paper saved in this browser. You can reopen it from My papers.');
});
document.querySelectorAll('[data-coaching-tab]').forEach((button,index) => button.addEventListener('click', () => setCoachingTab(button.dataset.coachingTab,index)));
function setCoachingTab(tab,index = ['details','questions','preview'].indexOf(tab)) {
  activeWorkflowTab = tab;
  document.querySelector('#coaching-tabs').dataset.step = index;
  document.querySelectorAll('#coaching-tabs .workflow-tab').forEach((button,i) => { const active = button.dataset.coachingTab === tab; button.classList.toggle('active',active); button.setAttribute('aria-selected',String(active)); });
  document.querySelector('#coaching-tabs').dataset.step = index;
  if (location.hash !== '#coaching' && location.hash !== '#bank') location.hash = tab === 'questions' ? 'bank' : 'coaching';
  else if (tab === 'questions' && location.hash !== '#bank') location.hash = 'bank';
  else if (tab !== 'questions' && location.hash === '#bank') location.hash = 'coaching';
  navigateView();
}
document.querySelectorAll('[data-school-tab]').forEach(button => button.addEventListener('click', () => {
  setSchoolStep(button.dataset.schoolTab);
}));
function setSchoolStep(step) {
  if (!['details', 'sections', 'preview'].includes(step)) return;
  mode = 'school';
  activeSchoolStep = step;
  activeWorkflowTab = 'details';
  const index = ['details', 'sections', 'preview'].indexOf(step);
  document.querySelectorAll('#school-tabs .workflow-tab').forEach(button => {
    const active = button.dataset.schoolTab === step;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.querySelector('#school-tabs').dataset.step = index;
  location.hash = 'school';
  navigateView();
  if (step === 'sections') renderSchoolSections();
  renderSchoolPreview();
}
document.querySelector('#school-continue-sections')?.addEventListener('click', () => setSchoolStep('sections'));
document.querySelector('#school-preview-paper')?.addEventListener('click', () => setSchoolStep('preview'));
document.querySelector('#school-back-details')?.addEventListener('click', () => setSchoolStep('details'));
document.querySelector('#papers-search').addEventListener('input', renderMyPapers);
document.querySelector('#papers-sort').addEventListener('change', renderMyPapers);

const customModal = document.querySelector('#custom-question-modal');
const openCustomBtn = document.querySelector('#open-custom-q-trigger');
const closeCustomBtn = document.querySelector('#close-custom-q-modal');
const cancelCustomBtn = document.querySelector('#cancel-custom-q');
const customForm = document.querySelector('#custom-question-form');
const manualQuestionEditor = document.querySelector('#manual-question-editor');
const bankBrowserPanel = document.querySelector('#bank-browser-panel');
const openQuestionBankBtn = document.querySelector('#open-question-bank');
const customQuestionType = document.querySelector('#custom-q-type');
const customOptionsGroup = document.querySelector('#custom-options-group');
const customOptionInputs = ['#custom-opt-a', '#custom-opt-b', '#custom-opt-c', '#custom-opt-d'].map(selector => document.querySelector(selector));
const customQuestionImageInput = document.querySelector('#custom-question-image-file');
const customQuestionImageButton = document.querySelector('#add-custom-question-image');
const removeCustomQuestionImageButton = document.querySelector('#remove-custom-question-image');
const customQuestionImageStatus = document.querySelector('#custom-question-image-status');
let editingBankQuestionId = null;

function optimizeQuestionImage(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) { reject(new Error('Choose an image file.')); return; }
    if (file.size > 12 * 1024 * 1024) { reject(new Error('Choose an image smaller than 12 MB.')); return; }
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) { reject(new Error('Could not process this image.')); return; }
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
      if (dataUrl.length > 900_000) { reject(new Error('This image is still too large after compression. Try a smaller image.')); return; }
      resolve(dataUrl);
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('This image could not be opened.')); };
    image.src = objectUrl;
  });
}

customQuestionImageButton?.addEventListener('click', () => customQuestionImageInput?.click());
customQuestionImageInput?.addEventListener('change', async () => {
  const file = customQuestionImageInput.files?.[0];
  const editor = document.querySelector('#custom-q-text');
  if (!file || !editor) return;
  customQuestionImageStatus.textContent = 'Preparing image…';
  try {
    const dataUrl = await optimizeQuestionImage(file);
    editor.querySelector('[data-uploaded-question-image]')?.remove();
    const imageBlock = document.createElement('div');
    imageBlock.className = 'custom-question-image';
    imageBlock.dataset.uploadedQuestionImage = 'true';
    imageBlock.contentEditable = 'false';
    const image = document.createElement('img');
    image.src = dataUrl;
    image.alt = 'Question illustration';
    imageBlock.append(image);
    editor.append(imageBlock);
    removeCustomQuestionImageButton?.classList.remove('hidden');
    customQuestionImageStatus.textContent = `${file.name} added below the question.`;
  } catch (error) {
    customQuestionImageStatus.textContent = error.message || 'Could not add this image.';
  } finally {
    customQuestionImageInput.value = '';
  }
});
removeCustomQuestionImageButton?.addEventListener('click', () => {
  document.querySelectorAll('#custom-q-text img').forEach(image => image.closest('.custom-question-image')?.remove() || image.remove());
  removeCustomQuestionImageButton.classList.add('hidden');
  if (customQuestionImageStatus) customQuestionImageStatus.textContent = 'Image removed.';
});

const richQuestionTags = new Set(('p br div span b strong i em u s sub sup small big mark code pre blockquote ul ol li table thead tbody tfoot tr td th hr img math semantics annotation mi mn mo mtext mrow msup msub msubsup mfrac msqrt mroot mfenced mtable mtr mtd mover munder munderover menclose mspace svg g path use defs symbol title desc rect circle ellipse line polyline polygon text tspan').split(' '));
const richQuestionAttributes = new Set(('class title alt width height colspan rowspan mathvariant display stretchy accent accentunder fence separator form scriptlevel dir mathsize mathcolor lspace rspace voffset notation encoding xmlns xmlns:xlink viewBox preserveAspectRatio focusable role jax d fill fill-rule stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset transform x y x1 y1 x2 y2 cx cy r rx ry points opacity text-anchor textLength lengthAdjust href xlink:href src').split(' ').map(name => name.toLowerCase()));
const safeInlineStyles = new Set(['color','background-color','font-size','font-weight','font-style','text-decoration','text-align','vertical-align','white-space','width','height','max-width','max-height','display','margin','padding','border','border-radius']);

function sanitizeRichQuestionHtml(html) {
  const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const blockedTags = new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','FORM','INPUT','BUTTON','VIDEO','AUDIO','LINK','META']);
  const visit = parent => {
    [...parent.children].forEach(node => {
      if (blockedTags.has(node.tagName)) { node.remove(); return; }
      if (!richQuestionTags.has(node.tagName.toLowerCase()) && !node.tagName.toLowerCase().startsWith('mjx-')) {
        visit(node);
        node.replaceWith(...node.childNodes); return;
      }
      [...node.attributes].forEach(attribute => {
        const name = attribute.name;
        const value = attribute.value.trim();
        if (name.toLowerCase().startsWith('on') || name === 'srcset') { node.removeAttribute(name); return; }
        if (name === 'style') {
          const safe = [...node.style].filter(property => safeInlineStyles.has(property) && !/url\s*\(|expression|javascript/i.test(node.style.getPropertyValue(property))).map(property => `${property}:${node.style.getPropertyValue(property)}`).join(';');
          if (safe) node.setAttribute('style', safe); else node.removeAttribute('style');
          return;
        }
        const normalizedName = name.toLowerCase();
        if (!richQuestionAttributes.has(normalizedName) && !normalizedName.startsWith('aria-') && !normalizedName.startsWith('data-')) { node.removeAttribute(name); return; }
        if ((normalizedName === 'href' || normalizedName === 'xlink:href') && !value.startsWith('#') && !/^https?:\/\//i.test(value)) { node.removeAttribute(name); return; }
        if (normalizedName === 'src' && !/^https?:\/\//i.test(value) && !/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(value)) node.removeAttribute(name);
      });
      visit(node);
    });
  };
  visit(parsed.body);
  return parsed.body.innerHTML;
}

function questionHtmlToText(html) {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  return (holder.innerText || holder.textContent || '').replace(/\u00a0/g, ' ').trim();
}

function richEditorHasContent(editor, html) {
  if (questionHtmlToText(html)) return true;
  return Boolean(editor?.querySelector('math-field,mjx-container,math,svg use,img'));
}

function insertRichClipboard(event) {
  const html = event.clipboardData?.getData('text/html');
  const editor = event.currentTarget;
  if (!html) { setTimeout(() => scheduleMathFieldConversion(editor), 0); return; }
  event.preventDefault();
  const template = document.createElement('template');
  template.innerHTML = sanitizeRichQuestionHtml(html);
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (!range || !editor.contains(range.commonAncestorContainer)) {
    editor.append(template.content);
    scheduleMathFieldConversion(editor);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  range.deleteContents();
  const lastInsertedNode = template.content.lastChild;
  range.insertNode(template.content);
  if (lastInsertedNode) { range.setStartAfter(lastInsertedNode); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); }
  scheduleMathFieldConversion(editor);
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}

document.querySelectorAll('.math-rich-editor').forEach(editor => editor.addEventListener('paste', insertRichClipboard));

function convertDelimitedMathToFields(editor) {
  if (!editor || !customElements.get('math-field')) return;
  const delimiterPattern = /\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$\$[\s\S]+?\$\$|\$(?:\\.|[^$\n])+\$/g;
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement?.closest('math-field') && delimiterPattern.test(node.nodeValue)) {
      delimiterPattern.lastIndex = 0;
      textNodes.push(node);
    }
    delimiterPattern.lastIndex = 0;
  }
  textNodes.forEach(node => {
    const source = node.nodeValue;
    const fragment = document.createDocumentFragment();
    let offset = 0;
    for (const match of source.matchAll(delimiterPattern)) {
      const token = match[0];
      let latex, display = false;
      if (token.startsWith('\\[') && token.endsWith('\\]')) { latex = token.slice(2, -2); display = true; }
      else if (token.startsWith('\\(') && token.endsWith('\\)')) latex = token.slice(2, -2);
      else if (token.startsWith('$$') && token.endsWith('$$')) { latex = token.slice(2, -2); display = true; }
      else latex = token.slice(1, -1);
      if (token.startsWith('$') && !token.startsWith('$$') && !/[\\_^{}=+*/]|^\s*[A-Za-z0-9]\s*$/.test(latex)) continue;
      fragment.append(document.createTextNode(source.slice(offset, match.index)));
      const field = document.createElement('math-field');
      field.setAttribute('aria-label', 'Editable mathematical expression');
      field.dataset.displayMath = String(display);
      field.value = latex.trim();
      fragment.append(field);
      offset = match.index + token.length;
    }
    if (offset) { fragment.append(document.createTextNode(source.slice(offset))); node.replaceWith(fragment); }
  });
}

function scheduleMathFieldConversion(editor) {
  if (customElements.get('math-field')) { convertDelimitedMathToFields(editor); return; }
  const loader = document.querySelector('#MathLive-script');
  if (loader && !loader.dataset.paperCraftConversionPending) {
    loader.dataset.paperCraftConversionPending = 'true';
    loader.addEventListener('load', () => document.querySelectorAll('.math-rich-editor').forEach(convertDelimitedMathToFields), { once: true });
  }
}

function serializeMathEditor(editor) {
  const clone = editor.cloneNode(true);
  const sourceFields = [...editor.querySelectorAll('math-field')];
  [...clone.querySelectorAll('math-field')].forEach((field, index) => {
    const source = sourceFields[index];
    const latex = source?.value || source?.textContent || field.textContent || '';
    const delimiters = source?.dataset.displayMath === 'true' ? ['\\[', '\\]'] : ['\\(', '\\)'];
    field.replaceWith(document.createTextNode(`${delimiters[0]}${latex}${delimiters[1]}`));
  });
  return clone.innerHTML;
}

function readMathEditorText(editor) {
  const holder = document.createElement('div');
  holder.innerHTML = serializeMathEditor(editor);
  const blocks = new Set(['ADDRESS','ARTICLE','BLOCKQUOTE','DIV','LI','OL','P','PRE','SECTION','TR','UL']);
  let text = '';
  const newline = () => { if (text && !text.endsWith('\n')) text += '\n'; };
  const walk = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.nodeValue || '';
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const isBlock = blocks.has(node.tagName);
    if (isBlock) newline();
    if (node.tagName === 'BR') text += '\n';
    else [...node.childNodes].forEach(walk);
    if (isBlock) newline();
  };
  [...holder.childNodes].forEach(walk);
  return text.replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function splitCombinedQuestionAndOptions() {
  const questionEditor = document.querySelector('#custom-q-text');
  if (!questionEditor || customQuestionType?.value === 'short') return false;
  const lines = readMathEditorText(questionEditor).replace(/\r/g, '').split('\n');
  const marker = /^\s*(?:(?:[•●▪◦*\-]\s*)|(?:\d+[.)]\s*))?(?:\(([A-D])\)|([A-D])[.):])\s*(.*)$/i;
  const firstChoice = lines.findIndex(line => marker.test(line));
  if (firstChoice < 1) return false;

  const questionText = lines.slice(0, firstChoice).join('\n').trim();
  if (!questionText) return false;
  const choices = new Map();
  let activeChoice = '';
  for (const line of lines.slice(firstChoice)) {
    const match = line.match(marker);
    if (match) {
      activeChoice = (match[1] || match[2]).toUpperCase();
      if (choices.has(activeChoice)) return false;
      choices.set(activeChoice, (match[3] || '').trim());
    } else if (activeChoice) {
      const continuation = line.trim();
      if (continuation) choices.set(activeChoice, `${choices.get(activeChoice)} ${continuation}`.trim());
    }
  }
  const labels = [...choices.keys()];
  if (labels.length < 2 || labels[0] !== 'A' || labels.some((label, index) => 'ABCD'.indexOf(label) !== index) || [...choices.values()].some(value => !value)) return false;

  questionEditor.textContent = questionText;
  scheduleMathFieldConversion(questionEditor);
  ['A','B','C','D'].forEach((label, index) => {
    const optionEditor = customOptionInputs[index];
    if (optionEditor) {
      optionEditor.textContent = choices.get(label) || '';
      scheduleMathFieldConversion(optionEditor);
    }
  });
  toast(`Moved ${choices.size} choices into the options fields.`);
  return true;
}

let customSplitTimer;
document.querySelector('#custom-q-text')?.addEventListener('input', () => {
  clearTimeout(customSplitTimer);
  customSplitTimer = setTimeout(() => {
    splitCombinedQuestionAndOptions();
  }, 140);
});

if (customForm && manualQuestionEditor) {
  manualQuestionEditor.append(customForm);
  customModal?.remove();
}

function syncCustomQuestionFormat() {
  const isMcq = customQuestionType?.value !== 'short';
  customOptionsGroup?.classList.toggle('hidden', !isMcq);
  customOptionInputs.forEach(input => {
    if (input) input.setAttribute('aria-required', String(isMcq));
  });
}
customQuestionType?.addEventListener('change', syncCustomQuestionFormat);
syncCustomQuestionFormat();

function openCustomQuestionModal() {
  editingBankQuestionId = null;
  manualQuestionEditor?.classList.remove('editing-bank-question');
  document.querySelector('#custom-q-eyebrow').textContent = 'MANUAL QUESTION ENTRY';
  document.querySelector('#custom-q-modal-title').textContent = 'Write a question';
  document.querySelector('#custom-question-form [type="submit"]').innerHTML = 'Add to paper <span>→</span>';
  manualQuestionEditor?.classList.remove('hidden');
  bankBrowserPanel?.classList.add('hidden');
  openCustomBtn?.classList.add('active');
  openQuestionBankBtn?.classList.remove('active');
  const subjectField = document.querySelector('#custom-q-subject');
  const selectedSubject = document.querySelector('#subject-select')?.value;
  if (subjectField && [...subjectField.options].some(option => option.value === selectedSubject)) {
    subjectField.value = selectedSubject;
  }
  syncCustomQuestionFormat();
  document.querySelector('#custom-q-text')?.focus();
}

function openBankQuestionEditor(questionId) {
  const question = questions.find(item => item.id === questionId);
  if (!question) return;
  openCustomQuestionModal();
  editingBankQuestionId = questionId;
  manualQuestionEditor?.classList.add('editing-bank-question');
  document.querySelector('#custom-q-modal-title').textContent = 'Edit question bank item';
  document.querySelector('#custom-q-eyebrow').textContent = 'QUESTION BANK EDIT';
  document.querySelector('#custom-question-form [type="submit"]').innerHTML = 'Save & add to paper <span>✓</span>';
  const examField = document.querySelector('#exam-select');
  if (examField && [...examField.options].some(option => option.value === question.exam)) examField.value = question.exam;
  const subjectField = document.querySelector('#custom-q-subject');
  if (subjectField && [...subjectField.options].some(option => option.value === question.subject)) subjectField.value = question.subject;
  document.querySelector('#custom-q-chapter').value = question.chapter || '';
  document.querySelector('#custom-q-level').value = question.level || 'Medium';
  document.querySelector('#custom-q-marks').value = question.marks || '4 marks';
  customQuestionType.value = question.options?.length ? 'mcq' : 'short';
  syncCustomQuestionFormat();
  const editor = document.querySelector('#custom-q-text');
  editor.innerHTML = sanitizeRichQuestionHtml(question.questionHtml || escapeHTML(question.text || ''));
  (question.imageUrls || []).forEach(url => {
    if ([...editor.querySelectorAll('img')].some(image => image.src === url)) return;
    const imageBlock = document.createElement('div');
    imageBlock.className = 'custom-question-image';
    imageBlock.dataset.uploadedQuestionImage = 'true';
    imageBlock.contentEditable = 'false';
    const image = document.createElement('img');
    image.src = url;
    image.alt = 'Question illustration';
    imageBlock.append(image);
    editor.append(imageBlock);
  });
  customOptionInputs.forEach((input, index) => {
    const option = question.options?.[index];
    const html = typeof option === 'string' ? escapeHTML(option) : String(option?.html || '').trim() || escapeHTML(option?.text || option?.value || option?.content || '');
    input.innerHTML = sanitizeRichQuestionHtml(html);
    scheduleMathFieldConversion(input);
    typesetQuestionMath(input);
  });
  const hasImage = Boolean(editor.querySelector('img'));
  removeCustomQuestionImageButton?.classList.toggle('hidden', !hasImage);
  if (customQuestionImageStatus) customQuestionImageStatus.textContent = hasImage ? 'Question image attached; add another or remove the current image.' : 'The image will appear below the question and before its answer choices.';
  scheduleMathFieldConversion(editor);
  typesetQuestionMath(editor);
}

document.querySelectorAll('[data-replace-option]').forEach(button => button.addEventListener('click', () => {
  const input = customOptionInputs[Number(button.dataset.replaceOption)];
  if (!input) return;
  input.innerHTML = '';
  input.focus();
}));

function closeCustomQuestionModal() {
  editingBankQuestionId = null;
  manualQuestionEditor?.classList.remove('editing-bank-question');
  document.querySelector('#custom-q-modal-title').textContent = 'Write a question';
  document.querySelector('#custom-q-eyebrow').textContent = 'MANUAL QUESTION ENTRY';
  document.querySelector('#custom-question-form [type="submit"]').innerHTML = 'Add to paper <span>→</span>';
  manualQuestionEditor?.classList.add('hidden');
  bankBrowserPanel?.classList.remove('hidden');
  openCustomBtn?.classList.remove('active');
  openQuestionBankBtn?.classList.add('active');
}

openCustomBtn?.addEventListener('click', openCustomQuestionModal);
openQuestionBankBtn?.addEventListener('click', closeCustomQuestionModal);
closeCustomBtn?.addEventListener('click', closeCustomQuestionModal);
cancelCustomBtn?.addEventListener('click', closeCustomQuestionModal);
customModal?.addEventListener('click', event => {
  if (event.target === customModal) closeCustomQuestionModal();
});

customForm?.addEventListener('submit', event => {
  event.preventDefault();
  const originalQuestion = editingBankQuestionId ? questions.find(question => question.id === editingBankQuestionId) : null;
  const questionEditor = document.querySelector('#custom-q-text');
  const questionHtml = sanitizeRichQuestionHtml(serializeMathEditor(questionEditor));
  const text = questionHtmlToText(questionHtml) || originalQuestion?.text || '';
  if (!richEditorHasContent(questionEditor, questionHtml)) { toast('Enter a question before saving.'); questionEditor?.focus(); return; }

  const subject = document.querySelector('#custom-q-subject')?.value || 'Physics';
  const chapter = document.querySelector('#custom-q-chapter')?.value.trim() || 'Custom Chapter';
  const level = document.querySelector('#custom-q-level')?.value || 'Medium';
  const marksText = document.querySelector('#custom-q-marks')?.value.trim() || '4 marks';
  const exam = mode === 'coaching' ? (document.querySelector('#exam-select')?.value || 'JEE Main') : 'School';

  const optionHtml = customOptionInputs.map(input => sanitizeRichQuestionHtml(serializeMathEditor(input)));
  const optionTexts = optionHtml.map((html, index) => questionHtmlToText(html) || originalQuestion?.options?.[index]?.text || '');
  const isMcq = customQuestionType?.value !== 'short';
  if (isMcq && customOptionInputs.some((input, index) => !richEditorHasContent(input, optionHtml[index]))) {
    toast('Fill in all four answer choices, or select Short answer.');
    return;
  }

  const options = isMcq
    ? optionTexts.map((optionText, idx) => ({ label: String.fromCharCode(65 + idx), text: optionText, html: optionHtml[idx] }))
    : [];

  const customQ = {
    ...(originalQuestion || {}),
    id: originalQuestion?.id || `custom-${Date.now()}`,
    exam: exam,
    subject: subject,
    chapter: chapter,
    name: originalQuestion?.name || 'Custom Question',
    text: text,
    questionHtml: questionHtml,
    imageUrls: [],
    options: options,
    type: isMcq ? 'Single correct' : 'Short answer',
    marks: marksText,
    paper: originalQuestion?.paper || 'Custom',
    year: originalQuestion?.year || 'Custom',
    level: level,
    difficultyEstimated: false,
    difficultyMissing: false
  };

  if (originalQuestion) {
    const index = questions.findIndex(question => question.id === customQ.id);
    if (index >= 0) questions[index] = customQ;
    editedBankQuestions[customQ.id] = customQ;
    [savedCustomQuestions, savedPdfQuestions].forEach(collection => {
      const savedIndex = collection.findIndex(question => question.id === customQ.id);
      if (savedIndex >= 0) collection[savedIndex] = customQ;
    });
    selected.add(customQ.id);
    selectedMarks.set(customQ.id, selectedMarks.get(customQ.id) || Number.parseInt(marksText, 10) || 4);
    try {
      localStorage.setItem(editedQuestionsStorageKey, JSON.stringify(editedBankQuestions));
      localStorage.setItem(customQuestionStorageKey, JSON.stringify(savedCustomQuestions));
      localStorage.setItem(pdfQuestionStorageKey, JSON.stringify(savedPdfQuestions));
    } catch (error) {
      console.warn('Could not save edited question for future sessions.', error);
      toast('Changes applied for this session, but browser storage is full.');
    }
  } else {
    questions.unshift(customQ);
    savedCustomQuestions.unshift(customQ);
    try {
      localStorage.setItem(customQuestionStorageKey, JSON.stringify(savedCustomQuestions));
    } catch (error) {
      console.warn('Could not save custom question for future sessions.', error);
    }
    selected.add(customQ.id);
    selectedMarks.set(customQ.id, parseInt(marksText) || 4);
  }

  document.querySelector('#custom-q-text').innerHTML = '';
  removeCustomQuestionImageButton?.classList.add('hidden');
  if (customQuestionImageStatus) customQuestionImageStatus.textContent = 'The image will appear below the question and before its answer choices.';
  document.querySelector('#custom-q-chapter').value = '';
  customOptionInputs.forEach(input => { if (input) input.innerHTML = ''; });
  saveCurrentPaper();
  render();
  if (originalQuestion) {
    editingBankQuestionId = null;
    closeCustomQuestionModal();
    document.querySelector('#custom-q-modal-title').textContent = 'Write a question';
    document.querySelector('#custom-question-form [type="submit"]').innerHTML = 'Add to paper <span>→</span>';
    toast('Question saved and added to this paper.');
  } else toast('Custom question added to your paper.');
});

// PDF/image extraction runs in the optional local Python service. Every result
// remains an editable draft until the educator explicitly imports it.
const pdfImportModal = document.querySelector('#pdf-import-modal');
const extractFileInput = document.querySelector('#extract-file');
const extractStatus = document.querySelector('#extract-status');
const extractReviewList = document.querySelector('#extract-review-list');
let currentExtraction = null;
let extractionPreviewUrls = new Map();
function normalizedQuestionText(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function setExtractionStatus(message, state = 'info') {
  if (!extractStatus) return;
  extractStatus.textContent = message;
  extractStatus.dataset.state = state;
}

function openPdfImporter() {
  document.querySelector('#extract-exam').value = document.querySelector('#exam-select')?.value || 'JEE Main';
  const subject = document.querySelector('#subject-select')?.value || 'Physics';
  if ([...document.querySelector('#extract-subject').options].some(option => option.value === subject)) {
    document.querySelector('#extract-subject').value = subject;
  }
  const chapter = activeChapter !== 'All chapters' ? activeChapter : '';
  document.querySelector('#extract-chapter').value = chapter;
  pdfImportModal?.classList.remove('hidden');
  document.querySelector('#extract-file')?.focus();
  fetch('http://127.0.0.1:8001/health')
    .then(response => { if (!response.ok) throw new Error('service offline'); return response.json(); })
    .then(() => setExtractionStatus('Local extraction service is ready. Choose a PDF or page image to begin.', 'success'))
    .catch(() => setExtractionStatus('Local service required at http://127.0.0.1:8001. Start it using README_PDF_IMPORT.md. Scans require local Tesseract OCR.', 'info'));
}

function closePdfImporter() {
  pdfImportModal?.classList.add('hidden');
}

function renderExtractionReview() {
  if (!currentExtraction || !extractReviewList) return;
  const questions = currentExtraction.questions || [];
  extractReviewList.classList.remove('hidden');
  extractReviewList.innerHTML = questions.length ? questions.map((question, index) => {
    const sourcePage = Number(question.source_page || question.sourcePages?.[0] || 1);
    const page = (currentExtraction.pages || []).find(item => item.page === sourcePage);
    const previewUrl = extractionPreviewUrls.get(sourcePage);
    const options = (question.options || []).map((option, optionIndex) => `
      <label class="extract-option-field"><b>${escapeHTML(option.label || String.fromCharCode(65 + optionIndex))}</b><input data-extract-option="${index}:${optionIndex}" value="${escapeHTML(option.text || '')}" aria-label="Choice ${escapeHTML(option.label || optionIndex + 1)}" /></label>`).join('');
    const warningText = (question.extractionWarnings || []).join(' ');
    const optionEditor = options
      ? `<div class="extract-options-grid">${options}</div>`
      : `<button type="button" class="secondary-button" data-extract-add-choices="${index}">Add four choice fields</button><div class="extract-warning">No options were detected. Confirm this is a written-response item or add the choices manually.</div>`;
    const mathPreview = extractionMathPreview(question, index);
    return `<article class="extract-question" data-extract-card="${index}">
      ${previewUrl ? `<img class="extract-question-image" src="${previewUrl}" alt="Source page ${sourcePage}" loading="lazy"/>` : `<div class="extract-question-image extract-empty">Source page ${sourcePage}</div>`}
      <div class="extract-question-editor">
        <div class="extract-question-head"><label><input type="checkbox" data-extract-select="${index}"/> Select</label><b>Question ${escapeHTML(String(question.question_number || index + 1))}</b><span>Page ${sourcePage}</span></div>
        <textarea data-extract-text="${index}" aria-label="Question text">${escapeHTML(question.text || question.question_text || '')}</textarea>
        ${optionEditor}
        ${mathPreview}
        <div class="form-grid two-col"><label class="field">Section / source<input data-extract-section="${index}" value="${escapeHTML(question.section || question.paper || '')}" /></label><label class="field">Difficulty<select data-extract-level="${index}"><option>Easy</option><option selected>Medium</option><option>Hard</option></select></label></div>
        <label class="field">Answer (optional)<input data-extract-answer="${index}" value="${escapeHTML(question.answer || question.answer_key || '')}" placeholder="Leave blank if unknown" /></label>
        ${warningText ? `<div class="extract-warning">${escapeHTML(warningText)}</div>` : ''}
      </div></article>`;
  }).join('') : '<div class="extract-empty">No questions were recognized. Try a text-based PDF or verify the OCR setup.</div>';
  document.querySelector('#extract-select-all')?.classList.toggle('hidden', !questions.length);
  document.querySelector('#extract-download')?.classList.toggle('hidden', !questions.length);
  document.querySelector('#extract-add-selected')?.classList.toggle('hidden', !questions.length);

  typesetQuestionMath(extractReviewList);

  extractReviewList.querySelectorAll('[data-extract-text]').forEach(input => input.addEventListener('input', () => {
    const question = questions[Number(input.dataset.extractText)];
    if (question) { question.text = input.value; question.question_text = input.value; }
    updateExtractionMathPreview(Number(input.dataset.extractText));
  }));
  extractReviewList.querySelectorAll('[data-extract-option]').forEach(input => input.addEventListener('input', () => {
    const [questionIndex, optionIndex] = input.dataset.extractOption.split(':').map(Number);
    const option = questions[questionIndex]?.options?.[optionIndex];
    if (option) { option.text = input.value; option.html = input.value; }
    updateExtractionMathPreview(questionIndex);
  }));
  extractReviewList.querySelectorAll('[data-extract-level]').forEach(input => input.addEventListener('change', () => {
    const question = questions[Number(input.dataset.extractLevel)];
    if (question) { question.level = input.value; question.difficultyMissing = false; question.difficultyEstimated = false; }
  }));
  extractReviewList.querySelectorAll('[data-extract-answer]').forEach(input => input.addEventListener('input', () => {
    const question = questions[Number(input.dataset.extractAnswer)];
    if (question) { question.answer = input.value.trim(); question.answer_key = input.value.trim() || null; }
  }));
  extractReviewList.querySelectorAll('[data-extract-section]').forEach(input => input.addEventListener('input', () => {
    const question = questions[Number(input.dataset.extractSection)];
    if (question) { question.section = input.value; question.paper = input.value; }
  }));
  extractReviewList.querySelectorAll('[data-extract-add-choices]').forEach(button => button.addEventListener('click', () => {
    const question = questions[Number(button.dataset.extractAddChoices)];
    if (!question) return;
    question.options = ['A', 'B', 'C', 'D'].map(label => ({ label, text: '', html: '' }));
    question.question_type = 'mcq';
    renderExtractionReview();
  }));
}

const chemistryElements = new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' '));

function formatImportedMathHtml(value, subject = '') {
  const source = String(value || '');
  const parts = source.split(/(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\$[^$]*\$)/g);
  return parts.map((part, index) => {
    if (index % 2) return escapeHTML(part);
    let safe = escapeHTML(part);
    safe = safe.replace(/([A-Z][a-z]?)(\d+)([+-])/g, (match, element, count, charge) =>
      chemistryElements.has(element) ? `<span>${element}</span><sup>${count}${charge}</sup>` : match);
    safe = safe.replace(/([A-Z][a-z]?)(\d+)/g, (match, element, count) =>
      chemistryElements.has(element) || ['X', 'Y', 'Z'].includes(element)
        ? `<span>${element}</span><sub>${count}</sub>` : match);
    safe = safe.replace(/([A-Z][a-z]?)([+-])/g, (match, element, charge) =>
      chemistryElements.has(element) ? `<span>${element}</span><sup>${charge}</sup>` : match);
    return safe.replace(/\n/g, '<br>');
  }).join('');
}

function extractionMathPreview(question, index) {
  const prompt = formatImportedMathHtml(question.text || question.question_text || '', question.subject);
  const choices = (question.options || []).map((option, optionIndex) =>
    `<div><b>${escapeHTML(option.label || String.fromCharCode(65 + optionIndex))}.</b> ${formatImportedMathHtml(option.text || '', question.subject)}</div>`
  ).join('');
  return `<section class="extract-math-preview" data-extract-math-preview="${index}"><div class="extract-math-preview-label">Rendered math check</div><div class="extract-math-preview-content"><div>${prompt}</div>${choices}</div></section>`;
}

function updateExtractionMathPreview(index) {
  const question = currentExtraction?.questions?.[index];
  const preview = extractReviewList?.querySelector(`[data-extract-math-preview="${index}"] .extract-math-preview-content`);
  if (!question || !preview) return;
  if (window.MathJax?.typesetClear) window.MathJax.typesetClear([preview]);
  const prompt = formatImportedMathHtml(question.text || question.question_text || '', question.subject);
  const choices = (question.options || []).map((option, optionIndex) =>
    `<div><b>${escapeHTML(option.label || String.fromCharCode(65 + optionIndex))}.</b> ${formatImportedMathHtml(option.text || '', question.subject)}</div>`
  ).join('');
  preview.innerHTML = `<div>${prompt}</div>${choices}`;
  typesetQuestionMath(preview);
}

document.querySelector('#open-pdf-import')?.addEventListener('click', openPdfImporter);
document.querySelector('#close-pdf-import')?.addEventListener('click', closePdfImporter);
pdfImportModal?.addEventListener('click', event => { if (event.target === pdfImportModal) closePdfImporter(); });
document.querySelector('#extract-file')?.addEventListener('change', () => {
  currentExtraction = null;
  extractionPreviewUrls.forEach(url => URL.revokeObjectURL(url));
  extractionPreviewUrls.clear();
  extractReviewList?.classList.add('hidden');
  ['#extract-select-all', '#extract-download', '#extract-add-selected'].forEach(selector => document.querySelector(selector)?.classList.add('hidden'));
  if (extractFileInput.files?.[0]) setExtractionStatus(`${extractFileInput.files[0].name} selected. Click Extract questions to start.`, 'success');
});
document.querySelector('#extract-start')?.addEventListener('click', async event => {
  const file = extractFileInput?.files?.[0];
  if (!file) { setExtractionStatus('Choose a PDF or image first.', 'error'); return; }
  if (file.size > 25 * 1024 * 1024) { setExtractionStatus('This file exceeds the 25 MB upload limit.', 'error'); return; }
  const button = event.currentTarget;
  button.disabled = true;
  setExtractionStatus('Extracting text and page previews on the local service…');
  const body = new FormData();
  body.append('file', file);
  body.append('exam', document.querySelector('#extract-exam').value);
  body.append('subject', document.querySelector('#extract-subject').value);
  body.append('chapter', document.querySelector('#extract-chapter').value.trim() || 'Unsorted questions');
  try {
    const response = await fetch('http://127.0.0.1:8001/api/extract', { method: 'POST', body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || `Extraction service returned ${response.status}.`);
    currentExtraction = result;
    extractionPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    extractionPreviewUrls.clear();
    for (const page of result.pages || []) {
      const previewBlob = await (await fetch(page.dataUrl)).blob();
      extractionPreviewUrls.set(page.page, URL.createObjectURL(previewBlob));
    }
    renderExtractionReview();
    const pageWarnings = result.pageWarnings?.length ? ` ${result.pageWarnings.join(' ')}` : '';
    setExtractionStatus(`Recognized ${result.questionCount} question(s); ${result.needsReviewCount} need review. Review the source pages before importing.${pageWarnings}`, result.needsReviewCount ? 'info' : 'success');
  } catch (error) {
    const message = error instanceof TypeError
      ? 'Could not reach the local extraction service. Start it with the server instructions in README_PDF_IMPORT.md.'
      : error.message;
    setExtractionStatus(message, 'error');
  } finally {
    button.disabled = false;
  }
});
document.querySelector('#extract-select-all')?.addEventListener('click', event => {
  const boxes = [...(extractReviewList?.querySelectorAll('[data-extract-select]') || [])];
  const select = boxes.some(box => !box.checked);
  boxes.forEach(box => { box.checked = select; });
  event.currentTarget.textContent = select ? 'Clear selection' : 'Select all';
});
document.querySelector('#extract-download')?.addEventListener('click', () => {
  if (!currentExtraction) return;
  const exported = {
    questions: currentExtraction.questions.map(question => {
      const { sourcePreviews, ...record } = question;
      return record;
    }),
    mathSvgDefinitions: [],
    sourceFile: currentExtraction.sourceFile,
    questionCount: currentExtraction.questionCount,
    needsReviewCount: currentExtraction.needsReviewCount,
    pages: currentExtraction.pages || [],
  };
  const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${(document.querySelector('#extract-chapter').value || 'extracted-questions').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
});
document.querySelector('#extract-add-selected')?.addEventListener('click', () => {
  if (!currentExtraction) return;
  const chosen = [...(extractReviewList?.querySelectorAll('[data-extract-select]:checked') || [])];
  if (!chosen.length) { setExtractionStatus('Select at least one question to add.', 'error'); return; }
  const timestamp = Date.now();
  const existingText = new Set(questions.map(question => normalizedQuestionText(question.text)));
  let added = 0;
  chosen.forEach((checkbox, index) => {
    const source = currentExtraction.questions[Number(checkbox.dataset.extractSelect)];
    if (!source) return;
    const text = String(source.text || source.question_text || '').trim();
    const textKey = normalizedQuestionText(text);
    if (!text || existingText.has(textKey)) return;
    const id = `pdf-${timestamp}-${index}`;
    const questionHtml = formatImportedMathHtml(text, source.subject || document.querySelector('#extract-subject').value);
    const options = (source.options || []).filter(option => String(option.text || '').trim()).map((option, optionIndex) => {
      const optionText = String(option.text || '').trim();
      return {
        label: option.label || String.fromCharCode(65 + optionIndex),
        text: optionText,
        html: formatImportedMathHtml(optionText, source.subject || document.querySelector('#extract-subject').value),
      };
    });
    const imported = {
      id,
      exam: source.exam || document.querySelector('#extract-exam').value,
      subject: source.subject || document.querySelector('#extract-subject').value,
      chapter: source.chapter || document.querySelector('#extract-chapter').value.trim() || 'Unsorted questions',
      name: source.chapter || document.querySelector('#extract-chapter').value.trim() || 'Imported question',
      text,
      questionHtml,
      options,
      type: options.length ? 'Single correct' : 'Short answer',
      marks: source.marks || '4 marks',
      paper: source.section || source.paper || 'PDF import',
      year: source.year || '',
      sourceUrl: source.sourceUrl || '',
      imageUrls: [],
      level: source.level || 'Medium',
      difficultyEstimated: Boolean(source.difficultyEstimated),
      difficultyMissing: Boolean(source.difficultyMissing),
      answer: source.answer || source.answer_key || '',
      reviewRequired: Boolean(source.reviewRequired),
      sourcePages: source.sourcePages || [source.source_page || 1],
      sourcePage: source.source_page || 1,
      assets: source.assets || [],
    };
    questions.unshift(imported);
    savedPdfQuestions.unshift(imported);
    existingText.add(textKey);
    selected.add(id);
    selectedMarks.set(id, Number.parseInt(imported.marks, 10) || 4);
    added += 1;
  });
  try {
    localStorage.setItem(pdfQuestionStorageKey, JSON.stringify(savedPdfQuestions));
  } catch (error) {
    console.warn('Could not persist all imported PDF questions.', error);
    setExtractionStatus('Added for this session, but browser storage is full. Download the JSON backup before closing this tab.', 'error');
  }
  saveCurrentPaper();
  render();
  closePdfImporter();
  toast(added ? `${added} extracted question(s) added to this paper and saved in this browser.` : 'No new questions were added; the selected items were empty or duplicates.');
});

document.querySelectorAll('[data-paper-filter]').forEach(button => button.addEventListener('click', () => { paperKindFilter = button.dataset.paperFilter; document.querySelectorAll('[data-paper-filter]').forEach(item => item.classList.toggle('active',item===button)); renderMyPapers(); }));
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { paperView = button.dataset.view; document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active',item===button)); renderMyPapers(); }));
function requestDeleteBankQuestion(questionId) {
  const question = questions.find(item => item.id === questionId);
  if (!question) return;
  pendingDeleteQuestionId = questionId;
  document.querySelector('#delete-question-title').textContent = 'Remove this question?';
  const previewText = (question.text || question.name).replace(/\s+/g, ' ').trim().slice(0, 110);
  document.querySelector('#delete-question-description').textContent = `${previewText}${previewText.length >= 110 ? '…' : ''} It will be hidden from this browser’s question bank. Existing papers will keep it, and the source JSON file will not change.`;
  document.querySelector('#delete-question-confirm').classList.remove('hidden');
  document.querySelector('#cancel-question-delete').focus();
}
document.querySelector('#cancel-question-delete').addEventListener('click', () => {
  pendingDeleteQuestionId = null;
  document.querySelector('#delete-question-confirm').classList.add('hidden');
});
document.querySelector('#confirm-question-delete').addEventListener('click', () => {
  if (!pendingDeleteQuestionId) return;
  if (!deletedQuestionIds.includes(pendingDeleteQuestionId)) deletedQuestionIds.push(pendingDeleteQuestionId);
  let saved = true;
  try { localStorage.setItem(deletedQuestionsStorageKey, JSON.stringify(deletedQuestionIds)); }
  catch (error) { saved = false; console.warn('Could not persist question-bank removal.', error); }
  pendingDeleteQuestionId = null;
  document.querySelector('#delete-question-confirm').classList.add('hidden');
  const availableCount = questions.filter(question => !deletedQuestionIds.includes(question.id)).length;
  const countLabel = document.querySelector('#question-count');
  if (countLabel) countLabel.textContent = availableCount;
  const navCount = document.querySelector('.nav-item[href="#bank"] .nav-count');
  if (navCount) navCount.textContent = availableCount;
  render();
  toast(saved ? 'Question removed from this browser’s bank. Existing papers are unchanged.' : 'Question removed for this session, but the change could not be saved.');
});
document.querySelector('#delete-question-confirm').addEventListener('click', event => {
  if (event.target.id === 'delete-question-confirm') document.querySelector('#cancel-question-delete').click();
});
document.querySelector('#cancel-delete').addEventListener('click', () => { pendingDeleteId = null; document.querySelector('#delete-confirm').classList.add('hidden'); });
document.querySelector('#confirm-delete').addEventListener('click', () => {
  savedPapers = savedPapers.filter(p => p.id !== pendingDeleteId); localStorage.setItem(papersStorageKey,JSON.stringify(savedPapers));
  document.querySelector('#delete-confirm').classList.add('hidden'); pendingDeleteId = null; renderRecentPapers(); renderMyPapers(); toast('Paper deleted.');
});
document.querySelector('#delete-confirm').addEventListener('click', event => { if (event.target.id === 'delete-confirm') document.querySelector('#cancel-delete').click(); });
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (!document.querySelector('#delete-question-confirm').classList.contains('hidden')) document.querySelector('#cancel-question-delete').click();
  else if (!document.querySelector('#delete-confirm').classList.contains('hidden')) document.querySelector('#cancel-delete').click();
});
const availableQuestionCount = questions.filter(question => !deletedQuestionIds.includes(question.id)).length;
document.querySelector('#question-count').textContent = availableQuestionCount;
document.querySelector('.nav-item[href="#bank"] .nav-count').textContent = availableQuestionCount;
let autosaveTimer;
let resumedPaperId = '';
function resumeLastSavedPaper() {
  if (!currentUser) return;
  let paperId = '';
  try { paperId = localStorage.getItem(activePaperStorageKey) || ''; } catch (error) { console.warn('Last paper could not be read.', error); }
  if (!paperId || paperId === resumedPaperId) return;
  const paper = savedPapers.find(item => item.id === paperId);
  if (!paper) return;
  resumedPaperId = paper.id;
  restoreSavedPaper(paper);
  toast('Your last paper is ready to continue.');
}
window.addEventListener('papercraft-session-ready', () => setTimeout(resumeLastSavedPaper, 0));
if (currentUser) resumeLastSavedPaper();
document.querySelectorAll('#coaching-settings input:not([type=file]),#coaching-settings select,#coaching-settings textarea,#school-settings input:not([type=file]),#school-settings select,#school-settings textarea').forEach(field => field.addEventListener('input', () => {
  const indicator=document.querySelector('#autosave-status'); if(indicator)indicator.innerHTML='<i></i> Saving…';
  clearTimeout(autosaveTimer); autosaveTimer=setTimeout(saveCurrentPaper,350);
}));
window.addEventListener('pagehide', () => { clearTimeout(autosaveTimer); if (window.activePaperId) saveCurrentPaper(); });
document.querySelector('#exam-select')?.addEventListener('change', () => { activeChapter = 'All chapters';activeSource='All sources';if(document.querySelector('#source-filter'))document.querySelector('#source-filter').value='All sources';render();updateCoachingHeader(); });
window.addEventListener('hashchange', () => { if (location.hash === '#drafts') renderMyPapers(); if (location.hash === '#studio') renderRecentPapers(); });
renderRecentPapers(); renderMyPapers();

// Landing-page interactions: kept local so the existing paper studio remains untouched.
if (homePage) {
  const header = document.querySelector('.home-nav');
  const modeMenu = document.querySelector('.mode-menu');
  const modeTrigger = document.querySelector('.mode-menu-trigger');
  const mobileToggle = document.querySelector('.mobile-menu-toggle');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const mobileOverlay = document.createElement('nav');
  mobileOverlay.className = 'mobile-nav-overlay';
  mobileOverlay.setAttribute('aria-label', 'Mobile navigation');
  [
    ['Features', '#features'],
    ['How it works', '#how-it-works'],
    ['JEE & NEET papers', '#paper-modes'],
    ['School exams', '#paper-modes'],
  ].forEach(([label, href], index) => {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    link.style.setProperty('--i', index);
    mobileOverlay.append(link);
  });
  homePage.append(mobileOverlay);

  const progress = document.createElement('div');
  progress.className = 'scroll-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.append(progress);

  const stepFill = document.createElement('i');
  stepFill.className = 'step-progress';
  document.querySelector('.how-steps')?.prepend(stepFill);

  function updateScrollState() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${scrollable > 0 ? window.scrollY / scrollable : 0})`;
    header?.classList.toggle('scrolled', window.scrollY > 24);
    const steps = document.querySelector('.how-steps');
    if (steps) {
      const rect = steps.getBoundingClientRect();
      const amount = Math.min(1, Math.max(0, (window.innerHeight * .78 - rect.top) / (rect.height + window.innerHeight * .28)));
      if (window.innerWidth <= 650) stepFill.style.height = `${amount * 100}%`;
      else stepFill.style.width = `${amount * 84}%`;
    }
  }
  window.addEventListener('scroll', updateScrollState, { passive: true });
  window.addEventListener('resize', updateScrollState);
  updateScrollState();

  if (!reducedMotion && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    }), { threshold: .12 });
    document.querySelectorAll('.home-page section,.home-trust,.home-cta,.home-footer').forEach((section, index) => {
      section.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
      revealObserver.observe(section);
    });
  } else {
    document.querySelectorAll('.home-page section,.home-trust,.home-cta,.home-footer').forEach(section => section.classList.add('is-visible'));
  }

  const sectionLinks = [...document.querySelectorAll('.home-links>a')];
  const sections = [...document.querySelectorAll('#features,#how-it-works,#paper-modes')];
  if ('IntersectionObserver' in window) {
    const activeObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      sectionLinks.forEach(link => link.classList.toggle('active', link.hash === `#${entry.target.id}`));
    }), { rootMargin: '-25% 0px -60% 0px' });
    sections.forEach(section => activeObserver.observe(section));
  }

  modeTrigger?.addEventListener('click', () => {
    const open = modeMenu.classList.toggle('open');
    modeTrigger.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', event => {
    if (modeMenu && !modeMenu.contains(event.target)) {
      modeMenu.classList.remove('open');
      modeTrigger?.setAttribute('aria-expanded', 'false');
    }
  });

  function closeMobileMenu() {
    mobileOverlay.classList.remove('open');
    mobileToggle?.setAttribute('aria-expanded', 'false');
    mobileToggle?.setAttribute('aria-label', 'Open navigation menu');
    document.body.classList.remove('mobile-menu-open');
  }
  mobileToggle?.addEventListener('click', () => {
    const open = mobileToggle.getAttribute('aria-expanded') !== 'true';
    mobileToggle.setAttribute('aria-expanded', String(open));
    mobileToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    mobileOverlay.classList.toggle('open', open);
    document.body.classList.toggle('mobile-menu-open', open);
    if (open) mobileOverlay.querySelector('a')?.focus();
  });
  mobileOverlay.addEventListener('click', event => {
    if (event.target.closest('a')) closeMobileMenu();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeMobileMenu(); modeMenu?.classList.remove('open'); } });

  const previewSamples = {
    school: { institute: 'GREENFIELD HIGH SCHOOL', subtitle: 'CLASS X · MATHEMATICS', subject: 'MATHEMATICS', time: 'Time: 3 hours', title: 'Pre-board Examination', questions: ['If x + 3 = 8, what is the value of x?', 'Find the roots of x² − 5x + 6 = 0.', 'Show your working in the space provided.'], label: 'CLASSROOM FORMAT' },
    jee: { institute: 'YOUR INSTITUTE', subtitle: 'JEE MAIN · MOCK TEST 04', subject: 'PHYSICS', time: 'Time: 60 min', title: 'JEE Main Practice Test', questions: ['A block slides down a smooth incline at angle θ. Find its acceleration.', 'For a particle in SHM, x = A cos(ωt). Find its maximum speed.', 'Use g = 9.8 m s⁻² unless stated otherwise.'], label: 'JEE MAIN' },
    neet: { institute: 'YOUR INSTITUTE', subtitle: 'NEET · BIOLOGY PRACTICE', subject: 'BIOLOGY', time: 'Time: 45 min', title: 'NEET Biology Practice', questions: ['Which organelle is the primary site of ATP synthesis?', 'In a dihybrid cross, what is the expected phenotypic ratio?', 'Choose the single best answer for each question.'], label: 'NEET PRACTICE' }
  };
  document.querySelectorAll('.preview-mode').forEach(button => button.addEventListener('click', () => {
    const sample = previewSamples[button.dataset.preview];
    if (!sample) return;
    document.querySelectorAll('.preview-mode').forEach(item => item.classList.toggle('active', item === button));
    document.querySelector('#mock-institute').textContent = sample.institute;
    document.querySelector('#mock-subtitle').textContent = sample.subtitle;
    document.querySelector('#mock-subject').textContent = sample.subject;
    document.querySelector('#mock-time').textContent = sample.time;
    document.querySelector('#mock-title').textContent = sample.title;
    document.querySelector('#mock-q1').textContent = sample.questions[0];
    document.querySelector('#mock-q2').textContent = sample.questions[1];
    document.querySelector('#mock-q3').textContent = sample.questions[2];
    document.querySelector('.hero-mode-chip').textContent = sample.label;
  }));

  if (!reducedMotion) {
    document.querySelectorAll('.feature-card,.showcase-card').forEach(card => {
      card.addEventListener('pointermove', event => {
        const bounds = card.getBoundingClientRect();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;
        card.style.setProperty('--spot-x', `${x}px`);
        card.style.setProperty('--spot-y', `${y}px`);
        const tiltX = ((y / bounds.height) - .5) * -4;
        const tiltY = ((x / bounds.width) - .5) * 5;
        card.style.transform = `perspective(900px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-4px)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
    document.querySelectorAll('.hero-primary,.home-signup').forEach(button => {
      button.addEventListener('pointermove', event => {
        const bounds = button.getBoundingClientRect();
        button.style.transform = `translate(${(event.clientX - bounds.left - bounds.width / 2) * .08}px, ${(event.clientY - bounds.top - bounds.height / 2) * .12}px)`;
      });
      button.addEventListener('pointerleave', () => { button.style.transform = ''; });
    });
  }
}
