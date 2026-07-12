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
-- TOC entry 284 (class 1259 OID 32559)
-- Name: v_partition_workflow; Type: VIEW; Schema: core; Owner: -
--

CREATE VIEW core.v_partition_workflow AS
 SELECT p.id AS partition_id,
    p.case_id,
    p.ppm_id,
    w.id AS workflow_id,
    w.data AS worflow_data,
    w.status,
    w.step_number
   FROM (core.partitions p
     JOIN core.workflows w ON ((p.id = w.partition_id)));


