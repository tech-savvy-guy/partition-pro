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
-- TOC entry 294 (class 1255 OID 32568)
-- Name: get_overall_coverage(uuid, uuid, uuid, uuid, uuid[]); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.get_overall_coverage(_case_id uuid, _pos_metadata_id uuid, _cp_metadata_id uuid, _pp_metadata_id uuid, _selected_ids uuid[]) RETURNS jsonb
    LANGUAGE plpgsql
    AS $_$
DECLARE
    result jsonb;
BEGIN
    WITH pos AS (
        SELECT
            (data->>'skuname_ean')               AS skuname_ean,
            COALESCE((data->>'is_client')::int, 0)        AS is_client,
            COALESCE((data->>'dollar_sales')::numeric, 0) AS dollar_sales,
            COALESCE((data->>'volume_sales')::numeric, 0) AS volume_sales
        FROM core.raw_pos_data
        WHERE case_id = _case_id
          AND metadata_id = _pos_metadata_id
    ),

    temp2 AS (
        SELECT
            id,
            (data->>'skuname_ean')               AS skuname_ean,
            COALESCE((data->>'is_client')::int, 0)        AS is_client,
            COALESCE((data->>'dollar_sales')::numeric, 0) AS dollar_sales,
            COALESCE((data->>'volume_sales')::numeric, 0) AS volume_sales,
            COALESCE((data->>'raw_buyers')::numeric, 0)   AS raw_buyers
        FROM core.preprocessed_sku_selection
        WHERE case_id = _case_id
          AND pp_metadata_id = _pp_metadata_id
    ),

    sel AS (
        SELECT *
        FROM temp2
        WHERE id = ANY(_selected_ids)
    ),

    selected_skus AS (
        SELECT DISTINCT skuname_ean FROM sel
    ),

    cp AS (
        SELECT
            (data->>'skuname_ean') AS skuname_ean,
            data                   AS data
        FROM core.raw_cross_purchase_data
        WHERE case_id = _case_id
          AND metadata_id = _cp_metadata_id
    ),

    -- Filter for current selection (custom panel)
    cp_filtered AS (
        SELECT cp.*
        FROM cp
        JOIN selected_skus s
          ON cp.skuname_ean = s.skuname_ean
    ),

    buyers_matrix_sel AS (
        SELECT
            elem.key,
            CASE
                WHEN elem.value ~ '^[+-]?\d+(\.\d+)?$'
                THEN elem.value::numeric
                ELSE NULL
            END AS val
        FROM cp_filtered,
             LATERAL jsonb_each_text(cp_filtered.data) AS elem
        WHERE elem.key NOT IN (
            'is_client', 'is_branded', 'raw_buyers', 'skuname_ean',
            'total_base_buyers', 'category', '\ufeffcategory'
            -- Add more meta keys if needed
        )
    ),

    buyers_matrix_sel_stats AS (
        SELECT
            COUNT(val) AS total_cells,
            COUNT(*) FILTER (WHERE val = 0) AS zero_cells
        FROM buyers_matrix_sel
        WHERE val IS NOT NULL
    ),

    -- For all panel SKUs (full panel)
    panel_skus AS (
        SELECT DISTINCT skuname_ean FROM temp2
    ),

    cp_panel AS (
        SELECT cp.*
        FROM cp
        JOIN panel_skus p
          ON cp.skuname_ean = p.skuname_ean
    ),

    buyers_matrix_panel AS (
        SELECT
            elem.key,
            CASE
                WHEN elem.value ~ '^[+-]?\d+(\.\d+)?$'
                THEN elem.value::numeric
                ELSE NULL
            END AS val
        FROM cp_panel,
             LATERAL jsonb_each_text(cp_panel.data) AS elem
        WHERE elem.key NOT IN (
            'is_client', 'is_branded', 'raw_buyers', 'skuname_ean',
            'total_base_buyers', 'category', '\ufeffcategory'
            -- Add more meta keys if needed
        )
    ),

    buyers_matrix_panel_stats AS (
        SELECT
            COUNT(val) AS total_cells,
            COUNT(*) FILTER (WHERE val = 0) AS zero_cells
        FROM buyers_matrix_panel
        WHERE val IS NOT NULL
    ),

    pos_agg AS (
        SELECT
            COUNT(DISTINCT skuname_ean)                      AS skus,
            SUM(is_client)                                  AS client_skus,
            SUM(dollar_sales)                               AS value,
            SUM(volume_sales)                               AS volume,
            SUM(dollar_sales) FILTER (WHERE is_client = 1)  AS client_value,
            SUM(volume_sales) FILTER (WHERE is_client = 1)  AS client_volume
        FROM pos
    ),

    sel_agg AS (
        SELECT
            MIN(raw_buyers)                                 AS min_n_cutoff_selected,
            COUNT(DISTINCT skuname_ean)                     AS skus,
            SUM(is_client)                                  AS client_skus,
            SUM(dollar_sales)                               AS value,
            SUM(volume_sales)                               AS volume,
            SUM(dollar_sales) FILTER (WHERE is_client = 1)  AS client_value,
            SUM(volume_sales) FILTER (WHERE is_client = 1)  AS client_volume
        FROM sel
    ),

    temp2_agg AS (
        SELECT
            MIN(raw_buyers)                                 AS min_n,
            COUNT(DISTINCT skuname_ean)                     AS skus,
            SUM(is_client)                                  AS client_skus,
            SUM(dollar_sales)                               AS value,
            SUM(volume_sales)                               AS volume,
            SUM(dollar_sales) FILTER (WHERE is_client = 1)  AS client_value,
            SUM(volume_sales) FILTER (WHERE is_client = 1)  AS client_volume
        FROM temp2
    )

    SELECT jsonb_build_object(
        'overall_coverage',
        jsonb_build_object(
            'total_pos',
            jsonb_build_object(
                'skus',          pos_agg.skus,
                'client_skus',   COALESCE(pos_agg.client_skus, 0),
                'value',         COALESCE(pos_agg.value, 0),
                'volume',        COALESCE(pos_agg.volume, 0)
            ),

            'current_selection',
            jsonb_build_object(
                'min_n_cutoff_selected', COALESCE(sel_agg.min_n_cutoff_selected, NULL),
                'skus',                  COALESCE(sel_agg.skus, 0),
                'client_skus',           COALESCE(sel_agg.client_skus, 0),

                'pos_coverage_value_pct',
                    CASE WHEN pos_agg.value > 0
                         THEN (COALESCE(sel_agg.value, 0) / pos_agg.value) * 100
                         ELSE 0
                    END,

                'pos_coverage_volume_pct',
                    CASE WHEN pos_agg.volume > 0
                         THEN (COALESCE(sel_agg.volume, 0) / pos_agg.volume) * 100
                         ELSE 0
                    END,

                'client_coverage_value_pct',
                    CASE WHEN pos_agg.client_value > 0
                         THEN (COALESCE(sel_agg.client_value, 0) / pos_agg.client_value) * 100
                         ELSE 0
                    END,

                'client_coverage_volume_pct',
                    CASE WHEN pos_agg.client_volume > 0
                         THEN (COALESCE(sel_agg.client_volume, 0) / pos_agg.client_volume) * 100
                         ELSE 0
                    END,

                'percent_zeroes',
                    CASE
                        WHEN buyers_matrix_sel_stats.total_cells > 0
                        THEN (buyers_matrix_sel_stats.zero_cells::numeric
                             / buyers_matrix_sel_stats.total_cells::numeric) * 100
                        ELSE NULL
                    END
            ),

            'all_panel_skus',
            jsonb_build_object(
                'min_n',                temp2_agg.min_n,
                'skus',                 COALESCE(temp2_agg.skus, 0),
                'client_skus',          COALESCE(temp2_agg.client_skus, 0),

                'pos_coverage_value_pct',
                    CASE WHEN pos_agg.value > 0
                         THEN (COALESCE(temp2_agg.value, 0) / pos_agg.value) * 100
                         ELSE 0
                    END,

                'pos_coverage_volume_pct',
                    CASE WHEN pos_agg.volume > 0
                         THEN (COALESCE(temp2_agg.volume, 0) / pos_agg.volume) * 100
                         ELSE 0
                    END,

                'client_coverage_value_pct',
                    CASE WHEN pos_agg.client_value > 0
                         THEN (COALESCE(temp2_agg.client_value, 0) / pos_agg.client_value) * 100
                         ELSE 0
                    END,

                'client_coverage_volume_pct',
                    CASE WHEN pos_agg.client_volume > 0
                         THEN (COALESCE(temp2_agg.client_volume, 0) / pos_agg.client_volume) * 100
                         ELSE 0
                    END,

                'percent_zeroes',
                    CASE
                        WHEN buyers_matrix_panel_stats.total_cells > 0
                        THEN (buyers_matrix_panel_stats.zero_cells::numeric
                             / buyers_matrix_panel_stats.total_cells::numeric) * 100
                        ELSE NULL
                    END
            )
        )
    )
    INTO result
    FROM pos_agg, sel_agg, temp2_agg, buyers_matrix_sel_stats, buyers_matrix_panel_stats;

    RETURN result;
END;
$_$;


SET default_tablespace = '';

SET default_table_access_method = heap;


