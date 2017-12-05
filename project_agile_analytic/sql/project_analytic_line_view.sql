DROP VIEW IF EXISTS project_agile_analytic_line_view CASCADE;

CREATE OR REPLACE VIEW project_agile_analytic_line_view AS
  SELECT l.id,
         l.project_id,
         l.task_id,
         l.type_id,
         l.user_id,
         l.stage_id,
         l.start_date,
         l.end_date,
         l.company_id,
         COALESCE(EXTRACT(epoch FROM COALESCE(l.end_date, now() at time zone 'utc') - l.start_date)/3600, 0.0::double precision) AS duration
  FROM project_agile_analytic_line l;