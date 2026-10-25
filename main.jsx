import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, ArrowDownToLine, ArrowRight, Bell, BookOpen, CalendarDays,
  ChartNoAxesCombined, CheckCircle2, ChevronDown, ClipboardList, GraduationCap,
  LayoutDashboard, LogIn, Menu, Search, Settings, ShieldCheck, Users, X,
  FileText, Plus, School, BookMarked, Clock3, Eye, LockKeyhole, UserRound,
  Upload, LogOut, CircleHelp, Sparkles
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import "./styles.css";
import AdmissionsPage from "./admissions.jsx";

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = envUrl && envKey ? createClient(envUrl, envKey) : null;

const initialLearners = [
  { id: "NYS-2026-001", name: "Demo Learner One", level: "Junior School", grade: "Grade 8", status: "Active" },
  { id: "NYS-2026-002", name: "Demo Learner Two", level: "Primary School", grade: "Grade 5", status: "Active" },
  { id: "NYS-2026-003", name: "Demo Learner Three", level: "Senior School", grade: "Grade 10", status: "Pending" },
];
const initialTeachers = [
  { id: "T-001", name: "Demo Teacher One", subject: "Mathematics", classes: "Grade 7, Grade 8" },
  { id: "T-002", name: "Demo Teacher Two", subject: "English", classes: "Grade 4, Grade 5" },
];
const initialMaterials = [
  { title: "Introduction to Fractions", subject: "Mathematics", grade: "Grade 5", type: "PDF notes", updated: "12 Oct 2026" },
  { title: "The Water Cycle", subject: "Integrated Science", grade: "Grade 7", type: "Lesson notes", updated: "10 Oct 2026" },
  { title: "Creative Arts: Careers", subject: "Creative Arts", grade: "Grade 9", type: "Presentation", updated: "08 Oct 2026" },
];
const initialExams = [
  { title: "Term 3 Mathematics Assessment", grade: "Grade 8", date: "2026-11-03", status: "Scheduled" },
  { title: "English End-Term Exam", grade: "Grade 5", date: "2026-11-05", status: "Scheduled" },
];
const initialResults = [
  { learner: "Demo Learner One", grade: "Grade 8", subject: "Mathematics", score: 78, outOf: 100, term: "Term 3" },
  { learner: "Demo Learner Two", grade: "Grade 5", subject: "English", score: 84, outOf: 100, term: "Term 3" },
  { learner: "Demo Learner Three", grade: "Grade 10", subject: "Biology", score: 72, outOf: 100, term: "Term 3" },
];
const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "learners", label: "Learners", icon: GraduationCap },
  { id: "teachers", label: "Teachers", icon: Users },
  { id: "materials", label: "Learning materials", icon: BookOpen },
  { id: "exams", label: "Examinations", icon: ClipboardList },
  { id: "results", label: "Results", icon: ChartNoAxesCombined },
];

const schoolLevelFor = (grade) => {
  if (grade === "PP1" || grade === "PP2" || /^Grade [1-6]$/.test(grade)) return "Primary School";
  if (/^Grade [7-9]$/.test(grade)) return "Junior School";
  return "Senior School";
};
const friendlyDbError = (error) => {
  const msg = error?.message || "Unknown database error";
  if (/row-level security|permission denied|not allowed/i.test(msg)) return "The database denied this action. Check the user's role and Row Level Security policies.";
  if (/relation .* does not exist|schema cache/i.test(msg)) return "Database tables are missing. Run the supplied Supabase SQL schema first.";
  return msg;
};
const dateOnly = (value) => value ? String(value).slice(0, 10) : new Date().toISOString().slice(0, 10);

function App() {
  const [page, setPage] = useState("overview");
  const [role, setRole] = useState("Administrator");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [learners, setLearners] = useState(supabase ? [] : initialLearners);
  const [teachers, setTeachers] = useState(supabase ? [] : initialTeachers);
  const [materials, setMaterials] = useState(supabase ? [] : initialMaterials);
  const [exams, setExams] = useState(supabase ? [] : initialExams);
  const [results, setResults] = useState(supabase ? [] : initialResults);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [authChecking, setAuthChecking] = useState(Boolean(supabase));
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState("");

  // Restore an existing session and derive access only from the trusted profile row.
  useEffect(() => {
    if (!supabase) { setAuthChecking(false); return; }
    let active = true;
    const applySession = async (session) => {
      if (!session?.user) {
        if (active) { setLoggedIn(false); setAuthChecking(false); }
        return;
      }
      const { data: profile, error } = await supabase
        .from("profiles").select("full_name, role").eq("id", session.user.id).single();
      if (!active) return;
      if (error || !profile || !["Administrator", "Teacher", "Learner"].includes(profile.role)) {
        await supabase.auth.signOut();
        setLoggedIn(false);
        setLoginError("Your school profile is not ready. Please contact the school administrator.");
      } else {
        setLoginEmail(session.user.email || "");
        setRole(profile.role);
        setLoggedIn(true);
      }
      setAuthChecking(false);
    };
    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer profile queries until after the auth callback completes.
      Promise.resolve().then(() => applySession(session));
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  // Load persisted school records after a verified Supabase sign-in. When connected,
  // never silently mix demo records with real records.
  useEffect(() => {
    if (!supabase || !loggedIn) return;
    let cancelled = false;
    async function loadRecords() {
      setDbLoading(true);
      setDbError("");
      const requests = await Promise.all([
        supabase.from("learners").select("id, admission_number, full_name, school_level, grade, status").order("created_at", { ascending: false }),
        supabase.from("teachers").select("id, staff_number, full_name, subjects, assigned_grades").order("created_at", { ascending: false }),
        supabase.from("learning_materials").select("id, title, subject, grade, resource_type, published, created_at, school_level").order("created_at", { ascending: false }),
        supabase.from("exams").select("id, title, subject, grade, exam_date, status, max_score, school_level").order("exam_date", { ascending: true }),
        supabase.from("results").select("id, score, exam_id, learner_id, teacher_comment, published_at, learners(full_name, grade, admission_number), exams(title, subject, exam_date, max_score)").order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      const errors = requests.filter(r => r.error);
      if (errors.length) {
        setDbError(friendlyDbError(errors[0].error));
        setLearners([]); setTeachers([]); setMaterials([]); setExams([]); setResults([]);
      } else {
        const [lr, tr, mr, er, rr] = requests.map(r => r.data || []);
        setLearners(lr.map(x => ({ dbId:x.id, id:x.admission_number, name:x.full_name, level:x.school_level, grade:x.grade, status:x.status })));
        setTeachers(tr.map(x => ({ dbId:x.id, id:x.staff_number, name:x.full_name, subject:(x.subjects||[]).join(", ") || "Not assigned", classes:(x.assigned_grades||[]).join(", ") || "Not assigned" })));
        setMaterials(mr.map(x => ({ dbId:x.id, title:x.title, subject:x.subject, grade:x.grade, type:x.resource_type, updated:dateOnly(x.created_at), published:x.published, storagePath:x.storage_path })));
        setExams(er.map(x => ({ dbId:x.id, title:x.title, subject:x.subject, grade:x.grade, date:dateOnly(x.exam_date), status:x.status, outOf:Number(x.max_score) })));
        setResults(rr.map(x => ({ dbId:x.id, learner:x.learners?.full_name || "Learner", learnerId:x.learner_id, grade:x.learners?.grade || "—", subject:x.exams?.subject || "—", score:Number(x.score), outOf:Number(x.exams?.max_score || 100), term:(x.exams?.title || "Assessment").split(" - ")[0], published:Boolean(x.published_at) })));
      }
      setDbLoading(false);
    }
    loadRecords().catch(error => { if (!cancelled) { setDbError(friendlyDbError(error)); setDbLoading(false); } });
    return () => { cancelled = true; };
  }, [loggedIn, role]);

  const visibleNav = navItems.filter(item => {
    if (role === "Learner") return ["overview", "materials", "exams", "results"].includes(item.id);
    if (role === "Teacher") return item.id !== "teachers";
    return true;
  });

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3600);
  };

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    if (!supabase) {
      setLoginError("Live sign-in is not configured yet. Connect Supabase using the setup guide; this preview uses demo mode.");
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (error) {
      setLoginError("Sign-in failed. Check your details or contact the school administrator.");
      return;
    }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("full_name, role").eq("id", data.user.id).single();
    if (profileError || !profile || !["Administrator", "Teacher", "Learner"].includes(profile.role)) {
      await supabase.auth.signOut();
      setLoginError("Your school profile is missing or invalid. Please contact the school administrator.");
      return;
    }
    setRole(profile.role);
    setLoggedIn(true);
    setPage("overview");
    showNotice("Signed in successfully.");
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    setLoggedIn(false);
    setRole("Learner");
    setLoginEmail("");
    setLoginPassword("");
    setPage("overview");
    showNotice("You have signed out.");
  }

  const filteredLearners = useMemo(() => learners.filter(x => `${x.name} ${x.id} ${x.grade}`.toLowerCase().includes(search.toLowerCase())), [learners, search]);
  const filteredMaterials = useMemo(() => materials.filter(x => `${x.title} ${x.subject} ${x.grade}`.toLowerCase().includes(search.toLowerCase())), [materials, search]);

  async function addLearner(data) {
    if (!supabase) {
      setLearners(old => [{ id: `NYS-${new Date().getFullYear()}-${String(old.length + 1).padStart(3, "0")}`, ...data, status: "Pending" }, ...old]);
      setModal(null); showNotice("Saved in preview only. Configure Supabase for permanent records."); return;
    }
    const admissionNumber = `NYS-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const { data: row, error } = await supabase.from("learners").insert({ admission_number: admissionNumber, full_name: data.name.trim(), school_level: schoolLevelFor(data.grade), grade: data.grade, date_of_birth:data.dateOfBirth || null, guardian_name:data.guardianName?.trim() || null, guardian_relationship:data.guardianRelationship?.trim() || null, guardian_phone:data.guardianPhone?.trim() || null, guardian_email:data.guardianEmail?.trim() || null, home_area:data.homeArea?.trim() || null, status: "Pending" }).select("id, admission_number, full_name, school_level, grade, status").single();
    if (error) { showNotice(`Could not save learner: ${friendlyDbError(error)}`); return; }
    setLearners(old => [{ dbId:row.id, id:row.admission_number, name:row.full_name, level:row.school_level, grade:row.grade, status:row.status }, ...old]);
    setModal(null); showNotice("Learner record saved to Supabase.");
  }
  async function addTeacher(data) {
    if (!supabase) { setTeachers(old => [{ id: `T-${String(old.length + 1).padStart(3, "0")}`, ...data }, ...old]); setModal(null); showNotice("Saved in preview only. Configure Supabase for permanent records."); return; }
    const staffNumber = `NYS-T-${Date.now().toString().slice(-6)}`;
    const { data: row, error } = await supabase.from("teachers").insert({ staff_number:staffNumber, full_name:data.name.trim(), subjects:[data.subject || "General"], assigned_grades:(data.classes || "").split(",").map(x=>x.trim()).filter(Boolean) }).select("id, staff_number, full_name, subjects, assigned_grades").single();
    if (error) { showNotice(`Could not save teacher: ${friendlyDbError(error)}`); return; }
    setTeachers(old => [{ dbId:row.id, id:row.staff_number, name:row.full_name, subject:row.subjects.join(", "), classes:row.assigned_grades.join(", ") || "Not assigned" }, ...old]);
    setModal(null); showNotice("Teacher directory record saved to Supabase. This does not create a login account.");
  }
  async function addMaterial(data) {
    if (!supabase) { setMaterials(old => [{ ...data, type:data.type || "Learning resource", updated:"Today" }, ...old]); setModal(null); showNotice("Saved in preview only."); return; }
    const { data: auth } = await supabase.auth.getUser();
    const { data: row, error } = await supabase.from("learning_materials").insert({ title:data.title.trim(), subject:data.subject.trim(), school_level:schoolLevelFor(data.grade), grade:data.grade, resource_type:data.type || "Learning resource", uploaded_by:auth.user?.id, published:role === "Administrator" }).select("id, title, subject, grade, resource_type, published, created_at").single();
    if (error) { showNotice(`Could not save material: ${friendlyDbError(error)}`); return; }
    setMaterials(old => [{ dbId:row.id, title:row.title, subject:row.subject, grade:row.grade, type:row.resource_type, published:row.published, updated:dateOnly(row.created_at) }, ...old]);
    setModal(null); showNotice(row.published ? "Learning material saved and published." : "Learning material saved as a draft for administrator review.");
  }
  async function addExam(data) {
    if (!supabase) { setExams(old => [{ ...data, status:"Scheduled" }, ...old]); setModal(null); showNotice("Saved in preview only."); return; }
    const { data: auth } = await supabase.auth.getUser();
    const { data: row, error } = await supabase.from("exams").insert({ title:data.title.trim(), subject:(data.subject || "General").trim(), school_level:schoolLevelFor(data.grade), grade:data.grade, exam_date:data.date, max_score:Number(data.outOf || 100), status:"Scheduled", created_by:auth.user?.id }).select("id, title, subject, grade, exam_date, status, max_score").single();
    if (error) { showNotice(`Could not save examination: ${friendlyDbError(error)}`); return; }
    setExams(old => [{ dbId:row.id, title:row.title, subject:row.subject, grade:row.grade, date:row.exam_date, status:row.status, outOf:Number(row.max_score) }, ...old]);
    setModal(null); showNotice("Examination saved to Supabase.");
  }
  async function addResult(data) {
    if (!supabase) { setResults(old => [{ ...data, score:Number(data.score), outOf:Number(data.outOf || 100) }, ...old]); setModal(null); showNotice("Saved in preview only."); return; }
    const score = Number(data.score), outOf = Number(data.outOf || 100);
    if (!Number.isFinite(score) || !Number.isFinite(outOf) || outOf <= 0 || score < 0 || score > outOf) { showNotice("Enter a valid score between zero and the maximum mark."); return; }
    const learner = learners.find(x => x.name === data.learner && x.grade === data.grade);
    if (!learner?.dbId) { showNotice("The selected learner has no matching saved database record in this grade."); return; }
    let exam = exams.find(x => x.dbId && x.grade === data.grade && x.subject?.toLowerCase() === data.subject.trim().toLowerCase());
    if (!exam) {
      const { data: auth } = await supabase.auth.getUser();
      const created = await supabase.from("exams").insert({ title:`${data.term} - ${data.subject.trim()} Assessment`, subject:data.subject.trim(), school_level:schoolLevelFor(data.grade), grade:data.grade, exam_date:dateOnly(), max_score:outOf, status:"Completed", created_by:auth.user?.id }).select("id, title, subject, grade, exam_date, status, max_score").single();
      if (created.error) { showNotice(`Could not create assessment: ${friendlyDbError(created.error)}`); return; }
      exam = { dbId:created.data.id, title:created.data.title, subject:created.data.subject, grade:created.data.grade, date:created.data.exam_date, status:created.data.status, outOf:Number(created.data.max_score) };
      setExams(old => [exam, ...old]);
    }
    const actualOutOf = Number(exam.outOf || outOf);
    if (score > actualOutOf) { showNotice(`The score cannot exceed this examination's maximum mark (${actualOutOf}).`); return; }
    const { data: auth } = await supabase.auth.getUser();
    const { data: row, error } = await supabase.from("results").upsert({ exam_id:exam.dbId, learner_id:learner.dbId, score, entered_by:auth.user?.id }, { onConflict:"exam_id,learner_id" }).select("id, score, exam_id, learner_id").single();
    if (error) { showNotice(`Could not save result: ${friendlyDbError(error)}`); return; }
    setResults(old => [{ dbId:row.id, learner:learner.name, learnerId:learner.dbId, grade:learner.grade, subject:exam.subject, score:Number(row.score), outOf:actualOutOf, term:data.term, published:false }, ...old.filter(x => !(x.learnerId === learner.dbId && x.subject === exam.subject))]);
    setModal(null); showNotice("Examination result saved as unpublished. Publish it only after school review.");
  }


  async function publishResult(result) {
    if (!supabase || role !== "Administrator" || !result.dbId) {
      showNotice("Only an administrator can publish a saved result."); return;
    }
    const { error } = await supabase.from("results").update({ published_at:new Date().toISOString() }).eq("id", result.dbId);
    if (error) { showNotice(`Could not publish result: ${friendlyDbError(error)}`); return; }
    setResults(old => old.map(x => x.dbId === result.dbId ? { ...x, published:true } : x));
    showNotice("Result published to the linked learner account.");
  }

  if (window.location.pathname === "/admissions") return <AdmissionsPage />;

  if (authChecking) return <div className="login-page"><section className="login-card"><h2>Checking secure session…</h2><p className="muted">Please wait while NYAMWERU SCHOOL verifies your account.</p></section></div>;

  if (!loggedIn) {
    return <LoginScreen onLogin={handleLogin} role={role} setRole={setRole} email={loginEmail} setEmail={setLoginEmail}
      password={loginPassword} setPassword={setLoginPassword} error={loginError} />;
  }

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><School size={25} /></div>
          <div><strong>NYAMWERU</strong><span>SCHOOL PORTAL</span></div>
          <button className="icon-btn sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={19}/></button>
        </div>
        <div className="school-chip"><span className="status-dot"/><span>School workspace</span><ChevronDown size={15}/></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav">
          {visibleNav.map(item => {
            const Icon = item.icon;
            return <button key={item.id} className={`nav-link ${page === item.id ? "active" : ""}`} onClick={() => { setPage(item.id); setSidebarOpen(false); setSearch(""); }}>
              <Icon size={18}/><span>{item.label}</span>{item.id === "learners" && <span className="nav-count">{learners.length}</span>}
            </button>;
          })}
        </nav>
        {role === "Administrator" && <div className="sidebar-bottom">
          <div className="nav-label">ADMINISTRATION</div>
          <button className="nav-link" onClick={() => showNotice("Settings will be available after secure backend setup.")}><Settings size={18}/><span>Settings</span></button>
          <div className="help-card"><div className="help-icon"><CircleHelp size={18}/></div><strong>Need help?</strong><p>Ask your school administrator for portal support.</p></div>
        </div>}
        <div className="sidebar-user">
          <div className="avatar avatar-navy">{role === "Administrator" ? "AD" : role === "Teacher" ? "TC" : "LR"}</div>
          <div className="user-copy"><strong>{role}</strong><span>{loggedIn ? loginEmail : "Preview account"}</span></div>
          <button className="icon-btn" onClick={logout} title="Sign out"><LogOut size={17}/></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={21}/></button>
            <div className="breadcrumb"><span>School portal</span><span className="crumb-slash">/</span><strong>{navItems.find(x => x.id === page)?.label || "Overview"}</strong></div>
          </div>
          <div className="top-actions">
            <label className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search this page..." aria-label="Search current page"/></label>
            <button className="icon-btn notification-btn" onClick={() => showNotice("You are all caught up.")} aria-label="Notifications"><Bell size={19}/><span/></button>
            <div className="top-avatar">{role === "Administrator" ? "AD" : role === "Teacher" ? "TC" : "LR"}</div>
          </div>
        </header>

        <div className="content">
          {supabase && <div className={`info-banner ${dbError ? "" : ""}`} style={{marginBottom:18}}><ShieldCheck size={18}/><div><strong>{dbError ? "Database connection needs attention" : dbLoading ? "Loading school records…" : "Supabase-connected workspace"}</strong><p>{dbError || (dbLoading ? "Retrieving authorised records from the database." : "Lists below are loaded from the connected database. Actions save through your signed-in account and database policies.")}</p></div></div>}
          {!supabase && <div className="info-banner" style={{marginBottom:18}}><ShieldCheck size={18}/><div><strong>Preview mode</strong><p>Supabase is not configured in this deployment. Records are temporary and are not saved between refreshes.</p></div></div>}
          {page === "overview" && <Overview role={role} learners={learners} teachers={teachers} materials={materials} exams={exams} results={results} setPage={setPage} setModal={setModal} />}
          {page === "learners" && <LearnersPage learners={filteredLearners} role={role} setModal={setModal} showNotice={showNotice} />}
          {page === "teachers" && <TeachersPage teachers={teachers} setModal={setModal} showNotice={showNotice} />}
          {page === "materials" && <MaterialsPage materials={filteredMaterials} role={role} setModal={setModal} showNotice={showNotice} />}
          {page === "exams" && <ExamsPage exams={exams} role={role} setModal={setModal} showNotice={showNotice} />}
          {page === "results" && <ResultsPage results={results} role={role} setModal={setModal} showNotice={showNotice} onPublish={publishResult} />}
          <footer className="footer"><span>© {new Date().getFullYear()} NYAMWERU SCHOOL</span><span>Learn • Grow • Succeed</span><span className="demo-tag"><span className="status-dot"/> Prototype</span></footer>
        </div>
      </main>
      {modal && <Modal type={modal} onClose={() => setModal(null)} onAddLearner={addLearner} onAddTeacher={addTeacher} onAddMaterial={addMaterial} onAddExam={addExam} onAddResult={addResult} learners={learners} />}
      {notice && <div className="toast"><CheckCircle2 size={18}/>{notice}</div>}
    </div>
  );
}

function LoginScreen({ onLogin, role, setRole, email, setEmail, password, setPassword, error }) {
  return <div className="login-page">
    <div className="login-decoration decoration-one"/><div className="login-decoration decoration-two"/>
    <section className="login-brand-panel">
      <div className="login-brand"><div className="brand-mark large"><School size={29}/></div><div><strong>NYAMWERU SCHOOL</strong><span>LEARN • GROW • SUCCEED</span></div></div>
      <div className="login-message"><span className="eyebrow light"><Sparkles size={14}/> YOUR LEARNING JOURNEY</span><h1>Every learner.<br/><em>Every possibility.</em></h1><p>A connected school community for teaching, learning and academic progress.</p>
        <div className="login-benefits"><div><BookOpen size={18}/><span>Learning resources in one place</span></div><div><ChartNoAxesCombined size={18}/><span>Progress you can follow</span></div><div><ShieldCheck size={18}/><span>Secure, role-based access</span></div></div>
      </div>
      <div className="login-panel-footer">A school community built for success.</div>
    </section>
    <section className="login-form-panel">
      <div className="login-mobile-brand"><div className="brand-mark"><School size={24}/></div><strong>NYAMWERU SCHOOL</strong></div>
      <form className="login-card" onSubmit={onLogin}>
        <div className="welcome-icon"><LockKeyhole size={23}/></div><span className="eyebrow">SCHOOL PORTAL</span><h2>Welcome back</h2><p className="muted">Sign in to access your school workspace.</p>
        <div className="demo-note" style={{marginBottom:16}}><strong>Secure access</strong><p>Your role is assigned by an authorised school administrator after your account is created. You cannot choose or change your role on this screen.</p></div>
        <label className="field-label" htmlFor="email">Email address</label>
        <input id="email" className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@school.ac.ke" required/>
        <label className="field-label" htmlFor="password">Password</label>
        <input id="password" className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required/>
        {error && <div className="login-error">{error}</div>}
        <button className="primary-btn login-submit" type="submit"><LogIn size={17}/> Sign in securely <ArrowRight size={17}/></button>
        <div className="login-security"><ShieldCheck size={15}/><span>Your account should only access information authorised for your role.</span></div>
        <p className="muted" style={{textAlign:"center",margin:"16px 0 0"}}>New learner? <a href="/admissions">Apply for admission online</a></p>
        <div className="demo-note"><strong>Account access</strong><p>Use an account created and approved by the school administrator. If your account is not ready, contact the administrator.</p></div>
      </form>
      <div className="login-copyright">© {new Date().getFullYear()} NYAMWERU SCHOOL. All rights reserved.</div>
    </section>
  </div>;
}

function PageHeading({ eyebrow, title, description, action, actionLabel, onAction }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <button className="primary-btn" onClick={onAction}><Plus size={17}/>{actionLabel}</button>}</div>;
}

function Overview({ role, learners, teachers, materials, exams, results, setPage, setModal }) {
  const upcoming = [...exams].sort((a,b) => a.date.localeCompare(b.date)).slice(0,3);
  const average = results.length ? Math.round(results.reduce((s,r) => s + (r.score / r.outOf * 100), 0) / results.length) : 0;
  return <div className="fade-in">
    <div className="welcome-banner"><div className="welcome-copy"><div className="eyebrow light"><span className="status-dot"/> SCHOOL OVERVIEW</div><h1>Good day, {role === "Administrator" ? "Administrator" : role} <span className="wave">✦</span></h1><p>Here’s what’s happening at NYAMWERU SCHOOL today.</p><div className="banner-meta"><span><CalendarDays size={15}/> {new Date().toLocaleDateString("en-KE", {weekday:"long", day:"numeric", month:"long", year:"numeric"})}</span><span><ShieldCheck size={15}/> {role} workspace</span></div></div><div className="banner-illustration"><div className="illustration-circle"><BookMarked size={50}/></div><div className="float-badge badge-top"><CheckCircle2 size={15}/> Keep learning</div><div className="float-badge badge-bottom"><Sparkles size={15}/> Aim high</div></div></div>
    <div className="section-title-row"><div><h2>At a glance</h2><p>Your school’s key figures and activity.</p></div><span className="updated-label"><Activity size={14}/> Overview</span></div>
    <div className="stats-grid">
      <StatCard label="Registered learners" value={learners.length} note="Across all school levels" icon={GraduationCap} color="blue" trend="Learner records"/>
      <StatCard label="Teachers" value={teachers.length} note="Teaching team records" icon={Users} color="purple" trend="Staff directory"/>
      <StatCard label="Learning resources" value={materials.length} note="Materials in the portal" icon={BookOpen} color="green" trend="Learning library"/>
      <StatCard label="Examinations" value={exams.length} note="Scheduled assessments" icon={ClipboardList} color="orange" trend="Exam calendar"/>
    </div>
    <div className="overview-grid">
      <section className="panel activity-panel"><div className="panel-heading"><div><h3>Quick actions</h3><p>Jump straight into common tasks.</p></div><Sparkles size={19} className="subtle-icon"/></div><div className="quick-actions">
        {role === "Administrator" && <QuickAction icon={GraduationCap} title="Enrol a learner" description="Create a learner record" onClick={() => setModal("learner")} color="blue"/>}
        {role !== "Learner" && <QuickAction icon={Users} title="Add a teacher" description="Update the staff directory" onClick={() => setModal("teacher")} color="purple"/>}
        <QuickAction icon={BookOpen} title="Add learning material" description="Share notes and resources" onClick={() => setModal("material")} color="green"/>
        {role !== "Learner" && <QuickAction icon={ClipboardList} title="Schedule an exam" description="Add an assessment" onClick={() => setModal("exam")} color="orange"/>}
        {role !== "Learner" && <QuickAction icon={ChartNoAxesCombined} title="Enter results" description="Record learner marks" onClick={() => setModal("result")} color="blue"/>}
      </div></section>
      <section className="panel upcoming-panel"><div className="panel-heading"><div><h3>Upcoming examinations</h3><p>Keep important dates in view.</p></div><button className="text-link" onClick={() => setPage("exams")}>View all <ArrowRight size={15}/></button></div>
        {upcoming.length ? <div className="exam-list">{upcoming.map((exam,i) => <div className="exam-row" key={exam.title+i}><div className="date-tile"><span>{new Date(exam.date+"T12:00:00").toLocaleDateString("en-KE",{month:"short"})}</span><strong>{new Date(exam.date+"T12:00:00").getDate()}</strong></div><div className="exam-info"><strong>{exam.title}</strong><span>{exam.grade} · {exam.status}</span></div><ArrowRight size={16} className="exam-arrow"/></div>)}</div> : <EmptyState title="No exams scheduled" text="Add an exam to start building the school calendar."/>}
      </section>
    </div>
    <div className="overview-grid lower-grid">
      <section className="panel"><div className="panel-heading"><div><h3>Learning library</h3><p>Recently added learning resources.</p></div><button className="text-link" onClick={() => setPage("materials")}>Open library <ArrowRight size={15}/></button></div>
        <div className="resource-list">{materials.slice(0,3).map((m,i) => <div className="resource-row" key={m.title+i}><div className={`resource-icon resource-${i%3}`}><FileText size={19}/></div><div className="resource-info"><strong>{m.title}</strong><span>{m.subject} · {m.grade}</span></div><span className="resource-type">{m.type}</span></div>)}</div>
      </section>
      <section className="panel performance-panel"><div className="panel-heading"><div><h3>Academic snapshot</h3><p>Based on the records available to your account.</p></div><ChartNoAxesCombined size={19} className="subtle-icon"/></div><div className="performance-score"><div className="score-ring" style={{"--score":`${average}%`}}><div><strong>{average}%</strong><span>Average</span></div></div><div className="performance-copy"><strong>{results.length} result records</strong><p>Results available to your signed-in role.</p><button className="text-link" onClick={() => setPage("results")}>View results <ArrowRight size={15}/></button></div></div><div className="privacy-note"><ShieldCheck size={15}/><span>Only authorised users should access individual learner results.</span></div></section>
    </div>
  </div>;
}

function StatCard({ label, value, note, icon: Icon, color, trend }) {
  return <div className="stat-card"><div className="stat-top"><div className={`stat-icon ${color}`}><Icon size={21}/></div><span className="stat-kicker">{trend}</span></div><div className="stat-value">{value}</div><div className="stat-label">{label}</div><div className="stat-note">{note}</div></div>;
}
function QuickAction({ icon: Icon, title, description, onClick, color }) {
  return <button className="quick-action" onClick={onClick}><div className={`quick-icon ${color}`}><Icon size={19}/></div><div><strong>{title}</strong><span>{description}</span></div><ArrowRight size={16} className="quick-arrow"/></button>;
}
function EmptyState({ title, text }) { return <div className="empty-state"><BookOpen size={26}/><strong>{title}</strong><p>{text}</p></div>; }

function LearnersPage({ learners, role, setModal, showNotice }) {
  return <div className="fade-in"><PageHeading eyebrow="LEARNER MANAGEMENT" title="Learners" description="Manage learner enrolment across primary, junior and senior school." action={role === "Administrator" ? "Enrol learner" : null} actionLabel="Enrol learner" onAction={() => setModal("learner")}/>
    <div className="filter-bar"><div className="filter-description"><Users size={17}/><span><strong>{learners.length} learners</strong> shown in this view</span></div><span className="soft-pill"><span className="status-dot"/> Database records</span></div>
    <div className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>Learner</th><th>Admission number</th><th>School level</th><th>Grade</th><th>Status</th><th>Action</th></tr></thead><tbody>{learners.map(l => <tr key={l.id}><td><div className="person-cell"><div className="avatar avatar-blue">{l.name.split(" ").map(x=>x[0]).slice(0,2).join("")}</div><strong>{l.name}</strong></div></td><td className="mono">{l.id}</td><td>{l.level}</td><td>{l.grade}</td><td><span className={`status-pill ${l.status==="Active"?"active":"pending"}`}>{l.status}</span></td><td><button className="small-action" onClick={() => showNotice(`Selected ${l.name}. Detailed profile view is not included in this release.`)}><Eye size={15}/> View</button></td></tr>)}</tbody></table></div>{learners.length===0 && <EmptyState title="No matching learners" text="Try a different search term or register a learner."/>}</div>
    <div className="info-banner"><ShieldCheck size={18}/><div><strong>Enrolment and privacy</strong><p>In the live portal, new enrolments should be reviewed by authorised staff before learner accounts and admission numbers are activated.</p></div></div>
  </div>;
}

function TeachersPage({ teachers, setModal, showNotice }) {
  return <div className="fade-in"><PageHeading eyebrow="STAFF DIRECTORY" title="Teachers" description="Keep teacher details, subjects and class assignments organised." action="Add teacher" actionLabel="Add teacher" onAction={() => setModal("teacher")}/>
    <div className="teacher-grid">{teachers.map(t => <div className="panel teacher-card" key={t.id}><div className="teacher-card-top"><div className="avatar avatar-purple">{t.name.split(" ").map(x=>x[0]).slice(0,2).join("")}</div><span className="status-pill active">Listed</span></div><h3>{t.name}</h3><p className="teacher-id">{t.id}</p><div className="teacher-detail"><BookOpen size={16}/><span>{t.subject}</span></div><div className="teacher-detail"><GraduationCap size={16}/><span>{t.classes}</span></div><button className="secondary-btn full-btn" onClick={() => showNotice(`Selected ${t.name}. Account setup requires an administrator and secure backend.`)}>View teacher details <ArrowRight size={15}/></button></div>)}</div>
    <div className="info-banner"><LockKeyhole size={18}/><div><strong>Account security</strong><p>Teacher accounts should be created through a secure invitation or administrator-approved process—not by exposing passwords in the staff directory.</p></div></div>
  </div>;
}

function MaterialsPage({ materials, role, setModal, showNotice }) {
  return <div className="fade-in"><PageHeading eyebrow="TEACHING & LEARNING" title="Learning materials" description="Organise notes, presentations and other learning resources by subject and grade." action={role !== "Learner" ? "Add material" : null} actionLabel="Add material" onAction={() => setModal("material")}/>
    <div className="material-filters"><div className="filter-description"><BookOpen size={17}/><span><strong>{materials.length} resources</strong> in this view</span></div><span className="soft-pill">All school levels</span></div>
    <div className="materials-grid">{materials.map((m,i)=><article className="panel material-card" key={m.title+i}><div className={`material-cover cover-${i%4}`}><div className="cover-top"><span>{m.grade}</span><BookMarked size={24}/></div><div className="cover-lines"><i/><i/><i/></div><div className="cover-bottom">{m.subject}</div></div><div className="material-card-body"><span className="eyebrow">{m.type}</span><h3>{m.title}</h3><p>{m.subject} · {m.grade}</p><div className="material-card-footer"><span><Clock3 size={14}/>{m.updated}</span><button className="small-action" onClick={() => showNotice("This demo record has no attached file. Configure secure file storage to enable downloads.")}><Eye size={15}/> Open</button></div></div></article>)}</div>
    <div className="info-banner"><Upload size={18}/><div><strong>File uploads</strong><p>This prototype records resource details. Enable secure storage and file-type/size validation before allowing real PDF, image or video uploads.</p></div></div>
  </div>;
}

function ExamsPage({ exams, role, setModal, showNotice }) {
  const sorted = [...exams].sort((a,b)=>a.date.localeCompare(b.date));
  return <div className="fade-in"><PageHeading eyebrow="ASSESSMENT CENTRE" title="Examinations" description="Plan assessments and keep school examination dates in one place." action={role !== "Learner" ? "Schedule exam" : null} actionLabel="Schedule exam" onAction={() => setModal("exam")}/>
    <div className="exam-summary-grid"><div className="summary-box"><CalendarDays size={19}/><div><span>Total exams</span><strong>{exams.length}</strong></div></div><div className="summary-box"><Clock3 size={19}/><div><span>Scheduled</span><strong>{exams.filter(x=>x.status==="Scheduled").length}</strong></div></div><div className="summary-box"><ClipboardList size={19}/><div><span>School levels</span><strong>3</strong></div></div></div>
    <div className="panel table-panel"><div className="panel-heading padded"><div><h3>Examination calendar</h3><p>Upcoming and planned assessments.</p></div></div><div className="table-wrap"><table><thead><tr><th>Examination</th><th>Grade</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody>{sorted.map((e,i)=><tr key={e.title+i}><td><div className="person-cell"><div className="exam-mini-icon"><ClipboardList size={17}/></div><strong>{e.title}</strong></div></td><td>{e.grade}</td><td>{new Date(e.date+"T12:00:00").toLocaleDateString("en-KE",{day:"numeric",month:"short",year:"numeric"})}</td><td><span className="status-pill scheduled">{e.status}</span></td><td><button className="small-action" onClick={() => showNotice("Exam detail and question-paper management are planned for a later release.")}><Eye size={15}/> Details</button></td></tr>)}</tbody></table></div>{!exams.length&&<EmptyState title="No examinations yet" text="Schedule an assessment to populate the calendar."/>}</div>
    <div className="info-banner"><ShieldCheck size={18}/><div><strong>Assessment integrity</strong><p>Only authorised teachers should create assessments and enter marks. Publish schedules and results after the school's approval process.</p></div></div>
  </div>;
}

function ResultsPage({ results, role, setModal, showNotice, onPublish }) {
  const [gradeFilter, setGradeFilter] = useState("All grades");
  const grades = ["All grades", ...new Set(results.map(r=>r.grade))];
  const shown = results.filter(r=>gradeFilter==="All grades"||r.grade===gradeFilter);
  return <div className="fade-in"><PageHeading eyebrow="ACADEMIC PERFORMANCE" title="Results" description={role==="Learner" ? "Review the results shared with your learner account." : "Record and review assessment outcomes and learner progress."} action={role !== "Learner" ? "Enter result" : null} actionLabel="Enter result" onAction={() => setModal("result")}/>
    <div className="results-toolbar"><div className="filter-description"><ChartNoAxesCombined size={17}/><span><strong>{shown.length} result records</strong> shown</span></div><select value={gradeFilter} onChange={e=>setGradeFilter(e.target.value)} aria-label="Filter by grade">{grades.map(g=><option key={g}>{g}</option>)}</select></div>
    <div className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>Learner</th><th>Grade</th><th>Subject</th><th>Term</th><th>Score</th><th>Progress</th>{role === "Administrator" && <th>Publication</th>}</tr></thead><tbody>{shown.map((r,i)=>{const pct=Math.round(r.score/r.outOf*100);return <tr key={r.learner+r.subject+i}><td><div className="person-cell"><div className="avatar avatar-green">{r.learner.split(" ").map(x=>x[0]).slice(0,2).join("")}</div><strong>{r.learner}</strong></div></td><td>{r.grade}</td><td>{r.subject}</td><td>{r.term}</td><td><strong>{r.score}</strong><span className="score-outof"> / {r.outOf}</span></td><td><div className="progress-cell"><div className="progress-track"><span style={{width:`${Math.max(0,Math.min(100,pct))}%`}}/></div><strong>{pct}%</strong></div></td>{role === "Administrator" && <td>{r.published ? <span className="status-pill active">Published</span> : r.dbId ? <button className="small-action" onClick={()=>onPublish(r)}><CheckCircle2 size={15}/> Publish</button> : <span className="status-pill pending">Preview</span>}</td>}</tr>})}</tbody></table></div>{!shown.length&&<EmptyState title="No results found" text="When results are available, they will appear here."/>}</div>
    <div className="info-banner"><LockKeyhole size={18}/><div><strong>Confidential learner records</strong><p>Individual results must be protected by server-side permissions. A live learner account should only receive its own authorised results, never the full school results list.</p></div></div>
  </div>;
}

function Modal({ type, onClose, onAddLearner, onAddTeacher, onAddMaterial, onAddExam, onAddResult, learners }) {
  const [form, setForm] = useState({});
  const update = (key,value) => setForm(old=>({...old,[key]:value}));
  const titles = { learner:"Enrol a learner", teacher:"Add a teacher", material:"Add learning material", exam:"Schedule an examination", result:"Enter examination result" };
  function submit(e) {
    e.preventDefault();
    if(type==="learner") onAddLearner({name:form.name,level:form.level||"Junior School",grade:form.grade||"Grade 7",dateOfBirth:form.dateOfBirth,guardianName:form.guardianName,guardianRelationship:form.guardianRelationship,guardianPhone:form.guardianPhone,guardianEmail:form.guardianEmail,homeArea:form.homeArea});
    if(type==="teacher") onAddTeacher({name:form.name,subject:form.subject||"General",classes:form.classes||"To be assigned"});
    if(type==="material") onAddMaterial({title:form.title,subject:form.subject||"General",grade:form.grade||"Grade 7",type:form.type||"Learning resource"});
    if(type==="exam") onAddExam({title:form.title,subject:form.subject||"General",outOf:form.outOf||100,grade:form.grade||"Grade 7",date:form.date||new Date().toISOString().slice(0,10)});
    if(type==="result") onAddResult({learner:form.learner||learners[0]?.name||"Learner",grade:form.grade||"Grade 7",subject:form.subject||"General",score:form.score||0,outOf:form.outOf||100,term:form.term||"Term 1"});
  }
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="eyebrow">NYAMWERU SCHOOL</span><h2 id="modal-title">{titles[type]}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
    <form onSubmit={submit} className="modal-form">
      {type==="learner" && <><Field label="Learner full name" required value={form.name||""} onChange={v=>update("name",v)} placeholder="Enter full name"/><Field label="Date of birth" type="date" value={form.dateOfBirth||""} onChange={v=>update("dateOfBirth",v)}/><Field label="School level" type="select" value={form.level||"Junior School"} onChange={v=>update("level",v)} options={["Primary School","Junior School","Senior School"]}/><Field label="Grade" type="select" value={form.grade||"Grade 7"} onChange={v=>update("grade",v)} options={["PP1","PP2",...Array.from({length:12},(_,i)=>`Grade ${i+1}`)]}/><div className="form-divider">Parent / guardian details</div><Field label="Parent / guardian name" value={form.guardianName||""} onChange={v=>update("guardianName",v)} placeholder="Full name"/><Field label="Relationship to learner" value={form.guardianRelationship||""} onChange={v=>update("guardianRelationship",v)} placeholder="e.g. Parent or guardian"/><Field label="Guardian phone" type="tel" value={form.guardianPhone||""} onChange={v=>update("guardianPhone",v)} placeholder="Phone number"/><Field label="Guardian email (optional)" type="email" value={form.guardianEmail||""} onChange={v=>update("guardianEmail",v)} placeholder="name@example.com"/><Field label="Home area (optional)" value={form.homeArea||""} onChange={v=>update("homeArea",v)} placeholder="Estate / village / area"/><p className="form-hint">This creates a pending learner record. The school must review and confirm the official admission number before activation.</p></>}
      {type==="teacher" && <><Field label="Teacher full name" required value={form.name||""} onChange={v=>update("name",v)} placeholder="Enter full name"/><Field label="Main subject" required value={form.subject||""} onChange={v=>update("subject",v)} placeholder="e.g. Mathematics"/><Field label="Classes assigned" value={form.classes||""} onChange={v=>update("classes",v)} placeholder="e.g. Grade 7, Grade 8"/><p className="form-hint">This creates a directory entry only. Account invitations should be handled securely.</p></>}
      {type==="material" && <><Field label="Resource title" required value={form.title||""} onChange={v=>update("title",v)} placeholder="e.g. Introduction to fractions"/><Field label="Subject" required value={form.subject||""} onChange={v=>update("subject",v)} placeholder="e.g. Mathematics"/><Field label="Grade" type="select" value={form.grade||"Grade 7"} onChange={v=>update("grade",v)} options={Array.from({length:12},(_,i)=>`Grade ${i+1}`)}/><Field label="Resource type" type="select" value={form.type||"PDF notes"} onChange={v=>update("type",v)} options={["PDF notes","Lesson notes","Presentation","Video","Assignment","Other"]}/><p className="form-hint">This prototype stores resource details only; upload a file after secure storage is configured.</p></>}
      {type==="exam" && <><Field label="Examination title" required value={form.title||""} onChange={v=>update("title",v)} placeholder="e.g. End-term Mathematics"/><Field label="Subject" required value={form.subject||""} onChange={v=>update("subject",v)} placeholder="e.g. Mathematics"/><Field label="Maximum mark" type="number" value={form.outOf||"100"} onChange={v=>update("outOf",v)} required/><Field label="Grade" type="select" value={form.grade||"Grade 7"} onChange={v=>update("grade",v)} options={Array.from({length:12},(_,i)=>`Grade ${i+1}`)}/><Field label="Examination date" type="date" required value={form.date||""} onChange={v=>update("date",v)}/></>}
      {type==="result" && <><Field label="Learner" type="select" value={form.learner||learners[0]?.name||""} onChange={v=>update("learner",v)} options={learners.map(l=>l.name)}/><Field label="Grade" type="select" value={form.grade||"Grade 7"} onChange={v=>update("grade",v)} options={Array.from({length:12},(_,i)=>`Grade ${i+1}`)}/><Field label="Subject" required value={form.subject||""} onChange={v=>update("subject",v)} placeholder="e.g. English"/><div className="form-row"><Field label="Score" type="number" required value={form.score??""} onChange={v=>update("score",v)} placeholder="0"/><Field label="Out of" type="number" value={form.outOf||"100"} onChange={v=>update("outOf",v)} placeholder="100"/></div><Field label="Term" type="select" value={form.term||"Term 1"} onChange={v=>update("term",v)} options={["Term 1","Term 2","Term 3"]}/><p className="form-hint">Confirm the score and maximum mark before saving. Live permissions and validation must be enforced on the server.</p></>}
      <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancel</button><button type="submit" className="primary-btn"><CheckCircle2 size={16}/> Save record</button></div>
    </form>
  </section></div>;
}
function Field({ label, value, onChange, placeholder, required=false, type="text", options=[] }) {
  return <label className="field-wrap"><span className="field-label">{label}{required&&<i> *</i>}</span>{type==="select"?<select className="form-input" value={value} onChange={e=>onChange(e.target.value)} required={required}>{options.map(o=><option key={o}>{o}</option>)}</select>:<input className="form-input" type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} required={required} min={type==="number"?0:undefined}/>}</label>;
}

createRoot(document.getElementById("root")).render(<App />);
