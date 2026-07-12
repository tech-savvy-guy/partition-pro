-- Baseline SQL managed by Django migrations.
-- Source: db/schema/10_app_schemas.sql schema-only dump from Azure dev.
-- Do not put row data, credentials, owners, or grants in this file.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
--
-- TOC entry 330 (class 1255 OID 126037)
-- Name: get_basemath_optimal_pairs_by_skuname(uuid, uuid, text[]); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.get_basemath_optimal_pairs_by_skuname(_case_id uuid, _pp_basemath_id uuid, _selected_skunames text[] DEFAULT NULL::text[]) RETURNS TABLE(sku_l text, sku_r text, roi real)
    LANGUAGE sql STABLE PARALLEL SAFE
    AS $$
WITH skus AS (
  SELECT CASE
    WHEN _selected_skunames IS NOT NULL AND cardinality(_selected_skunames) > 0
      THEN _selected_skunames
    ELSE (
      SELECT array_agg(DISTINCT pbm.data->>'skuname_ean')
      FROM core.preprocessed_sku_selection pbm
      WHERE pbm.case_id = _case_id
        AND pbm.data ? 'skuname_ean'
        AND pbm.data->>'skuname_ean' IS NOT NULL
    )
  END AS a
),
pairs AS (
  SELECT
    pss.data->>'skuname_ean' AS l,
    kv.key                   AS r,
    kv.value::float4         AS roi
  FROM core.preprocessed_base_math pss
  CROSS JOIN skus
  CROSS JOIN LATERAL jsonb_each_text(pss.data) kv
  WHERE pss.case_id = _case_id
    AND pss.pp_metadata_id = _pp_basemath_id
    AND pss.data->>'skuname_ean' = ANY(skus.a)
    AND kv.key = ANY(skus.a)
    AND pss.data->>'skuname_ean' <> kv.key
)
SELECT
  LEAST(l, r) AS sku_l,
  GREATEST(l, r) AS sku_r,
  AVG(roi) AS roi
FROM pairs
GROUP BY 1,2;
$$;


