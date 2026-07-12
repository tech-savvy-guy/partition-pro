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
-- TOC entry 326 (class 1255 OID 32630)
-- Name: get_basemath_joined_with_selection(uuid, uuid, uuid, uuid[]); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.get_basemath_joined_with_selection(_case_id uuid, _pp_metadata_id uuid, _pp_basemath_id uuid, _selected_ids uuid[]) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    result jsonb;
BEGIN
    /*
      Returns a JSON array of flattened objects:
      each object has id/case_id/pp_metadata_id plus merged_data keys at top-level.
    */

    WITH joined AS (
      SELECT
        pss.id::text AS id,
        pss.case_id::text AS case_id,
        pss.pp_metadata_id::text AS pp_metadata_id,
        (pss.data || COALESCE(pbm.data, '{}'::jsonb)) AS merged_data,
        COALESCE((pss.data->>'skuname_ean'), (pbm.data->>'skuname_ean')) AS skuname_ean
		-- COALESCE(pss.data->>'avg roi',null) AS "avg roi",
		-- COALESCE(pss.data->>'abs pen%',null) AS "abs pen%"
      FROM core.preprocessed_base_math pss
      LEFT JOIN core.preprocessed_sku_selection pbm
        ON ( (pbm.data->>'skuname_ean') IS NOT NULL
             AND (pss.data->>'skuname_ean') IS NOT NULL
             AND (pss.data->>'skuname_ean') = (pbm.data->>'skuname_ean')
           )
        AND pss.case_id = _case_id
        AND pss.pp_metadata_id = _pp_basemath_id
      WHERE pss.case_id = _case_id
        AND pss.pp_metadata_id = _pp_metadata_id
        AND ( _selected_ids IS NULL OR pbm.id = ANY(_selected_ids) )
      ORDER BY pss.row_num
    ),
	filtered AS (
        SELECT
            id,
            case_id,
            pp_metadata_id,
            skuname_ean,
			-- "avg roi",
			-- "abs pen%",
            (
                SELECT jsonb_object_agg(k, v)
                FROM jsonb_each(merged_data) AS e(k, v)
                WHERE k = ANY(select skuname_ean from joined)
            ) AS filtered_data
        FROM joined
    )
     SELECT jsonb_agg(
        jsonb_strip_nulls(
            jsonb_build_object(
               'skuname_ean', skuname_ean
            ) || 
			COALESCE(filtered_data, '{}'::jsonb)
        )
    )
    INTO result
    FROM filtered;

    IF result IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    RETURN result;
END;
$$;


