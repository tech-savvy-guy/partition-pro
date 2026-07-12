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
-- TOC entry 320 (class 1255 OID 114741)
-- Name: get_basemath_matrix_rows(uuid, uuid, uuid[]); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.get_basemath_matrix_rows(_case_id uuid, _pp_basemath_id uuid, _selected_ids uuid[] DEFAULT NULL::uuid[]) RETURNS TABLE(sku_l text, sku_r text, roi real)
    LANGUAGE sql STABLE PARALLEL SAFE
    AS $$
    WITH selected_skus AS (
        SELECT DISTINCT
            pbm.data->>'skuname_ean' AS sku
        FROM core.preprocessed_sku_selection pbm
        WHERE pbm.case_id = _case_id
          AND (
                _selected_ids IS NULL
             OR pbm.id = ANY(_selected_ids)
          )
          AND pbm.data ? 'skuname_ean'
    )
    SELECT
        pss.data->>'skuname_ean' AS sku_l,
        kv.key                   AS sku_r,
        (kv.value)::float4       AS roi
    FROM core.preprocessed_base_math pss
    CROSS JOIN LATERAL jsonb_each_text(pss.data) kv
    WHERE pss.case_id = _case_id
      AND pss.pp_metadata_id = _pp_basemath_id

      -- LEFT side: EAN in selected set
      AND pss.data->>'skuname_ean' IN (
            SELECT sku FROM selected_skus
      )

      -- RIGHT side: EAN in selected set
      AND kv.key IN (
            SELECT sku FROM selected_skus
      );
$$;


