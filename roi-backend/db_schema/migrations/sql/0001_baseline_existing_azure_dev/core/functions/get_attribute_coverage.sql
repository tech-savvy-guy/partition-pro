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
-- TOC entry 322 (class 1255 OID 32572)
-- Name: get_attribute_coverage(uuid, uuid, uuid, uuid, uuid[]); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.get_attribute_coverage(_case_id uuid, _pos_metadata_id uuid, _pp_metadata_id uuid, _att_metadata_id uuid, _selected_ids uuid[]) RETURNS jsonb
    LANGUAGE plpgsql
    AS $_$
DECLARE
    attr      text;
    idx       integer := 0;
    coverage  jsonb := '[]'::jsonb;
    entry     jsonb;
BEGIN
    /*
      df_attribute is assumed to be a raw table similar to raw_pos_data:
        core.raw_attributes_data(case_id, metadata_id, data jsonb, ...)

      We derive the attribute list from JSON keys in that table.
      We ignore obvious metric keys.
    */

    FOR attr IN
        SELECT DISTINCT jsonb_object_keys(data)
        FROM core.raw_attributes_data
        WHERE case_id = _case_id
          AND metadata_id = _att_metadata_id
    LOOP
        -- Skip non-attribute keys (tune this exclusion list as needed)
        IF attr IN ('skuname_ean', 'is_client', 'dollar_sales', 'volume_sales', 'raw_buyers') THEN
            CONTINUE;
        END IF;

        idx := idx + 1;

        EXECUTE format($SQL$
            WITH temp2 AS (
                SELECT
                    id,
                    (data->>'skuname_ean')               AS skuname_ean,
                    COALESCE((data->>'dollar_sales')::numeric, 0) AS dollar_sales,
                    COALESCE((data->>'volume_sales')::numeric, 0) AS volume_sales,
                    (data->>%L)                           AS attribute_value
                FROM core.preprocessed_sku_selection
                WHERE case_id = $1
                  AND pp_metadata_id = $2
            ),
            sel AS (
                SELECT *
                FROM temp2
                WHERE id = ANY($5)
            ),
            pos AS (
                SELECT
                    (data->>'skuname_ean')               AS skuname_ean,
                    COALESCE((data->>'dollar_sales')::numeric, 0) AS dollar_sales,
                    COALESCE((data->>'volume_sales')::numeric, 0) AS volume_sales,
                    (data->>%L)                           AS attribute_value
                FROM core.raw_pos_data
                WHERE case_id = $1
                  AND metadata_id = $3
            ),

            -- ----------------------------
            -- ALL PANEL SKUs (df_temp2)
            -- ----------------------------
            g_cp_all AS (
                SELECT
                    attribute_value,
                    COUNT(DISTINCT skuname_ean)              AS panel_skus,
                    SUM(dollar_sales)                        AS pos_value_mapped,
                    SUM(volume_sales)                        AS pos_volume_mapped
                FROM temp2
                GROUP BY attribute_value
            ),
            g_pos_all AS (
                SELECT
                    attribute_value,
                    COUNT(DISTINCT skuname_ean)              AS pos_skus,
                    SUM(dollar_sales)                        AS pos_dollar_sales,
                    SUM(volume_sales)                        AS pos_volume_sales
                FROM pos
                GROUP BY attribute_value
            ),
            tbl_all AS (
                SELECT
                    a.attribute_value,
                    a.panel_skus,
                    a.pos_value_mapped,
                    a.pos_volume_mapped,
                    b.pos_skus,
                    b.pos_dollar_sales,
                    b.pos_volume_sales,
                    CASE WHEN b.pos_dollar_sales > 0
                         THEN ROUND((a.pos_value_mapped / b.pos_dollar_sales) * 100, 3)
                         ELSE 0 END AS pos_value_covered,
                    CASE WHEN b.pos_volume_sales > 0
                         THEN ROUND((a.pos_volume_mapped / b.pos_volume_sales) * 100, 3)
                         ELSE 0 END AS pos_volume_covered,
                    ROUND(
                        (a.pos_value_mapped / NULLIF(SUM(a.pos_value_mapped) OVER (), 0)) * 100,
                        3
                    ) AS value_share,
                    ROUND(
                        (a.pos_volume_mapped / NULLIF(SUM(a.pos_volume_mapped) OVER (), 0)) * 100,
                        3
                    ) AS volume_share
                FROM g_cp_all a
                JOIN g_pos_all b
                  ON a.attribute_value = b.attribute_value
            ),

            -- ----------------------------
            -- CUSTOM PANEL SKUs (selected)
            -- ----------------------------
            g_cp_sel AS (
                SELECT
                    attribute_value,
                    COUNT(DISTINCT skuname_ean)              AS panel_skus,
                    SUM(dollar_sales)                        AS pos_value_mapped,
                    SUM(volume_sales)                        AS pos_volume_mapped
                FROM sel
                GROUP BY attribute_value
            ),
            g_pos_sel AS (
                SELECT
                    attribute_value,
                    COUNT(DISTINCT skuname_ean)              AS pos_skus,
                    SUM(dollar_sales)                        AS pos_dollar_sales,
                    SUM(volume_sales)                        AS pos_volume_sales
                FROM pos
                GROUP BY attribute_value
            ),
            tbl_sel AS (
                SELECT
                    a.attribute_value,
                    a.panel_skus,
                    a.pos_value_mapped,
                    a.pos_volume_mapped,
                    b.pos_skus,
                    b.pos_dollar_sales,
                    b.pos_volume_sales,
                    CASE WHEN b.pos_dollar_sales > 0
                         THEN ROUND((a.pos_value_mapped / b.pos_dollar_sales) * 100, 3)
                         ELSE 0 END AS pos_value_covered,
                    CASE WHEN b.pos_volume_sales > 0
                         THEN ROUND((a.pos_volume_mapped / b.pos_volume_sales) * 100, 3)
                         ELSE 0 END AS pos_volume_covered,
                    ROUND(
                        (a.pos_value_mapped / NULLIF(SUM(a.pos_value_mapped) OVER (), 0)) * 100,
                        3
                    ) AS value_share,
                    ROUND(
                        (a.pos_volume_mapped / NULLIF(SUM(a.pos_volume_mapped) OVER (), 0)) * 100,
                        3
                    ) AS volume_share
                FROM g_cp_sel a
                JOIN g_pos_sel b
                  ON a.attribute_value = b.attribute_value
            ),

            -- ----------------------------
            -- PURE POS SPLIT
            -- ----------------------------
            g_pos_split AS (
                SELECT
                    attribute_value,
                    COUNT(DISTINCT skuname_ean)              AS skus_number,
                    SUM(dollar_sales)                        AS pos_value,
                    SUM(volume_sales)                        AS pos_volume,
                    ROUND(
                        SUM(dollar_sales)
                        / NULLIF(SUM(SUM(dollar_sales)) OVER (), 0)
                        * 100,
                        3
                    ) AS value_share,
                    ROUND(
                        SUM(volume_sales)
                        / NULLIF(SUM(SUM(volume_sales)) OVER (), 0)
                        * 100,
                        3
                    ) AS volume_share
                FROM pos
                GROUP BY attribute_value
            )

            SELECT jsonb_build_object(
                'id', %s,
                'attribute', %L,
				'color_flag', (
						SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM g_pos_split) THEN 'RED'
    WHEN EXISTS (
      SELECT 1
      FROM tbl_sel s
      JOIN tbl_all a
        ON a.attribute_value = s.attribute_value
      WHERE
        abs(s.pos_value_mapped  - a.pos_value_mapped)  > 0.10 * abs(a.pos_value_mapped)
        OR
        abs(s.pos_volume_mapped - a.pos_volume_mapped) > 0.10 * abs(a.pos_volume_mapped)
    ) THEN 'YELLOW'
    ELSE 'GREEN'
  END
				),
                'details', jsonb_build_array(
                    jsonb_build_object(
                        'pos_sales_split_custom',
                            COALESCE(
                                (SELECT jsonb_agg(
                                     jsonb_build_object(
                                         'sub_attribute', attribute_value,
                                         'skus_number', panel_skus,
                                         'pos_volume_covered', pos_volume_covered,
                                         'pos_value_covered', pos_value_covered,
                                         'value_share', value_share,
                                         'volume_share', volume_share
                                     )
                                 ) FROM tbl_sel),
                                '[]'::jsonb
                            ),
                        'pos_sales_split_panel',
                            COALESCE(
                                (SELECT jsonb_agg(
                                     jsonb_build_object(
                                         'sub_attribute', attribute_value,
                                         'skus_number', panel_skus,
                                         'pos_volume_covered', pos_volume_covered,
                                         'pos_value_covered', pos_value_covered,
                                         'value_share', value_share,
                                         'volume_share', volume_share
                                     )
                                 ) FROM tbl_all),
                                '[]'::jsonb
                            ),
                        'pos_sales_split',
                            COALESCE(
                                (SELECT jsonb_agg(
                                     jsonb_build_object(
                                         'sub_attribute', attribute_value,
                                         'skus_number', skus_number,
                                         'pos_volume', pos_volume,
                                         'pos_value', pos_value,
                                         'value_share', value_share,
                                         'volume_share', volume_share
                                     )
                                 ) FROM g_pos_split),
                                '[]'::jsonb
                            )
                    )
                )
            )
            $SQL$,
            attr,      -- %L in temp2
            attr,      -- %L in pos
            idx,       -- %s for 'id'
            attr       -- %L for 'attribute'
        )
        INTO entry
        USING _case_id, _pp_metadata_id, _pos_metadata_id, _att_metadata_id, _selected_ids;

        coverage := coverage || entry;
    END LOOP;

    RETURN jsonb_build_object('coverage', coverage);
END;
$_$;


