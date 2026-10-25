import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, CheckCircle2, GraduationCap, School, ShieldCheck } from "lucide-react";
import "./styles.css";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const client = url && key ? createClient(url, key) : null;
const grades = ["PP1", "PP2", ...Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`)];

export default function AdmissionsPage() {
  const [form, setForm] = useState({ learner_first_name: "", learner_last_name: "", date_of_birth: "", gender: "", requested_grade: "PP1", previous_school: "", guardian_name: "", guardian_relationship: "Parent", guardian_phone: "", guardian_email: "", home_area: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [application, setApplication] = useState("");
  const update = (key, value) => setForm(old => ({ ...old, [key]: value }));
  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      if (!client) throw new Error("Online applications are not configured yet. Please contact the school office.");
      const { data, error: invokeError } = await client.functions.invoke("submit-admission", { body: form });
      if (invokeError) throw new Error("We could not submit the application. Please try again later or contact the school office.");
      if (!data?.application_number) throw new Error("The application could not be confirmed. Please contact the school office before submitting again.");
      setApplication(data.application_number);
    } catch (e) { setError(e.message || "Submission failed. Please try again."); }
    finally { setBusy(false); }
  }
  if (application) return <div className="login-page"><section className="login-form-panel"><div className="login-card"><div className="welcome-icon"><CheckCircle2 size={24}/></div><span className="eyebrow">APPLICATION RECEIVED</span><h2>Thank you for applying</h2><p className="muted">Your application has been received for school review. Keep this reference number.</p><div className="demo-note"><strong>Application reference</strong><p style={{fontSize:18,color:"#17395e",fontWeight:800}}>{application}</p></div><p className="muted">The school will contact the parent or guardian using the details provided.</p><a className="secondary-btn" href="/">Return to school portal</a></div></section></div>;
  return <div className="login-page"><section className="login-form-panel" style={{paddingTop:24,paddingBottom:24}}><div className="login-card" style={{width:"min(100%,560px)"}}><a href="/" className="small-action" style={{marginBottom:18,textDecoration:"none"}}><ArrowLeft size={15}/> Back to portal</a><div className="login-mobile-brand" style={{display:"flex",marginBottom:20}}><div className="brand-mark"><School size={24}/></div><strong>NYAMWERU SCHOOL</strong></div><div className="welcome-icon"><GraduationCap size={24}/></div><span className="eyebrow">ONLINE ADMISSIONS · PP1–GRADE 12</span><h2>Apply for admission</h2><p className="muted">Complete the form below. The school office will review your application.</p><form className="modal-form" onSubmit={submit}>
    <div className="form-row"><Field label="Learner first name" required value={form.learner_first_name} onChange={v=>update("learner_first_name",v)} /><Field label="Learner last name" required value={form.learner_last_name} onChange={v=>update("learner_last_name",v)} /></div>
    <div className="form-row"><Field label="Date of birth" type="date" required value={form.date_of_birth} onChange={v=>update("date_of_birth",v)} /><Field label="Applying for grade" type="select" required value={form.requested_grade} onChange={v=>update("requested_grade",v)} options={grades}/></div>
    <div className="form-row"><Field label="Gender (optional)" type="select" value={form.gender} onChange={v=>update("gender",v)} options={["Prefer not to say","Female","Male"]}/><Field label="Previous school (optional)" value={form.previous_school} onChange={v=>update("previous_school",v)} /></div>
    <Field label="Parent / guardian full name" required value={form.guardian_name} onChange={v=>update("guardian_name",v)} />
    <div className="form-row"><Field label="Relationship" type="select" required value={form.guardian_relationship} onChange={v=>update("guardian_relationship",v)} options={["Parent","Guardian","Other caregiver"]}/><Field label="Parent / guardian phone" required value={form.guardian_phone} onChange={v=>update("guardian_phone",v)} placeholder="e.g. 07XX XXX XXX" /></div>
    <div className="form-row"><Field label="Email (optional)" type="email" value={form.guardian_email} onChange={v=>update("guardian_email",v)} /><Field label="Home area (optional)" value={form.home_area} onChange={v=>update("home_area",v)} /></div>
    <div aria-hidden="true" style={{position:"absolute",left:"-10000px",width:1,height:1,overflow:"hidden"}}><label>Leave this field empty<Field label="Website" value={form.website} onChange={v=>update("website",v)} /></label></div>
    <div className="login-security"><ShieldCheck size={15}/><span>Information is submitted for school admission review. Please provide only the details requested and read the school's privacy notice before submitting.</span></div>
    {error && <div className="login-error" role="alert">{error}</div>}
    <button className="primary-btn login-submit" type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit application"}</button>
  </form></div></section></div>;
}
function Field({ label, value, onChange, placeholder, required=false, type="text", options=[] }) {
  return <label className="field-wrap"><span className="field-label">{label}{required&&<i> *</i>}</span>{type==="select"?<select className="form-input" value={value} onChange={e=>onChange(e.target.value)} required={required}><option value="">Choose an option</option>{options.map(o=><option key={o} value={o==="Prefer not to say"?"":o}>{o}</option>)}</select>:<input className="form-input" type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} required={required} maxLength={type==="email"?254:120}/>}</label>;
}
