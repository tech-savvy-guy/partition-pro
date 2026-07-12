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
-- TOC entry 279 (class 1259 OID 25162)
-- Name: audit_log; Type: TABLE; Schema: security; Owner: -
--

CREATE TABLE security.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    activity_on timestamp without time zone NOT NULL,
    activity_by text NOT NULL,
    tenant_id uuid NOT NULL,
    activity_type text NOT NULL,
    data jsonb DEFAULT '[]'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL
);

--
-- TOC entry 280 (class 1259 OID 25170)
-- Name: password_history; Type: TABLE; Schema: security; Owner: -
--

CREATE TABLE security.password_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_on timestamp without time zone NOT NULL,
    created_by text NOT NULL,
    password text NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL
);

--
-- TOC entry 281 (class 1259 OID 25177)
-- Name: tenants; Type: TABLE; Schema: security; Owner: -
--

CREATE TABLE security.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_on timestamp without time zone NOT NULL,
    created_by text NOT NULL,
    updated_on timestamp without time zone,
    updated_by text,
    name text NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    email text,
    start_date timestamp without time zone,
    end_date timestamp without time zone,
    settings jsonb DEFAULT '{}'::jsonb,
    plan text,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL
);


