import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createClient} from '@supabase/supabase-js';
import './styles.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const nav = ['Overview','Learners','Teachers','Learning Materials','Exams & Dates','Results','Assignments','Reports'];
const sampleLearners = [
 {id:'sample-1', admission_number:'NYS001', first_name:'Sample', last_name:'Learner', grade:'Grade 7', gender:'—'},
 {id:'sample-2', admission_number:'NYS002', first_name:'Demo', last_name:'Student', grade:'Grade 8', gender:'—'}
];
function App(){
 const [session,setSession]=useState(null), [profile,setProfile]=useState(null), [page,setPage]=useState('Overview');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[admission,setAdmission]=useState('');
 const [notice,setNotice]=useState(''); const [busy,setBusy]=useState(false);
 const [learners,setLearners]=useState([]),[teachers,setTeachers]=useState([]),[resources,setResources]=useState([]),[exams,setExams]=useState([]),[results,setResults]=useState([]),[assignments,setAssignments]=useState([]);
 const [form,setForm]=useState({});
 const connected=!!supabase;
 async function loadProfile(user){
   if(!supabase||!user) return;
   const {data,error}=await supabase.from('profiles').select('id,full_name,role').eq('id',user.id).maybeSingle();
   if(error||!data){setNotice('Your account has no school profile yet. Ask the school administrator to link it.'); await supabase.auth.signOut(); return;}
   setProfile(data);
 }
 useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>{setSession(data.session);if(data.session)loadProfile(data.session.user)});const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{setSession(s);if(s)loadProfile(s.user);else setProfile(null)});return()=>subscription.unsubscribe()},[]);
 async function refresh(){
   if(!supabase||!session)return;
   const tables=[['learners',setLearners],['teachers',setTeachers],['learning_materials',setResources],['exams',setExams],['results',setResults],['assignments',setAssignments]];
   for(const [table,setter] of tables){const {data,error}=await supabase.from(table).select('*').order('created_at',{ascending:false}).limit(300);if(!error&&data)setter(data);}
 }
 useEffect(()=>{refresh()},[session,profile]);
 const role=(profile?.role||'').toLowerCase();
 const isHead=role==='headteacher'||role==='administrator'||role==='admin';
 const isTeacher=role==='teacher';
 const isLearner=role==='learner';
 const canManage=isHead;
 const canEnterMarks=isHead||isTeacher;
 async function login(e){e.preventDefault();setBusy(true);setNotice('');
   if(!supabase){setNotice('Supabase is not configured yet. This is a safe preview; sign-in and saving are disabled until the school connection is added.');setBusy(false);return;}
   const {data,error}=await supabase.auth.signInWithPassword({email,password}); if(error)setNotice(error.message); else {setSession(data.session);await loadProfile(data.user);}setBusy(false);
 }
 async function learnerLogin(e){e.preventDefault();setNotice('Learner admission-number login needs the secure server-side sign-in function to be configured. Please use the learner email login for now, or ask the administrator to finish setup.')}
 async function logout(){if(supabase)await supabase.auth.signOut();setSession(null);setProfile(null);setPage('Overview')}
 async function saveRecord(table,record,done){
   if(!supabase){setNotice('Not saved: connect Supabase before entering real school records.');return;}
   const {error}=await supabase.from(table).insert(record);
   if(error){setNotice('Save failed: '+error.message);return;}
   setNotice('Saved successfully.');setForm({});if(done)done();refresh();
 }
 const displayName=profile?.full_name||session?.user?.email||'School user';
 const rows=page==='Learners'?learners:page==='Teachers'?teachers:page==='Learning Materials'?resources:page==='Exams & Dates'?exams:page==='Results'?results:page==='Assignments'?assignments:[];
 const tableFor={'Learners':'learners','Teachers':'teachers','Learning Materials':'learning_materials','Exams & Dates':'exams','Results':'results','Assignments':'assignments'};
 const fields={'Learners':[['first_name','First name'],['last_name','Last name'],['admission_number','Admission number'],['grade','Grade'],['gender','Gender'],['guardian_name','Guardian name'],['guardian_phone','Guardian phone']], 'Teachers':[['full_name','Full name'],['email','Email'],['subjects','Subjects'],['assigned_grades','Assigned grades']], 'Learning Materials':[['title','Title'],['subject','Subject'],['grade','Grade'],['description','Description'],['file_url','File URL (optional)']], 'Exams & Dates':[['title','Exam or event'],['subject','Subject'],['grade','Grade'],['exam_date','Date (YYYY-MM-DD)'],['max_score','Maximum score']], 'Results':[['learner_id','Learner record ID'],['exam_id','Exam ID'],['subject','Subject'],['score','Score'],['max_score','Maximum score'],['published','Published (true/false)']], 'Assignments':[['title','Assignment title'],['subject','Subject'],['grade','Grade'],['due_date','Due date (YYYY-MM-DD)'],['description','Instructions']]};
 function startAdd(){setForm({});setNotice('')}
 if(!session||!profile)return <main className="login-wrap"><section className="brand"><div className="crest">N</div><p className="eyebrow">LEARN • GROW • EXCEL</p><h1>NYAMWERU SCHOOL</h1><p className="muted">Learning and school management portal</p></section><section className="login-card"><h2>Welcome back</h2><p className="muted">Sign in with your school account.</p><form onSubmit={login}><label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="name@school.org"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Your password"/></label><button disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form><div className="separator">LEARNER ACCESS</div><form onSubmit={learnerLogin}><label>Admission number<input value={admission} onChange={e=>setAdmission(e.target.value)} placeholder="e.g. NYS001"/></label><label>Password<input type="password" placeholder="Learner password" required/></label><button className="secondary" type="submit">Learner sign in</button></form>{notice&&<p className="notice">{notice}</p>}<p className="footnote">{connected?'Supabase settings detected. Account access depends on configured profiles and database policies.':'Preview mode · Database connection not configured'}</p></section></main>;
 return <div className="app"><aside className="sidebar"><div className="brand-small"><div className="crest small">N</div><div><b>NYAMWERU</b><small>SCHOOL PORTAL</small></div></div><div className="nav-label">SCHOOL MENU</div>{nav.filter(n=>!isLearner||['Overview','Learning Materials','Exams & Dates','Results','Assignments','Reports'].includes(n)).filter(n=>!(isTeacher&&n==='Teachers')).map(n=><button key={n} className={'nav-item '+(page===n?'active':'')} onClick={()=>setPage(n)}>{n==='Overview'?'⌂':n==='Learners'?'♙':n==='Teachers'?'♧':n==='Results'?'▤':'◈'}<span>{n}</span></button>)}<div className="side-bottom"><span className="status-dot"/>{connected?'Supabase configured':'Preview mode'}<button className="logout" onClick={logout}>Sign out</button></div></aside><main className="main"><header><div><span className="eyebrow">SCHOOL MANAGEMENT</span><h1>{page}</h1></div><div className="user-chip"><div className="avatar">{displayName[0]?.toUpperCase()}</div><div><b>{displayName}</b><small>{profile.role}</small></div></div></header>{notice&&<div className="notice top-notice">{notice}<button onClick={()=>setNotice('')}>×</button></div>}{page==='Overview'?<><section className="welcome"><div><p className="eyebrow">WELCOME TO YOUR SCHOOL</p><h2>Every learner, a future leader.</h2><p>Manage learning, assessment and school records in one place.</p></div><div className="welcome-mark">NYS</div></section><div className="stats"><Stat title="Learners" value={learners.length} sub="Enrolled records"/><Stat title="Teachers" value={teachers.length} sub="Staff directory"/><Stat title="Learning materials" value={resources.length} sub="Resources listed"/><Stat title="Results" value={results.length} sub="Assessment records"/></div><section className="panel"><div className="panel-head"><div><h3>Quick actions</h3><p className="muted">Go straight to a school task.</p></div></div><div className="quick-grid">{(canManage?['Learners','Teachers','Learning Materials','Exams & Dates']:canEnterMarks?['Results','Learning Materials','Exams & Dates','Assignments']:['Learning Materials','Exams & Dates','Assignments','Results']).map(n=><button key={n} className="quick" onClick={()=>setPage(n)}><span className="quick-icon">↗</span><b>{n}</b><small>Open section</small></button>)}</div></section></>:page==='Reports'?<section className="panel"><h3>Learner reports</h3><p>Report-card generation is not enabled in this rebuild yet. Results can be reviewed in the Results section.</p><button onClick={()=>setPage('Results')}>View results</button></section>:<section className="panel"><div className="panel-head"><div><h3>{page} directory</h3><p className="muted">{connected?'Records are read from the connected database when your role permits.':'Preview only; no real records are saved.'}</p></div>{((page==='Learners'&&canManage)||(page==='Teachers'&&canManage)||(page==='Learning Materials'&&canManage)||(page==='Exams & Dates'&&canManage)||(page==='Results'&&canEnterMarks)||(page==='Assignments'&&(canManage||isTeacher)))&&<button onClick={startAdd}>+ Add record</button>}</div>{form.__adding&&<form className="record-form" onSubmit={e=>{e.preventDefault();const f={...form};delete f.__adding;for(const k of ['subjects','assigned_grades'])if(typeof f[k]==='string')f[k]=f[k].split(',').map(s=>s.trim()).filter(Boolean);if(['score','max_score'].some(k=>k in f))for(const k of ['score','max_score'])if(k in f)f[k]=Number(f[k]);if('published'in f)f.published=String(f.published).toLowerCase()==='true';saveRecord(tableFor[page],f)}}><div className="form-grid">{(fields[page]||[]).map(([key,label])=><label key={key}>{label}<input required={!['description','file_url','guardian_name','guardian_phone','email'].includes(key)} value={form[key]??''} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}/></label>)}</div><div className="form-actions"><button type="submit">Save record</button><button className="secondary" type="button" onClick={()=>setForm({})}>Cancel</button></div></form>}{rows.length===0?<div className="empty"><div className="empty-icon">▤</div><b>No records to display</b><p>{connected?'No records were returned, or the database tables are not yet configured.':'Connect the database to display school records here.'}</p></div>:<div className="table-wrap"><table><thead><tr>{Object.keys(rows[0]).filter(k=>!['id','profile_id','created_at','updated_at'].includes(k)).slice(0,7).map(k=><th key={k}>{k.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}>{Object.keys(r).filter(k=>!['id','profile_id','created_at','updated_at'].includes(k)).slice(0,7).map(k=><td key={k}>{Array.isArray(r[k])?r[k].join(', '):String(r[k]??'—')}</td>)}</tr>)}</tbody></table></div>}</section>}<footer>NYAMWERU SCHOOL · Built for learning and growth</footer></main></div>
}
function Stat({title,value,sub}){return <div className="stat"><span>{title}</span><strong>{value}</strong><small>{sub}</small></div>}
createRoot(document.getElementById('root')).render(<App/>);
