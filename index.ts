import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const grades = new Set(["PP1", "PP2", ...Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`)]);
const text = (v: unknown, max = 120) => typeof v === "string" ? v.trim().slice(0, max) : "";
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  try {
    const payload = await req.json();
    // Honeypot: quietly reject bots without writing any personal data.
    if (text(payload.website, 200)) return json(200, { application_number: "NYS-APP-RECEIVED" });

    const first = text(payload.learner_first_name);
    const last = text(payload.learner_last_name);
    const dob = text(payload.date_of_birth, 10);
    const grade = text(payload.requested_grade, 20);
    const guardian = text(payload.guardian_name);
    const relationship = text(payload.guardian_relationship, 40);
    const phone = text(payload.guardian_phone, 30);
    const email = text(payload.guardian_email, 254);
    if (!first || !last || !guardian || !phone || !relationship || !dob || !grades.has(grade)) return json(400, { error: "Please complete all required fields and select a valid grade." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(`${dob}T00:00:00Z`)) || new Date(`${dob}T00:00:00Z`) > new Date()) return json(400, { error: "Please enter a valid date of birth." });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: "Please enter a valid guardian email address." });
    if (!/^\+?[0-9 ()-]{7,25}$/.test(phone)) return json(400, { error: "Please enter a valid guardian phone number." });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json(500, { error: "Admission service is not configured." });
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
    const ipHash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
    const { data: allowed, error: limitError } = await admin.rpc("check_admission_rate_limit", { p_ip_hash: ipHash });
    if (limitError) { console.error("Rate limit check failed", limitError.message); return json(503, { error: "Admission service is temporarily unavailable." }); }
    if (!allowed) return json(429, { error: "Too many applications from this connection. Please try again later or contact the school office." });

    const applicationNumber = `NYS-APP-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { error: insertError } = await admin.from("admission_applications").insert({
      application_number: applicationNumber,
      learner_first_name: first,
      learner_last_name: last,
      date_of_birth: dob,
      gender: ["Female", "Male"].includes(text(payload.gender, 20)) ? text(payload.gender, 20) : null,
      requested_grade: grade,
      previous_school: text(payload.previous_school) || null,
      guardian_name: guardian,
      guardian_relationship: relationship,
      guardian_phone: phone,
      guardian_email: email || null,
      home_area: text(payload.home_area) || null,
      status: "Pending",
    });
    if (insertError) { console.error("Application insert failed", insertError.message); return json(500, { error: "We could not save the application. Please contact the school office." }); }
    return json(200, { application_number: applicationNumber });
  } catch (error) {
    console.error("Admission submission error", error instanceof Error ? error.message : "Unknown error");
    return json(400, { error: "Please check the form and try again." });
  }
});
