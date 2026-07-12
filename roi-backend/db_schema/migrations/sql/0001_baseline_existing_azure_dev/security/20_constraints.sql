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
-- TOC entry 4683 (class 2606 OID 25303)
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: security; Owner: -
--

ALTER TABLE ONLY security.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);

--
-- TOC entry 4685 (class 2606 OID 25305)
-- Name: password_history passwords_history_pkey; Type: CONSTRAINT; Schema: security; Owner: -
--

ALTER TABLE ONLY security.password_history
    ADD CONSTRAINT passwords_history_pkey PRIMARY KEY (id);

--
-- TOC entry 4687 (class 2606 OID 25307)
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: security; Owner: -
--

ALTER TABLE ONLY security.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


