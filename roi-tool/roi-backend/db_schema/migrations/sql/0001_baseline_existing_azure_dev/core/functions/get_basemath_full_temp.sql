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
-- TOC entry 328 (class 1255 OID 63129)
-- Name: get_basemath_full_temp(uuid, uuid, uuid, uuid[], text); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.get_basemath_full_temp(_case_id uuid, _pp_metadata_id uuid, _pp_basemath_id uuid, _selected_ids uuid[], _view text) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
  result json;
BEGIN
  WITH
  sel AS (
    SELECT (_selected_ids IS NULL OR cardinality(_selected_ids) = 0) AS no_filter,
           upper(coalesce(_view,'FULL')) AS v
  ),

  -- sku_selection rows restricted to selected_ids (or all if no_filter)
  pbm_filtered AS (
    SELECT pbm.*
    FROM core.preprocessed_sku_selection pbm
    CROSS JOIN sel
    WHERE sel.no_filter OR pbm.id = ANY(_selected_ids)
  ),

  -- selected skuname_ean list derived from selected_ids
  selected_skus AS (
    SELECT array_agg(DISTINCT (pbm.data->>'skuname_ean')) AS skus
    FROM pbm_filtered pbm
    WHERE pbm.data ? 'skuname_ean'
      AND pbm.data->>'skuname_ean' IS NOT NULL
  ),

  -- all basemath rows for the case (unfiltered) - used to derive SKU universe (dynamic matrix keys)
  pss_all AS (
    SELECT pss.*
    FROM core.preprocessed_base_math pss
    WHERE pss.case_id = _case_id
      AND pss.pp_metadata_id = _pp_basemath_id
  ),

  -- Universe of SKU identifiers present as ROWS in basemath (these define "matrix keys")
  sku_universe AS (
    SELECT array_agg(DISTINCT (pss.data->>'skuname_ean')) AS all_skus
    FROM pss_all pss
    WHERE pss.data ? 'skuname_ean'
      AND pss.data->>'skuname_ean' IS NOT NULL
  ),

  -- basemath rows filtered to selected SKUs (for both FULL and MATRIX)
  pss_base AS (
    SELECT pss.*
    FROM pss_all pss
    CROSS JOIN sel
    CROSS JOIN selected_skus ss
    WHERE
      sel.no_filter
      OR (ss.skus IS NOT NULL AND pss.data->>'skuname_ean' = ANY(ss.skus))
  ),

  -- join sku_selection data ONLY for FULL
  joined AS (
    SELECT
      pss.id::text AS id,
      pss.case_id::text AS case_id,
      pss.pp_metadata_id::text AS pp_metadata_id,
      (pss.data || COALESCE(pbm.data, '{}'::jsonb)) AS merged_data,
      pss.data->>'skuname_ean' AS skuname_ean,
      pss.row_num
    FROM pss_base pss
    CROSS JOIN sel
    LEFT JOIN pbm_filtered pbm
      ON sel.v = 'FULL'
     AND (pbm.data->>'skuname_ean') IS NOT NULL
     AND (pbm.data->>'skuname_ean') = (pss.data->>'skuname_ean')
  ),

  -- ordering arrays from metadata.data
  meta_arrays AS (
    SELECT
      ARRAY(
        SELECT e.value
        FROM core.preprocessed_metadata pm
        CROSS JOIN LATERAL jsonb_array_elements_text(pm.tags #> '{columns_order,SKUSELECTION}') e(value)
        WHERE pm.id = _pp_metadata_id
      ) AS sk_cols,
      ARRAY(
        SELECT e.value
        FROM core.preprocessed_metadata pm
        CROSS JOIN LATERAL jsonb_array_elements_text(pm.tags #> '{columns_order,BASEMATH}') e(value)
        WHERE pm.id = _pp_metadata_id
      ) AS bm_cols
  ),

  /* -------- Column filtering (dynamic, based on sku_universe) -------- */

  -- Filter BASEMATH columns:
  -- - keep non-matrix keys always
  -- - keep matrix keys only if selected (unless no_filter)
  bm_cols_filtered AS (
    SELECT array_agg(k ORDER BY ord) AS cols
    FROM meta_arrays ma
    CROSS JOIN sel
    CROSS JOIN selected_skus ss
    CROSS JOIN sku_universe su
    CROSS JOIN LATERAL unnest(ma.bm_cols) WITH ORDINALITY u(k, ord)
    WHERE
      sel.no_filter
      OR (
           -- non-matrix key
           NOT (su.all_skus IS NOT NULL AND k = ANY(su.all_skus))
         )
      OR (
           -- matrix key, keep only selected columns
           ss.skus IS NOT NULL AND k = ANY(ss.skus)
         )
  ),

  -- MATRIX view columns:
  -- only skuname_ean + selected matrix keys (in basemath order)
  matrix_order AS (
    SELECT
      array_cat(
        ARRAY['skuname_ean'],
        COALESCE(
          (
            SELECT array_agg(k ORDER BY ord)
            FROM meta_arrays ma
            CROSS JOIN sel
            CROSS JOIN selected_skus ss
            CROSS JOIN sku_universe su
            CROSS JOIN LATERAL unnest(ma.bm_cols) WITH ORDINALITY u(k, ord)
            WHERE
              -- matrix keys only: keys that are in sku_universe
              su.all_skus IS NOT NULL AND k = ANY(su.all_skus)
              AND (
                sel.no_filter
                OR (ss.skus IS NOT NULL AND k = ANY(ss.skus))
              )
          ),
          ARRAY[]::text[]
        )
      ) AS cols
  ),

  -- FULL view columns:
  -- all sku_selection columns + filtered basemath columns (dedup preserving first occurrence)
  full_order_dedup AS (
    SELECT array_agg(key_name ORDER BY pos) AS cols
    FROM (
      SELECT key_name, MIN(pos) AS pos
      FROM (
        SELECT k AS key_name, ord AS pos
        FROM meta_arrays ma
        CROSS JOIN bm_cols_filtered bm
        CROSS JOIN LATERAL unnest(array_cat(ma.sk_cols, bm.cols)) WITH ORDINALITY u(k, ord)
      ) x
      GROUP BY key_name
    ) y
  ),

  final_order AS (
    SELECT CASE
      WHEN sel.v = 'MATRIX' THEN (SELECT cols FROM matrix_order)
      ELSE (SELECT cols FROM full_order_dedup)
    END AS cols
    FROM sel
  ),

  -- Produce ordered JSON per row
  ordered AS (
    SELECT
      j.row_num,
      (
        SELECT json_strip_nulls(
          json_object_agg(k, j.merged_data->k ORDER BY ord)
        )
        FROM final_order fo
        CROSS JOIN LATERAL unnest(fo.cols) WITH ORDINALITY u(k, ord)
        WHERE j.merged_data ? k
      ) AS ordered_json
    FROM joined j
  )

  SELECT json_agg(ordered_json ORDER BY row_num)
    INTO result
  FROM ordered;

  RETURN COALESCE(result, '[]'::json);
END;
$$;


