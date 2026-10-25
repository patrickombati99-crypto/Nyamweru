-- NYAMWERU SCHOOL Step 5: narrow teacher access to assigned grades and subjects.
-- Run this after schema.sql in Supabase SQL Editor. Link each teacher profile_id,
-- and populate subjects / assigned_grades accurately before allowing teacher access.


DROP POLICY IF EXISTS "Read published materials or staff drafts" ON public.learning_materials;
CREATE POLICY "Read published materials or staff drafts" ON public.learning_materials FOR SELECT TO authenticated
USING (
  published = true OR public.current_school_role() = 'Administrator'
  OR (public.current_school_role() = 'Teacher' AND EXISTS (
    SELECT 1 FROM public.teachers t WHERE t.profile_id = auth.uid()
      AND t.assigned_grades @> ARRAY[learning_materials.grade]
      AND t.subjects @> ARRAY[learning_materials.subject]
  ))
);

DROP POLICY IF EXISTS "Read exams by role" ON public.exams;
CREATE POLICY "Read exams by role" ON public.exams FOR SELECT TO authenticated
USING (
  public.current_school_role() = 'Administrator'
  OR (public.current_school_role() = 'Teacher' AND EXISTS (
    SELECT 1 FROM public.teachers t WHERE t.profile_id = auth.uid()
      AND t.assigned_grades @> ARRAY[exams.grade] AND t.subjects @> ARRAY[exams.subject]
  ))
  OR (public.current_school_role() = 'Learner' AND status IN ('Scheduled','Published'))
);

DROP POLICY IF EXISTS "Read learner records by role" ON public.learners;
CREATE POLICY "Read learner records by role" ON public.learners FOR SELECT TO authenticated
USING (
  public.current_school_role() = 'Administrator' OR profile_id = auth.uid()
  OR (public.current_school_role() = 'Teacher' AND EXISTS (
    SELECT 1 FROM public.teachers t WHERE t.profile_id = auth.uid()
      AND t.assigned_grades @> ARRAY[learners.grade]
  ))
);

DROP POLICY IF EXISTS "Staff manage materials" ON public.learning_materials;
CREATE POLICY "Staff manage materials" ON public.learning_materials FOR ALL TO authenticated
USING (
  public.current_school_role() = 'Administrator'
  OR (public.current_school_role() = 'Teacher' AND EXISTS (
    SELECT 1 FROM public.teachers t WHERE t.profile_id = auth.uid()
      AND t.assigned_grades @> ARRAY[learning_materials.grade]
      AND t.subjects @> ARRAY[learning_materials.subject]
  ))
)
WITH CHECK (
  public.current_school_role() = 'Administrator'
  OR (public.current_school_role() = 'Teacher' AND EXISTS (
    SELECT 1 FROM public.teachers t WHERE t.profile_id = auth.uid()
      AND t.assigned_grades @> ARRAY[learning_materials.grade]
      AND t.subjects @> ARRAY[learning_materials.subject]
  ))
);

DROP POLICY IF EXISTS "Staff manage exams" ON public.exams;
CREATE POLICY "Staff manage exams" ON public.exams FOR ALL TO authenticated
USING (
  public.current_school_role() = 'Administrator'
  OR (public.current_school_role() = 'Teacher' AND EXISTS (
    SELECT 1 FROM public.teachers t WHERE t.profile_id = auth.uid()
      AND t.assigned_grades @> ARRAY[exams.grade] AND t.subjects @> ARRAY[exams.subject]
  ))
)
WITH CHECK (
  public.current_school_role() = 'Administrator'
  OR (public.current_school_role() = 'Teacher' AND EXISTS (
    SELECT 1 FROM public.teachers t WHERE t.profile_id = auth.uid()
      AND t.assigned_grades @> ARRAY[exams.grade] AND t.subjects @> ARRAY[exams.subject]
  ))
);

DROP POLICY IF EXISTS "Read results by role" ON public.results;
CREATE POLICY "Read results by role" ON public.results FOR SELECT TO authenticated
USING (
  public.current_school_role() = 'Administrator'
  OR (public.current_school_role() = 'Teacher' AND EXISTS (
    SELECT 1 FROM public.teachers t JOIN public.learners l ON l.grade = ANY(t.assigned_grades)
    JOIN public.exams e ON e.id = results.exam_id AND e.grade = l.grade
    WHERE t.profile_id = auth.uid() AND l.id = results.learner_id AND t.subjects @> ARRAY[e.subject]
  ))
  OR (published_at IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.learners l WHERE l.id = results.learner_id AND l.profile_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "Staff enter results" ON public.results;
CREATE POLICY "Staff enter results" ON public.results FOR INSERT TO authenticated
WITH CHECK (
  public.current_school_role() = 'Administrator'
  OR (entered_by = auth.uid() AND public.current_school_role() = 'Teacher' AND EXISTS (
    SELECT 1 FROM public.teachers t JOIN public.learners l ON l.grade = ANY(t.assigned_grades)
    JOIN public.exams e ON e.id = results.exam_id AND e.grade = l.grade
    WHERE t.profile_id = auth.uid() AND l.id = results.learner_id AND t.subjects @> ARRAY[e.subject]
  ))
);

DROP POLICY IF EXISTS "Admin or entering teacher updates results" ON public.results;
CREATE POLICY "Admin or entering teacher updates results" ON public.results FOR UPDATE TO authenticated
USING (
  public.current_school_role() = 'Administrator'
  OR (entered_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.teachers t JOIN public.learners l ON l.grade = ANY(t.assigned_grades)
    JOIN public.exams e ON e.id = results.exam_id AND e.grade = l.grade
    WHERE t.profile_id = auth.uid() AND l.id = results.learner_id AND t.subjects @> ARRAY[e.subject]
  ))
)
WITH CHECK (
  public.current_school_role() = 'Administrator'
  OR (entered_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.teachers t JOIN public.learners l ON l.grade = ANY(t.assigned_grades)
    JOIN public.exams e ON e.id = results.exam_id AND e.grade = l.grade
    WHERE t.profile_id = auth.uid() AND l.id = results.learner_id AND t.subjects @> ARRAY[e.subject]
  ))
);
