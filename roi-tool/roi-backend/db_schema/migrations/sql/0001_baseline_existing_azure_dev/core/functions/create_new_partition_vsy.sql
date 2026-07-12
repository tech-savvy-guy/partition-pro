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
-- TOC entry 323 (class 1255 OID 129956)
-- Name: create_new_partition_vsy(uuid, text, text, text, text, text, uuid); Type: FUNCTION; Schema: core; Owner: -
--

CREATE FUNCTION core.create_new_partition_vsy(p_case_id uuid, p_partition_name text, p_description text, p_status text, p_step_status text, p_created_by text, p_base_partition_id uuid) RETURNS TABLE(partition_id uuid, pos_dataset_id uuid, attributes_dataset_id uuid, crosspurchase_dataset_id uuid, workflow_id uuid, ppm_id uuid)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_now        timestamptz := now();
    v_partition  uuid := gen_random_uuid();
    v_workflow   uuid := gen_random_uuid();

    v_pos_ds     uuid;
    v_attr_ds    uuid;
    v_cross_ds   uuid;
    v_ppm_id     uuid;

    v_base_workflow_id uuid;
BEGIN
    -- Ensure no duplicate partition name for this case
    PERFORM 1
    FROM core.partitions
    WHERE case_id = p_case_id
      AND partition_name = p_partition_name
      AND is_deleted = false;

    IF FOUND THEN
        RAISE EXCEPTION 'Partition with name % already exists for case %',
            p_partition_name, p_case_id
            USING ERRCODE = 'unique_violation';
    END IF;

    -- Latest ppm_id for this case
    SELECT id
    INTO v_ppm_id
    FROM core.preprocessed_metadata
    WHERE case_id = p_case_id
    ORDER BY version DESC
    LIMIT 1;

    -- Insert new partition
    INSERT INTO core.partitions (
        id,
        created_on, created_by,
        updated_on, updated_by,
        is_deleted,
        is_shared,
        case_id,
        ppm_id,
        partition_name,
        description,
        base_partition,
        status,
        end_date,
        step_status,
        tags
    )
    VALUES (
        v_partition,
        v_now, p_created_by,
        v_now, p_created_by,
        false,
        false,
        p_case_id,
        v_ppm_id,
        p_partition_name,
        p_description,
        p_base_partition_id,
        p_status,
        null,
        p_step_status,
        '{}'::jsonb
    );

    /*
      - If p_base_partition_id IS NULL:
            Use core.dataset_metadata where
            case_id = p_case_id AND data_type = ... AND is_selected = true

      - Else:
            Copy dataset_id from core.partitions_dataset_mapping
            where partition_id = p_base_partition_id AND data_type = ...
    */

    IF p_base_partition_id IS NULL THEN
        -- POS
        SELECT dm.id
        INTO v_pos_ds
        FROM core.dataset_metadata dm
        WHERE dm.case_id = p_case_id
          AND dm.data_type = 'POS'
          AND dm.is_deleted = false
          AND dm.is_selected = true
        LIMIT 1;

        IF v_pos_ds IS NULL THEN
            RAISE EXCEPTION 'No selected POS dataset found for case %', p_case_id;
        END IF;

        -- ATTRIBUTES
        SELECT dm.id
        INTO v_attr_ds
        FROM core.dataset_metadata dm
        WHERE dm.case_id = p_case_id
          AND dm.data_type = 'ATTRIBUTES'
          AND dm.is_deleted = false
          AND dm.is_selected = true
        LIMIT 1;

        IF v_attr_ds IS NULL THEN
            RAISE EXCEPTION 'No selected ATTRIBUTES dataset found for case %', p_case_id;
        END IF;

        -- CROSSPURCHASE
        SELECT dm.id
        INTO v_cross_ds
        FROM core.dataset_metadata dm
        WHERE dm.case_id = p_case_id
          AND dm.data_type = 'CROSSPURCHASE'
          AND dm.is_deleted = false
          AND dm.is_selected = true
        LIMIT 1;

        IF v_cross_ds IS NULL THEN
            RAISE EXCEPTION 'No selected CROSSPURCHASE dataset found for case %', p_case_id;
        END IF;

    ELSE
        -- Inherit datasets from base partition mappings

        -- POS
        SELECT pdm.dataset_id
        INTO v_pos_ds
        FROM core.partitions_dataset_mapping pdm
        JOIN core.dataset_metadata dm ON dm.id = pdm.dataset_id
        WHERE pdm.partition_id = p_base_partition_id
          AND pdm.data_type = 'POS'
          AND dm.is_deleted = false
        LIMIT 1;

        IF v_pos_ds IS NULL THEN
            RAISE EXCEPTION 'Base partition % has no POS mapping', p_base_partition_id;
        END IF;

        -- ATTRIBUTES
        SELECT pdm.dataset_id
        INTO v_attr_ds
        FROM core.partitions_dataset_mapping pdm
        JOIN core.dataset_metadata dm ON dm.id = pdm.dataset_id
        WHERE pdm.partition_id = p_base_partition_id
          AND pdm.data_type = 'ATTRIBUTES'
          AND dm.is_deleted = false
        LIMIT 1;

        IF v_attr_ds IS NULL THEN
            RAISE EXCEPTION 'Base partition % has no ATTRIBUTES mapping', p_base_partition_id;
        END IF;

        -- CROSSPURCHASE
        SELECT pdm.dataset_id
        INTO v_cross_ds
        FROM core.partitions_dataset_mapping pdm
        JOIN core.dataset_metadata dm ON dm.id = pdm.dataset_id
        WHERE pdm.partition_id = p_base_partition_id
          AND pdm.data_type = 'CROSSPURCHASE'
          AND dm.is_deleted = false
        LIMIT 1;

        IF v_cross_ds IS NULL THEN
            RAISE EXCEPTION 'Base partition % has no CROSSPURCHASE mapping', p_base_partition_id;
        END IF;

    END IF;

    -- Insert mappings for the new partition
    INSERT INTO core.partitions_dataset_mapping (
        id, partition_id, dataset_id, data_type, tags
    )
    VALUES
        (gen_random_uuid(), v_partition, v_pos_ds,   'POS',           '{}'::jsonb),
        (gen_random_uuid(), v_partition, v_attr_ds,  'ATTRIBUTES',    '{}'::jsonb),
        (gen_random_uuid(), v_partition, v_cross_ds, 'CROSSPURCHASE', '{}'::jsonb);

    ----------------------------------------------------------------------
    -- WORKFLOW CREATION (NEW LOGIC):
    -- If base partition provided -> copy base workflow row into a new one
    -- else -> create fresh DRAFT workflow
    ----------------------------------------------------------------------
    IF p_base_partition_id IS NOT NULL THEN
        -- latest workflow on base partition
        SELECT w.id
        INTO v_base_workflow_id
        FROM core.workflows w
        WHERE w.case_id = p_case_id
          AND w.partition_id = p_base_partition_id
          AND w.is_deleted = false
        ORDER BY w.updated_on DESC NULLS LAST, w.id DESC
        LIMIT 1;

        IF v_base_workflow_id IS NULL THEN
            RAISE EXCEPTION 'Base partition % has no workflow to copy', p_base_partition_id;
        END IF;

        -- clone workflow row (copy data/tags/status/step_number)
        INSERT INTO core.workflows (
            id,
            updated_by,
            updated_on,
            is_deleted,
            case_id,
            partition_id,
            data,
            tags,
            status,
            step_number
        )
        SELECT
            v_workflow,
            p_created_by,
            v_now,
            false,
            w.case_id,
            v_partition,
            w.data,
            w.tags,
            w.status,
            w.step_number
        FROM core.workflows w
        WHERE w.id = v_base_workflow_id;

    ELSE
        -- create fresh workflow
        INSERT INTO core.workflows (
            id,
            updated_by,
            updated_on,
            is_deleted,
            case_id,
            partition_id,
            data,
            tags,
            status,
            step_number
        )
        VALUES (
            v_workflow,
            p_created_by,
            v_now,
            false,
            p_case_id,
            v_partition,
            '{}'::jsonb,
            '{}'::jsonb,
            'DRAFT',
            1
        );
    END IF;

    -- Return mapping info
    partition_id             := v_partition;
    pos_dataset_id           := v_pos_ds;
    attributes_dataset_id    := v_attr_ds;
    crosspurchase_dataset_id := v_cross_ds;
    workflow_id              := v_workflow;
    ppm_id                   := v_ppm_id;

    RETURN NEXT;
END;
$$;


