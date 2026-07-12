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
-- TOC entry 319 (class 1255 OID 28336)
-- Name: build_case_staging(uuid); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.build_case_staging(p_case_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_pos_metadata_id uuid;
    v_attr_metadata_id uuid;
    v_cross_metadata_id uuid;
BEGIN

    SELECT id INTO v_pos_metadata_id
    FROM core.dataset_metadata
    WHERE case_id = p_case_id
      AND data_type = 'POS'
      AND is_deleted = false
      AND is_selected = true
    LIMIT 1;

    SELECT id INTO v_attr_metadata_id
    FROM core.dataset_metadata
    WHERE case_id = p_case_id
      AND data_type = 'ATTRIBUTES'
      AND is_deleted = false
      AND is_selected = true
    LIMIT 1;

    SELECT id INTO v_cross_metadata_id
    FROM core.dataset_metadata
    WHERE case_id = p_case_id
      AND data_type = 'CROSSPURCHASE'
      AND is_deleted = false
      AND is_selected = true
    LIMIT 1;

    IF v_pos_metadata_id IS NULL THEN
        RAISE NOTICE 'No POS dataset selected for case %', p_case_id;
    END IF;
    IF v_attr_metadata_id IS NULL THEN
        RAISE NOTICE 'No ATTRIBUTES dataset selected for case %', p_case_id;
    END IF;
    IF v_cross_metadata_id IS NULL THEN
        RAISE NOTICE 'No CROSSPURCHASE dataset selected for case %', p_case_id;
    END IF;

    --  Remove old staging rows for this case
    --DELETE FROM core.staging_case_data
    --WHERE case_id = p_case_id;

    -- Insert new staging rows
    -- INSERT INTO core.staging_case_data (
    --     id,
    --     case_id,
    --     pos_metadata_id,
    --     attributes_metadata_id,
    --     crosspurchase_metadata_id,
    --     pos_row_id,
    --     attributes_row_id,
    --     crosspurchase_row_id,
    --     customer_id,
    --     product_id,
    --     transaction_id,
    --     pos_data,
    --     attributes_data,
    --     crosspurchase_data,
    --     tags
    -- )
    -- SELECT
    --     gen_random_uuid() AS id,
    --     p_case_id AS case_id,
    --     v_pos_metadata_id,
    --     v_attr_metadata_id,
    --     v_cross_metadata_id,
    --     pos.id AS pos_row_id,
    --     attr.id AS attributes_row_id,
    --     cross.id AS crosspurchase_row_id,
    --     -- join keys from JSON (adapt these field names to your actual schema)
    --     COALESCE(
    --         pos.data->>'customer_id',
    --         attr.data->>'customer_id',
    --         cross.data->>'customer_id'
    --     ) AS customer_id,
    --     COALESCE(
    --         pos.data->>'product_id',
    --         attr.data->>'product_id',
    --         cross.data->>'product_id'
    --     ) AS product_id,
    --     pos.data->>'transaction_id' AS transaction_id,
    --     pos.data AS pos_data,
    --     attr.data AS attributes_data,
    --     cross.data AS crosspurchase_data,
    --     '{}'::jsonb AS tags
    -- FROM core.raw_pos_data pos
    -- LEFT JOIN core.raw_attributes_data attr
    --     ON attr.metadata_id = v_attr_metadata_id
    --    AND attr.case_id = p_case_id
    --    AND (attr.data->>'customer_id') = (pos.data->>'customer_id')
    --    AND (attr.data->>'product_id') = (pos.data->>'product_id')
    -- LEFT JOIN core.raw_crosspurchase_data cross
    --     ON cross.metadata_id = v_cross_metadata_id
    --    AND cross.case_id = p_case_id
    --    AND (cross.data->>'customer_id') = (pos.data->>'customer_id')
    --    AND (cross.data->>'product_id') = (pos.data->>'product_id')
    -- WHERE pos.metadata_id = v_pos_metadata_id
    --   AND pos.case_id = p_case_id;


END;
$$;


