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
-- TOC entry 4196 (class 0 OID 0)
-- Name: raw_attributes_data_p0; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_attributes_data ATTACH PARTITION core.raw_attributes_data_p0 FOR VALUES WITH (modulus 8, remainder 0);

--
-- TOC entry 4197 (class 0 OID 0)
-- Name: raw_attributes_data_p1; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_attributes_data ATTACH PARTITION core.raw_attributes_data_p1 FOR VALUES WITH (modulus 8, remainder 1);

--
-- TOC entry 4198 (class 0 OID 0)
-- Name: raw_attributes_data_p2; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_attributes_data ATTACH PARTITION core.raw_attributes_data_p2 FOR VALUES WITH (modulus 8, remainder 2);

--
-- TOC entry 4199 (class 0 OID 0)
-- Name: raw_attributes_data_p3; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_attributes_data ATTACH PARTITION core.raw_attributes_data_p3 FOR VALUES WITH (modulus 8, remainder 3);

--
-- TOC entry 4200 (class 0 OID 0)
-- Name: raw_attributes_data_p4; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_attributes_data ATTACH PARTITION core.raw_attributes_data_p4 FOR VALUES WITH (modulus 8, remainder 4);

--
-- TOC entry 4201 (class 0 OID 0)
-- Name: raw_attributes_data_p5; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_attributes_data ATTACH PARTITION core.raw_attributes_data_p5 FOR VALUES WITH (modulus 8, remainder 5);

--
-- TOC entry 4202 (class 0 OID 0)
-- Name: raw_attributes_data_p6; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_attributes_data ATTACH PARTITION core.raw_attributes_data_p6 FOR VALUES WITH (modulus 8, remainder 6);

--
-- TOC entry 4203 (class 0 OID 0)
-- Name: raw_attributes_data_p7; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_attributes_data ATTACH PARTITION core.raw_attributes_data_p7 FOR VALUES WITH (modulus 8, remainder 7);

--
-- TOC entry 4204 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p0; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_cross_purchase_data ATTACH PARTITION core.raw_cross_purchase_data_p0 FOR VALUES WITH (modulus 8, remainder 0);

--
-- TOC entry 4205 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p1; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_cross_purchase_data ATTACH PARTITION core.raw_cross_purchase_data_p1 FOR VALUES WITH (modulus 8, remainder 1);

--
-- TOC entry 4206 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p2; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_cross_purchase_data ATTACH PARTITION core.raw_cross_purchase_data_p2 FOR VALUES WITH (modulus 8, remainder 2);

--
-- TOC entry 4207 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p3; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_cross_purchase_data ATTACH PARTITION core.raw_cross_purchase_data_p3 FOR VALUES WITH (modulus 8, remainder 3);

--
-- TOC entry 4208 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p4; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_cross_purchase_data ATTACH PARTITION core.raw_cross_purchase_data_p4 FOR VALUES WITH (modulus 8, remainder 4);

--
-- TOC entry 4209 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p5; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_cross_purchase_data ATTACH PARTITION core.raw_cross_purchase_data_p5 FOR VALUES WITH (modulus 8, remainder 5);

--
-- TOC entry 4210 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p6; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_cross_purchase_data ATTACH PARTITION core.raw_cross_purchase_data_p6 FOR VALUES WITH (modulus 8, remainder 6);

--
-- TOC entry 4211 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p7; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_cross_purchase_data ATTACH PARTITION core.raw_cross_purchase_data_p7 FOR VALUES WITH (modulus 8, remainder 7);

--
-- TOC entry 4212 (class 0 OID 0)
-- Name: raw_pos_data_p0; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_pos_data ATTACH PARTITION core.raw_pos_data_p0 FOR VALUES WITH (modulus 8, remainder 0);

--
-- TOC entry 4213 (class 0 OID 0)
-- Name: raw_pos_data_p1; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_pos_data ATTACH PARTITION core.raw_pos_data_p1 FOR VALUES WITH (modulus 8, remainder 1);

--
-- TOC entry 4214 (class 0 OID 0)
-- Name: raw_pos_data_p2; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_pos_data ATTACH PARTITION core.raw_pos_data_p2 FOR VALUES WITH (modulus 8, remainder 2);

--
-- TOC entry 4215 (class 0 OID 0)
-- Name: raw_pos_data_p3; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_pos_data ATTACH PARTITION core.raw_pos_data_p3 FOR VALUES WITH (modulus 8, remainder 3);

--
-- TOC entry 4216 (class 0 OID 0)
-- Name: raw_pos_data_p4; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_pos_data ATTACH PARTITION core.raw_pos_data_p4 FOR VALUES WITH (modulus 8, remainder 4);

--
-- TOC entry 4217 (class 0 OID 0)
-- Name: raw_pos_data_p5; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_pos_data ATTACH PARTITION core.raw_pos_data_p5 FOR VALUES WITH (modulus 8, remainder 5);

--
-- TOC entry 4218 (class 0 OID 0)
-- Name: raw_pos_data_p6; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_pos_data ATTACH PARTITION core.raw_pos_data_p6 FOR VALUES WITH (modulus 8, remainder 6);

--
-- TOC entry 4219 (class 0 OID 0)
-- Name: raw_pos_data_p7; Type: TABLE ATTACH; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_pos_data ATTACH PARTITION core.raw_pos_data_p7 FOR VALUES WITH (modulus 8, remainder 7);

--
-- TOC entry 4385 (class 2606 OID 25188)
-- Name: preprocessed_base_math base_math_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.preprocessed_base_math
    ADD CONSTRAINT base_math_pkey PRIMARY KEY (id);

--
-- TOC entry 4700 (class 2606 OID 127675)
-- Name: basemath_edges basemath_edges_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.basemath_edges
    ADD CONSTRAINT basemath_edges_pkey PRIMARY KEY (case_id, pp_basemath_id, sku_l, sku_r);

--
-- TOC entry 4391 (class 2606 OID 25190)
-- Name: cases cases_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cases
    ADD CONSTRAINT cases_pkey PRIMARY KEY (id);

--
-- TOC entry 4698 (class 2606 OID 37627)
-- Name: changelogs changelogs_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.changelogs
    ADD CONSTRAINT changelogs_pkey PRIMARY KEY (id);

--
-- TOC entry 4393 (class 2606 OID 25192)
-- Name: dataset_metadata files_metadata_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.dataset_metadata
    ADD CONSTRAINT files_metadata_pkey PRIMARY KEY (id);

--
-- TOC entry 4397 (class 2606 OID 25194)
-- Name: partitions_raw_dataset_mapping partition_dataset_mappings_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.partitions_raw_dataset_mapping
    ADD CONSTRAINT partition_dataset_mappings_pkey PRIMARY KEY (id);

--
-- TOC entry 4706 (class 2606 OID 131202)
-- Name: partition_dataset_metadata partition_dataset_metadata_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.partition_dataset_metadata
    ADD CONSTRAINT partition_dataset_metadata_pkey PRIMARY KEY (id);

--
-- TOC entry 4395 (class 2606 OID 25196)
-- Name: partitions partitions_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.partitions
    ADD CONSTRAINT partitions_pkey PRIMARY KEY (id);

--
-- TOC entry 4696 (class 2606 OID 29296)
-- Name: preprocessed_metadata preprocessed_metadata_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.preprocessed_metadata
    ADD CONSTRAINT preprocessed_metadata_pkey PRIMARY KEY (id);

--
-- TOC entry 4405 (class 2606 OID 25198)
-- Name: raw_attributes_data raw_attributes_pk; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_attributes_data
    ADD CONSTRAINT raw_attributes_pk PRIMARY KEY (case_id, id);

--
-- TOC entry 4412 (class 2606 OID 25200)
-- Name: raw_attributes_data_p0 raw_attributes_data_p0_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_attributes_data_p0
    ADD CONSTRAINT raw_attributes_data_p0_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4420 (class 2606 OID 25202)
-- Name: raw_attributes_data_p1 raw_attributes_data_p1_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_attributes_data_p1
    ADD CONSTRAINT raw_attributes_data_p1_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4428 (class 2606 OID 25204)
-- Name: raw_attributes_data_p2 raw_attributes_data_p2_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_attributes_data_p2
    ADD CONSTRAINT raw_attributes_data_p2_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4436 (class 2606 OID 25206)
-- Name: raw_attributes_data_p3 raw_attributes_data_p3_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_attributes_data_p3
    ADD CONSTRAINT raw_attributes_data_p3_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4444 (class 2606 OID 25208)
-- Name: raw_attributes_data_p4 raw_attributes_data_p4_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_attributes_data_p4
    ADD CONSTRAINT raw_attributes_data_p4_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4452 (class 2606 OID 25210)
-- Name: raw_attributes_data_p5 raw_attributes_data_p5_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_attributes_data_p5
    ADD CONSTRAINT raw_attributes_data_p5_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4460 (class 2606 OID 25212)
-- Name: raw_attributes_data_p6 raw_attributes_data_p6_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_attributes_data_p6
    ADD CONSTRAINT raw_attributes_data_p6_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4468 (class 2606 OID 25214)
-- Name: raw_attributes_data_p7 raw_attributes_data_p7_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_attributes_data_p7
    ADD CONSTRAINT raw_attributes_data_p7_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4477 (class 2606 OID 25216)
-- Name: raw_cross_purchase_data raw_cross_purchase_pk; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_cross_purchase_data
    ADD CONSTRAINT raw_cross_purchase_pk PRIMARY KEY (case_id, id);

--
-- TOC entry 4484 (class 2606 OID 25218)
-- Name: raw_cross_purchase_data_p0 raw_cross_purchase_data_p0_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_cross_purchase_data_p0
    ADD CONSTRAINT raw_cross_purchase_data_p0_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4492 (class 2606 OID 25220)
-- Name: raw_cross_purchase_data_p1 raw_cross_purchase_data_p1_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_cross_purchase_data_p1
    ADD CONSTRAINT raw_cross_purchase_data_p1_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4500 (class 2606 OID 25222)
-- Name: raw_cross_purchase_data_p2 raw_cross_purchase_data_p2_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_cross_purchase_data_p2
    ADD CONSTRAINT raw_cross_purchase_data_p2_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4508 (class 2606 OID 25224)
-- Name: raw_cross_purchase_data_p3 raw_cross_purchase_data_p3_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_cross_purchase_data_p3
    ADD CONSTRAINT raw_cross_purchase_data_p3_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4516 (class 2606 OID 25226)
-- Name: raw_cross_purchase_data_p4 raw_cross_purchase_data_p4_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_cross_purchase_data_p4
    ADD CONSTRAINT raw_cross_purchase_data_p4_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4524 (class 2606 OID 25228)
-- Name: raw_cross_purchase_data_p5 raw_cross_purchase_data_p5_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_cross_purchase_data_p5
    ADD CONSTRAINT raw_cross_purchase_data_p5_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4532 (class 2606 OID 25230)
-- Name: raw_cross_purchase_data_p6 raw_cross_purchase_data_p6_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_cross_purchase_data_p6
    ADD CONSTRAINT raw_cross_purchase_data_p6_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4540 (class 2606 OID 25232)
-- Name: raw_cross_purchase_data_p7 raw_cross_purchase_data_p7_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_cross_purchase_data_p7
    ADD CONSTRAINT raw_cross_purchase_data_p7_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4712 (class 2606 OID 131226)
-- Name: raw_grouping_data raw_grouping_data_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_grouping_data
    ADD CONSTRAINT raw_grouping_data_pkey PRIMARY KEY (id);

--
-- TOC entry 4549 (class 2606 OID 25234)
-- Name: raw_pos_data raw_pos_pk; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_pos_data
    ADD CONSTRAINT raw_pos_pk PRIMARY KEY (case_id, id);

--
-- TOC entry 4556 (class 2606 OID 25236)
-- Name: raw_pos_data_p0 raw_pos_data_p0_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_pos_data_p0
    ADD CONSTRAINT raw_pos_data_p0_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4564 (class 2606 OID 25238)
-- Name: raw_pos_data_p1 raw_pos_data_p1_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_pos_data_p1
    ADD CONSTRAINT raw_pos_data_p1_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4572 (class 2606 OID 25240)
-- Name: raw_pos_data_p2 raw_pos_data_p2_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_pos_data_p2
    ADD CONSTRAINT raw_pos_data_p2_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4580 (class 2606 OID 25242)
-- Name: raw_pos_data_p3 raw_pos_data_p3_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_pos_data_p3
    ADD CONSTRAINT raw_pos_data_p3_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4588 (class 2606 OID 25244)
-- Name: raw_pos_data_p4 raw_pos_data_p4_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_pos_data_p4
    ADD CONSTRAINT raw_pos_data_p4_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4596 (class 2606 OID 25246)
-- Name: raw_pos_data_p5 raw_pos_data_p5_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_pos_data_p5
    ADD CONSTRAINT raw_pos_data_p5_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4604 (class 2606 OID 25248)
-- Name: raw_pos_data_p6 raw_pos_data_p6_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_pos_data_p6
    ADD CONSTRAINT raw_pos_data_p6_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4612 (class 2606 OID 25250)
-- Name: raw_pos_data_p7 raw_pos_data_p7_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_pos_data_p7
    ADD CONSTRAINT raw_pos_data_p7_pkey PRIMARY KEY (case_id, id);

--
-- TOC entry 4694 (class 2606 OID 28484)
-- Name: preprocessed_sku_selection sku_selection_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.preprocessed_sku_selection
    ADD CONSTRAINT sku_selection_pkey PRIMARY KEY (id);

--
-- TOC entry 4615 (class 2606 OID 25252)
-- Name: user_assignments user_assignments_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.user_assignments
    ADD CONSTRAINT user_assignments_pkey PRIMARY KEY (id);

--
-- TOC entry 4618 (class 2606 OID 25254)
-- Name: workflows workflows_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);

--
-- TOC entry 4718 (class 2606 OID 131554)
-- Name: working_attributes_data working_attributes_data_pkey; Type: CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.working_attributes_data
    ADD CONSTRAINT working_attributes_data_pkey PRIMARY KEY (id);

--
-- TOC entry 4713 (class 1259 OID 131563)
-- Name: gin_wad_data_path_ops; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX gin_wad_data_path_ops ON core.working_attributes_data USING gin (data jsonb_path_ops);

--
-- TOC entry 4386 (class 1259 OID 32566)
-- Name: idx_bm_case_pp; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_bm_case_pp ON core.preprocessed_base_math USING btree (case_id, pp_metadata_id);

--
-- TOC entry 4387 (class 1259 OID 32567)
-- Name: idx_bm_data_gin; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_bm_data_gin ON core.preprocessed_base_math USING gin (data);

--
-- TOC entry 4701 (class 1259 OID 127678)
-- Name: idx_edges_case_pp_l; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_edges_case_pp_l ON core.basemath_edges USING btree (case_id, pp_basemath_id, sku_l);

--
-- TOC entry 4702 (class 1259 OID 127679)
-- Name: idx_edges_case_pp_r; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_edges_case_pp_r ON core.basemath_edges USING btree (case_id, pp_basemath_id, sku_r);

--
-- TOC entry 4388 (class 1259 OID 32588)
-- Name: idx_pbm_ppm_case; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_pbm_ppm_case ON core.preprocessed_base_math USING btree (pp_metadata_id, case_id);

--
-- TOC entry 4389 (class 1259 OID 32586)
-- Name: idx_pbm_skuname_ean; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_pbm_skuname_ean ON core.preprocessed_base_math USING btree (((data ->> 'skuname_ean'::text)));

--
-- TOC entry 4688 (class 1259 OID 66779)
-- Name: idx_pss_id; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_pss_id ON core.preprocessed_sku_selection USING btree (id);

--
-- TOC entry 4689 (class 1259 OID 32587)
-- Name: idx_pss_ppm_case; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_pss_ppm_case ON core.preprocessed_sku_selection USING btree (pp_metadata_id, case_id);

--
-- TOC entry 4690 (class 1259 OID 32585)
-- Name: idx_pss_skuname_ean; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_pss_skuname_ean ON core.preprocessed_sku_selection USING btree (((data ->> 'skuname_ean'::text)));

--
-- TOC entry 4398 (class 1259 OID 25308)
-- Name: idx_raw_attributes_case_id; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_raw_attributes_case_id ON ONLY core.raw_attributes_data USING btree (case_id);

--
-- TOC entry 4399 (class 1259 OID 25309)
-- Name: idx_raw_attributes_case_metadata; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_raw_attributes_case_metadata ON ONLY core.raw_attributes_data USING btree (case_id, metadata_id);

--
-- TOC entry 4400 (class 1259 OID 55458)
-- Name: idx_raw_attributes_case_metadata_rownum; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_raw_attributes_case_metadata_rownum ON ONLY core.raw_attributes_data USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4401 (class 1259 OID 25310)
-- Name: idx_raw_attributes_data_gin; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_raw_attributes_data_gin ON ONLY core.raw_attributes_data USING gin (data jsonb_path_ops);

--
-- TOC entry 4402 (class 1259 OID 25311)
-- Name: idx_raw_attributes_metadata_id; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_raw_attributes_metadata_id ON ONLY core.raw_attributes_data USING btree (metadata_id);

--
-- TOC entry 4403 (class 1259 OID 25312)
-- Name: idx_raw_attributes_tags_gin; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_raw_attributes_tags_gin ON ONLY core.raw_attributes_data USING gin (tags jsonb_path_ops);

--
-- TOC entry 4470 (class 1259 OID 25313)
-- Name: idx_raw_cross_purchase_case_id; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_raw_cross_purchase_case_id ON ONLY core.raw_cross_purchase_data USING btree (case_id);

--
-- TOC entry 4471 (class 1259 OID 25314)
-- Name: idx_raw_cross_purchase_case_metadata; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_raw_cross_purchase_case_metadata ON ONLY core.raw_cross_purchase_data USING btree (case_id, metadata_id);

--
-- TOC entry 4472 (class 1259 OID 55476)
-- Name: idx_raw_cross_purchase_case_metadata_rownum; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_raw_cross_purchase_case_metadata_rownum ON ONLY core.raw_cross_purchase_data USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4473 (class 1259 OID 25315)
-- Name: idx_raw_cross_purchase_data_gin; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_raw_cross_purchase_data_gin ON ONLY core.raw_cross_purchase_data USING gin (data jsonb_path_ops);

--
-- TOC entry 4474 (class 1259 OID 25316)
-- Name: idx_raw_cross_purchase_metadata_id; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_raw_cross_purchase_metadata_id ON ONLY core.raw_cross_purchase_data USING btree (metadata_id);

--
-- TOC entry 4475 (class 1259 OID 25317)
-- Name: idx_raw_cross_purchase_tags_gin; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_raw_cross_purchase_tags_gin ON ONLY core.raw_cross_purchase_data USING gin (tags jsonb_path_ops);

--
-- TOC entry 4542 (class 1259 OID 25318)
-- Name: idx_raw_pos_case_id; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_raw_pos_case_id ON ONLY core.raw_pos_data USING btree (case_id);

--
-- TOC entry 4543 (class 1259 OID 25319)
-- Name: idx_raw_pos_case_metadata; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_raw_pos_case_metadata ON ONLY core.raw_pos_data USING btree (case_id, metadata_id);

--
-- TOC entry 4544 (class 1259 OID 55494)
-- Name: idx_raw_pos_case_metadata_rownum; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_raw_pos_case_metadata_rownum ON ONLY core.raw_pos_data USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4545 (class 1259 OID 25320)
-- Name: idx_raw_pos_data_gin; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_raw_pos_data_gin ON ONLY core.raw_pos_data USING gin (data jsonb_path_ops);

--
-- TOC entry 4546 (class 1259 OID 25321)
-- Name: idx_raw_pos_metadata_id; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_raw_pos_metadata_id ON ONLY core.raw_pos_data USING btree (metadata_id);

--
-- TOC entry 4547 (class 1259 OID 25322)
-- Name: idx_raw_pos_tags_gin; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_raw_pos_tags_gin ON ONLY core.raw_pos_data USING gin (tags jsonb_path_ops);

--
-- TOC entry 4691 (class 1259 OID 32564)
-- Name: idx_sku_case_pp; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_sku_case_pp ON core.preprocessed_sku_selection USING btree (case_id, pp_metadata_id);

--
-- TOC entry 4692 (class 1259 OID 32565)
-- Name: idx_sku_data_gin; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_sku_data_gin ON core.preprocessed_sku_selection USING gin (data);

--
-- TOC entry 4714 (class 1259 OID 131561)
-- Name: idx_wad_case_partition; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_wad_case_partition ON core.working_attributes_data USING btree (case_id, partition_id);

--
-- TOC entry 4715 (class 1259 OID 131560)
-- Name: idx_wad_grouping_metadata_id; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_wad_grouping_metadata_id ON core.working_attributes_data USING btree (grouping_metadata_id);

--
-- TOC entry 4716 (class 1259 OID 131562)
-- Name: idx_wad_partition_id; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX idx_wad_partition_id ON core.working_attributes_data USING btree (partition_id);

--
-- TOC entry 4703 (class 1259 OID 131214)
-- Name: ix_partition_dataset_metadata_case; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX ix_partition_dataset_metadata_case ON core.partition_dataset_metadata USING btree (case_id);

--
-- TOC entry 4704 (class 1259 OID 131215)
-- Name: ix_partition_dataset_metadata_partition; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX ix_partition_dataset_metadata_partition ON core.partition_dataset_metadata USING btree (partition_id);

--
-- TOC entry 4708 (class 1259 OID 131242)
-- Name: ix_raw_grouping_data_case_partition; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX ix_raw_grouping_data_case_partition ON core.raw_grouping_data USING btree (case_id, partition_id);

--
-- TOC entry 4709 (class 1259 OID 131243)
-- Name: ix_raw_grouping_data_metadata; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX ix_raw_grouping_data_metadata ON core.raw_grouping_data USING btree (metadata_id);

--
-- TOC entry 4710 (class 1259 OID 131244)
-- Name: ix_raw_grouping_data_partition; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX ix_raw_grouping_data_partition ON core.raw_grouping_data USING btree (partition_id);

--
-- TOC entry 4406 (class 1259 OID 25323)
-- Name: raw_attributes_data_p0_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p0_case_id_idx ON core.raw_attributes_data_p0 USING btree (case_id);

--
-- TOC entry 4407 (class 1259 OID 25324)
-- Name: raw_attributes_data_p0_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p0_case_id_metadata_id_idx ON core.raw_attributes_data_p0 USING btree (case_id, metadata_id);

--
-- TOC entry 4408 (class 1259 OID 55459)
-- Name: raw_attributes_data_p0_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p0_case_id_metadata_id_row_num_idx ON core.raw_attributes_data_p0 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4409 (class 1259 OID 25325)
-- Name: raw_attributes_data_p0_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p0_data_idx ON core.raw_attributes_data_p0 USING gin (data jsonb_path_ops);

--
-- TOC entry 4410 (class 1259 OID 25326)
-- Name: raw_attributes_data_p0_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p0_metadata_id_idx ON core.raw_attributes_data_p0 USING btree (metadata_id);

--
-- TOC entry 4413 (class 1259 OID 25327)
-- Name: raw_attributes_data_p0_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p0_tags_idx ON core.raw_attributes_data_p0 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4414 (class 1259 OID 25328)
-- Name: raw_attributes_data_p1_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p1_case_id_idx ON core.raw_attributes_data_p1 USING btree (case_id);

--
-- TOC entry 4415 (class 1259 OID 25329)
-- Name: raw_attributes_data_p1_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p1_case_id_metadata_id_idx ON core.raw_attributes_data_p1 USING btree (case_id, metadata_id);

--
-- TOC entry 4416 (class 1259 OID 55460)
-- Name: raw_attributes_data_p1_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p1_case_id_metadata_id_row_num_idx ON core.raw_attributes_data_p1 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4417 (class 1259 OID 25330)
-- Name: raw_attributes_data_p1_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p1_data_idx ON core.raw_attributes_data_p1 USING gin (data jsonb_path_ops);

--
-- TOC entry 4418 (class 1259 OID 25331)
-- Name: raw_attributes_data_p1_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p1_metadata_id_idx ON core.raw_attributes_data_p1 USING btree (metadata_id);

--
-- TOC entry 4421 (class 1259 OID 25332)
-- Name: raw_attributes_data_p1_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p1_tags_idx ON core.raw_attributes_data_p1 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4422 (class 1259 OID 25333)
-- Name: raw_attributes_data_p2_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p2_case_id_idx ON core.raw_attributes_data_p2 USING btree (case_id);

--
-- TOC entry 4423 (class 1259 OID 25334)
-- Name: raw_attributes_data_p2_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p2_case_id_metadata_id_idx ON core.raw_attributes_data_p2 USING btree (case_id, metadata_id);

--
-- TOC entry 4424 (class 1259 OID 55461)
-- Name: raw_attributes_data_p2_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p2_case_id_metadata_id_row_num_idx ON core.raw_attributes_data_p2 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4425 (class 1259 OID 25335)
-- Name: raw_attributes_data_p2_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p2_data_idx ON core.raw_attributes_data_p2 USING gin (data jsonb_path_ops);

--
-- TOC entry 4426 (class 1259 OID 25336)
-- Name: raw_attributes_data_p2_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p2_metadata_id_idx ON core.raw_attributes_data_p2 USING btree (metadata_id);

--
-- TOC entry 4429 (class 1259 OID 25337)
-- Name: raw_attributes_data_p2_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p2_tags_idx ON core.raw_attributes_data_p2 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4430 (class 1259 OID 25338)
-- Name: raw_attributes_data_p3_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p3_case_id_idx ON core.raw_attributes_data_p3 USING btree (case_id);

--
-- TOC entry 4431 (class 1259 OID 25339)
-- Name: raw_attributes_data_p3_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p3_case_id_metadata_id_idx ON core.raw_attributes_data_p3 USING btree (case_id, metadata_id);

--
-- TOC entry 4432 (class 1259 OID 55462)
-- Name: raw_attributes_data_p3_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p3_case_id_metadata_id_row_num_idx ON core.raw_attributes_data_p3 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4433 (class 1259 OID 25340)
-- Name: raw_attributes_data_p3_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p3_data_idx ON core.raw_attributes_data_p3 USING gin (data jsonb_path_ops);

--
-- TOC entry 4434 (class 1259 OID 25341)
-- Name: raw_attributes_data_p3_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p3_metadata_id_idx ON core.raw_attributes_data_p3 USING btree (metadata_id);

--
-- TOC entry 4437 (class 1259 OID 25342)
-- Name: raw_attributes_data_p3_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p3_tags_idx ON core.raw_attributes_data_p3 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4438 (class 1259 OID 25343)
-- Name: raw_attributes_data_p4_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p4_case_id_idx ON core.raw_attributes_data_p4 USING btree (case_id);

--
-- TOC entry 4439 (class 1259 OID 25344)
-- Name: raw_attributes_data_p4_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p4_case_id_metadata_id_idx ON core.raw_attributes_data_p4 USING btree (case_id, metadata_id);

--
-- TOC entry 4440 (class 1259 OID 55463)
-- Name: raw_attributes_data_p4_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p4_case_id_metadata_id_row_num_idx ON core.raw_attributes_data_p4 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4441 (class 1259 OID 25345)
-- Name: raw_attributes_data_p4_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p4_data_idx ON core.raw_attributes_data_p4 USING gin (data jsonb_path_ops);

--
-- TOC entry 4442 (class 1259 OID 25346)
-- Name: raw_attributes_data_p4_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p4_metadata_id_idx ON core.raw_attributes_data_p4 USING btree (metadata_id);

--
-- TOC entry 4445 (class 1259 OID 25347)
-- Name: raw_attributes_data_p4_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p4_tags_idx ON core.raw_attributes_data_p4 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4446 (class 1259 OID 25348)
-- Name: raw_attributes_data_p5_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p5_case_id_idx ON core.raw_attributes_data_p5 USING btree (case_id);

--
-- TOC entry 4447 (class 1259 OID 25349)
-- Name: raw_attributes_data_p5_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p5_case_id_metadata_id_idx ON core.raw_attributes_data_p5 USING btree (case_id, metadata_id);

--
-- TOC entry 4448 (class 1259 OID 55464)
-- Name: raw_attributes_data_p5_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p5_case_id_metadata_id_row_num_idx ON core.raw_attributes_data_p5 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4449 (class 1259 OID 25350)
-- Name: raw_attributes_data_p5_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p5_data_idx ON core.raw_attributes_data_p5 USING gin (data jsonb_path_ops);

--
-- TOC entry 4450 (class 1259 OID 25351)
-- Name: raw_attributes_data_p5_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p5_metadata_id_idx ON core.raw_attributes_data_p5 USING btree (metadata_id);

--
-- TOC entry 4453 (class 1259 OID 25352)
-- Name: raw_attributes_data_p5_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p5_tags_idx ON core.raw_attributes_data_p5 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4454 (class 1259 OID 25353)
-- Name: raw_attributes_data_p6_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p6_case_id_idx ON core.raw_attributes_data_p6 USING btree (case_id);

--
-- TOC entry 4455 (class 1259 OID 25354)
-- Name: raw_attributes_data_p6_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p6_case_id_metadata_id_idx ON core.raw_attributes_data_p6 USING btree (case_id, metadata_id);

--
-- TOC entry 4456 (class 1259 OID 55465)
-- Name: raw_attributes_data_p6_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p6_case_id_metadata_id_row_num_idx ON core.raw_attributes_data_p6 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4457 (class 1259 OID 25355)
-- Name: raw_attributes_data_p6_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p6_data_idx ON core.raw_attributes_data_p6 USING gin (data jsonb_path_ops);

--
-- TOC entry 4458 (class 1259 OID 25356)
-- Name: raw_attributes_data_p6_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p6_metadata_id_idx ON core.raw_attributes_data_p6 USING btree (metadata_id);

--
-- TOC entry 4461 (class 1259 OID 25357)
-- Name: raw_attributes_data_p6_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p6_tags_idx ON core.raw_attributes_data_p6 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4462 (class 1259 OID 25358)
-- Name: raw_attributes_data_p7_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p7_case_id_idx ON core.raw_attributes_data_p7 USING btree (case_id);

--
-- TOC entry 4463 (class 1259 OID 25359)
-- Name: raw_attributes_data_p7_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p7_case_id_metadata_id_idx ON core.raw_attributes_data_p7 USING btree (case_id, metadata_id);

--
-- TOC entry 4464 (class 1259 OID 55466)
-- Name: raw_attributes_data_p7_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p7_case_id_metadata_id_row_num_idx ON core.raw_attributes_data_p7 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4465 (class 1259 OID 25360)
-- Name: raw_attributes_data_p7_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p7_data_idx ON core.raw_attributes_data_p7 USING gin (data jsonb_path_ops);

--
-- TOC entry 4466 (class 1259 OID 25361)
-- Name: raw_attributes_data_p7_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p7_metadata_id_idx ON core.raw_attributes_data_p7 USING btree (metadata_id);

--
-- TOC entry 4469 (class 1259 OID 25362)
-- Name: raw_attributes_data_p7_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_attributes_data_p7_tags_idx ON core.raw_attributes_data_p7 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4478 (class 1259 OID 25363)
-- Name: raw_cross_purchase_data_p0_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p0_case_id_idx ON core.raw_cross_purchase_data_p0 USING btree (case_id);

--
-- TOC entry 4479 (class 1259 OID 25364)
-- Name: raw_cross_purchase_data_p0_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p0_case_id_metadata_id_idx ON core.raw_cross_purchase_data_p0 USING btree (case_id, metadata_id);

--
-- TOC entry 4480 (class 1259 OID 55477)
-- Name: raw_cross_purchase_data_p0_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p0_case_id_metadata_id_row_num_idx ON core.raw_cross_purchase_data_p0 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4481 (class 1259 OID 25365)
-- Name: raw_cross_purchase_data_p0_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p0_data_idx ON core.raw_cross_purchase_data_p0 USING gin (data jsonb_path_ops);

--
-- TOC entry 4482 (class 1259 OID 25366)
-- Name: raw_cross_purchase_data_p0_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p0_metadata_id_idx ON core.raw_cross_purchase_data_p0 USING btree (metadata_id);

--
-- TOC entry 4485 (class 1259 OID 25367)
-- Name: raw_cross_purchase_data_p0_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p0_tags_idx ON core.raw_cross_purchase_data_p0 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4486 (class 1259 OID 25368)
-- Name: raw_cross_purchase_data_p1_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p1_case_id_idx ON core.raw_cross_purchase_data_p1 USING btree (case_id);

--
-- TOC entry 4487 (class 1259 OID 25369)
-- Name: raw_cross_purchase_data_p1_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p1_case_id_metadata_id_idx ON core.raw_cross_purchase_data_p1 USING btree (case_id, metadata_id);

--
-- TOC entry 4488 (class 1259 OID 55478)
-- Name: raw_cross_purchase_data_p1_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p1_case_id_metadata_id_row_num_idx ON core.raw_cross_purchase_data_p1 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4489 (class 1259 OID 25370)
-- Name: raw_cross_purchase_data_p1_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p1_data_idx ON core.raw_cross_purchase_data_p1 USING gin (data jsonb_path_ops);

--
-- TOC entry 4490 (class 1259 OID 25371)
-- Name: raw_cross_purchase_data_p1_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p1_metadata_id_idx ON core.raw_cross_purchase_data_p1 USING btree (metadata_id);

--
-- TOC entry 4493 (class 1259 OID 25372)
-- Name: raw_cross_purchase_data_p1_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p1_tags_idx ON core.raw_cross_purchase_data_p1 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4494 (class 1259 OID 25373)
-- Name: raw_cross_purchase_data_p2_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p2_case_id_idx ON core.raw_cross_purchase_data_p2 USING btree (case_id);

--
-- TOC entry 4495 (class 1259 OID 25374)
-- Name: raw_cross_purchase_data_p2_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p2_case_id_metadata_id_idx ON core.raw_cross_purchase_data_p2 USING btree (case_id, metadata_id);

--
-- TOC entry 4496 (class 1259 OID 55479)
-- Name: raw_cross_purchase_data_p2_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p2_case_id_metadata_id_row_num_idx ON core.raw_cross_purchase_data_p2 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4497 (class 1259 OID 25375)
-- Name: raw_cross_purchase_data_p2_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p2_data_idx ON core.raw_cross_purchase_data_p2 USING gin (data jsonb_path_ops);

--
-- TOC entry 4498 (class 1259 OID 25376)
-- Name: raw_cross_purchase_data_p2_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p2_metadata_id_idx ON core.raw_cross_purchase_data_p2 USING btree (metadata_id);

--
-- TOC entry 4501 (class 1259 OID 25377)
-- Name: raw_cross_purchase_data_p2_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p2_tags_idx ON core.raw_cross_purchase_data_p2 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4502 (class 1259 OID 25378)
-- Name: raw_cross_purchase_data_p3_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p3_case_id_idx ON core.raw_cross_purchase_data_p3 USING btree (case_id);

--
-- TOC entry 4503 (class 1259 OID 25379)
-- Name: raw_cross_purchase_data_p3_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p3_case_id_metadata_id_idx ON core.raw_cross_purchase_data_p3 USING btree (case_id, metadata_id);

--
-- TOC entry 4504 (class 1259 OID 55480)
-- Name: raw_cross_purchase_data_p3_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p3_case_id_metadata_id_row_num_idx ON core.raw_cross_purchase_data_p3 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4505 (class 1259 OID 25380)
-- Name: raw_cross_purchase_data_p3_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p3_data_idx ON core.raw_cross_purchase_data_p3 USING gin (data jsonb_path_ops);

--
-- TOC entry 4506 (class 1259 OID 25381)
-- Name: raw_cross_purchase_data_p3_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p3_metadata_id_idx ON core.raw_cross_purchase_data_p3 USING btree (metadata_id);

--
-- TOC entry 4509 (class 1259 OID 25382)
-- Name: raw_cross_purchase_data_p3_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p3_tags_idx ON core.raw_cross_purchase_data_p3 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4510 (class 1259 OID 25383)
-- Name: raw_cross_purchase_data_p4_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p4_case_id_idx ON core.raw_cross_purchase_data_p4 USING btree (case_id);

--
-- TOC entry 4511 (class 1259 OID 25384)
-- Name: raw_cross_purchase_data_p4_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p4_case_id_metadata_id_idx ON core.raw_cross_purchase_data_p4 USING btree (case_id, metadata_id);

--
-- TOC entry 4512 (class 1259 OID 55481)
-- Name: raw_cross_purchase_data_p4_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p4_case_id_metadata_id_row_num_idx ON core.raw_cross_purchase_data_p4 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4513 (class 1259 OID 25385)
-- Name: raw_cross_purchase_data_p4_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p4_data_idx ON core.raw_cross_purchase_data_p4 USING gin (data jsonb_path_ops);

--
-- TOC entry 4514 (class 1259 OID 25386)
-- Name: raw_cross_purchase_data_p4_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p4_metadata_id_idx ON core.raw_cross_purchase_data_p4 USING btree (metadata_id);

--
-- TOC entry 4517 (class 1259 OID 25387)
-- Name: raw_cross_purchase_data_p4_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p4_tags_idx ON core.raw_cross_purchase_data_p4 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4518 (class 1259 OID 25388)
-- Name: raw_cross_purchase_data_p5_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p5_case_id_idx ON core.raw_cross_purchase_data_p5 USING btree (case_id);

--
-- TOC entry 4519 (class 1259 OID 25389)
-- Name: raw_cross_purchase_data_p5_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p5_case_id_metadata_id_idx ON core.raw_cross_purchase_data_p5 USING btree (case_id, metadata_id);

--
-- TOC entry 4520 (class 1259 OID 55482)
-- Name: raw_cross_purchase_data_p5_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p5_case_id_metadata_id_row_num_idx ON core.raw_cross_purchase_data_p5 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4521 (class 1259 OID 25390)
-- Name: raw_cross_purchase_data_p5_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p5_data_idx ON core.raw_cross_purchase_data_p5 USING gin (data jsonb_path_ops);

--
-- TOC entry 4522 (class 1259 OID 25391)
-- Name: raw_cross_purchase_data_p5_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p5_metadata_id_idx ON core.raw_cross_purchase_data_p5 USING btree (metadata_id);

--
-- TOC entry 4525 (class 1259 OID 25392)
-- Name: raw_cross_purchase_data_p5_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p5_tags_idx ON core.raw_cross_purchase_data_p5 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4526 (class 1259 OID 25393)
-- Name: raw_cross_purchase_data_p6_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p6_case_id_idx ON core.raw_cross_purchase_data_p6 USING btree (case_id);

--
-- TOC entry 4527 (class 1259 OID 25394)
-- Name: raw_cross_purchase_data_p6_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p6_case_id_metadata_id_idx ON core.raw_cross_purchase_data_p6 USING btree (case_id, metadata_id);

--
-- TOC entry 4528 (class 1259 OID 55483)
-- Name: raw_cross_purchase_data_p6_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p6_case_id_metadata_id_row_num_idx ON core.raw_cross_purchase_data_p6 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4529 (class 1259 OID 25395)
-- Name: raw_cross_purchase_data_p6_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p6_data_idx ON core.raw_cross_purchase_data_p6 USING gin (data jsonb_path_ops);

--
-- TOC entry 4530 (class 1259 OID 25396)
-- Name: raw_cross_purchase_data_p6_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p6_metadata_id_idx ON core.raw_cross_purchase_data_p6 USING btree (metadata_id);

--
-- TOC entry 4533 (class 1259 OID 25397)
-- Name: raw_cross_purchase_data_p6_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p6_tags_idx ON core.raw_cross_purchase_data_p6 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4534 (class 1259 OID 25398)
-- Name: raw_cross_purchase_data_p7_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p7_case_id_idx ON core.raw_cross_purchase_data_p7 USING btree (case_id);

--
-- TOC entry 4535 (class 1259 OID 25399)
-- Name: raw_cross_purchase_data_p7_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p7_case_id_metadata_id_idx ON core.raw_cross_purchase_data_p7 USING btree (case_id, metadata_id);

--
-- TOC entry 4536 (class 1259 OID 55484)
-- Name: raw_cross_purchase_data_p7_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p7_case_id_metadata_id_row_num_idx ON core.raw_cross_purchase_data_p7 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4537 (class 1259 OID 25400)
-- Name: raw_cross_purchase_data_p7_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p7_data_idx ON core.raw_cross_purchase_data_p7 USING gin (data jsonb_path_ops);

--
-- TOC entry 4538 (class 1259 OID 25401)
-- Name: raw_cross_purchase_data_p7_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p7_metadata_id_idx ON core.raw_cross_purchase_data_p7 USING btree (metadata_id);

--
-- TOC entry 4541 (class 1259 OID 25402)
-- Name: raw_cross_purchase_data_p7_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_cross_purchase_data_p7_tags_idx ON core.raw_cross_purchase_data_p7 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4550 (class 1259 OID 25403)
-- Name: raw_pos_data_p0_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p0_case_id_idx ON core.raw_pos_data_p0 USING btree (case_id);

--
-- TOC entry 4551 (class 1259 OID 25404)
-- Name: raw_pos_data_p0_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p0_case_id_metadata_id_idx ON core.raw_pos_data_p0 USING btree (case_id, metadata_id);

--
-- TOC entry 4552 (class 1259 OID 55495)
-- Name: raw_pos_data_p0_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p0_case_id_metadata_id_row_num_idx ON core.raw_pos_data_p0 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4553 (class 1259 OID 25405)
-- Name: raw_pos_data_p0_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p0_data_idx ON core.raw_pos_data_p0 USING gin (data jsonb_path_ops);

--
-- TOC entry 4554 (class 1259 OID 25406)
-- Name: raw_pos_data_p0_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p0_metadata_id_idx ON core.raw_pos_data_p0 USING btree (metadata_id);

--
-- TOC entry 4557 (class 1259 OID 25407)
-- Name: raw_pos_data_p0_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p0_tags_idx ON core.raw_pos_data_p0 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4558 (class 1259 OID 25408)
-- Name: raw_pos_data_p1_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p1_case_id_idx ON core.raw_pos_data_p1 USING btree (case_id);

--
-- TOC entry 4559 (class 1259 OID 25409)
-- Name: raw_pos_data_p1_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p1_case_id_metadata_id_idx ON core.raw_pos_data_p1 USING btree (case_id, metadata_id);

--
-- TOC entry 4560 (class 1259 OID 55496)
-- Name: raw_pos_data_p1_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p1_case_id_metadata_id_row_num_idx ON core.raw_pos_data_p1 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4561 (class 1259 OID 25410)
-- Name: raw_pos_data_p1_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p1_data_idx ON core.raw_pos_data_p1 USING gin (data jsonb_path_ops);

--
-- TOC entry 4562 (class 1259 OID 25411)
-- Name: raw_pos_data_p1_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p1_metadata_id_idx ON core.raw_pos_data_p1 USING btree (metadata_id);

--
-- TOC entry 4565 (class 1259 OID 25412)
-- Name: raw_pos_data_p1_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p1_tags_idx ON core.raw_pos_data_p1 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4566 (class 1259 OID 25413)
-- Name: raw_pos_data_p2_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p2_case_id_idx ON core.raw_pos_data_p2 USING btree (case_id);

--
-- TOC entry 4567 (class 1259 OID 25414)
-- Name: raw_pos_data_p2_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p2_case_id_metadata_id_idx ON core.raw_pos_data_p2 USING btree (case_id, metadata_id);

--
-- TOC entry 4568 (class 1259 OID 55497)
-- Name: raw_pos_data_p2_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p2_case_id_metadata_id_row_num_idx ON core.raw_pos_data_p2 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4569 (class 1259 OID 25415)
-- Name: raw_pos_data_p2_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p2_data_idx ON core.raw_pos_data_p2 USING gin (data jsonb_path_ops);

--
-- TOC entry 4570 (class 1259 OID 25416)
-- Name: raw_pos_data_p2_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p2_metadata_id_idx ON core.raw_pos_data_p2 USING btree (metadata_id);

--
-- TOC entry 4573 (class 1259 OID 25417)
-- Name: raw_pos_data_p2_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p2_tags_idx ON core.raw_pos_data_p2 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4574 (class 1259 OID 25418)
-- Name: raw_pos_data_p3_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p3_case_id_idx ON core.raw_pos_data_p3 USING btree (case_id);

--
-- TOC entry 4575 (class 1259 OID 25419)
-- Name: raw_pos_data_p3_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p3_case_id_metadata_id_idx ON core.raw_pos_data_p3 USING btree (case_id, metadata_id);

--
-- TOC entry 4576 (class 1259 OID 55498)
-- Name: raw_pos_data_p3_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p3_case_id_metadata_id_row_num_idx ON core.raw_pos_data_p3 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4577 (class 1259 OID 25420)
-- Name: raw_pos_data_p3_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p3_data_idx ON core.raw_pos_data_p3 USING gin (data jsonb_path_ops);

--
-- TOC entry 4578 (class 1259 OID 25421)
-- Name: raw_pos_data_p3_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p3_metadata_id_idx ON core.raw_pos_data_p3 USING btree (metadata_id);

--
-- TOC entry 4581 (class 1259 OID 25422)
-- Name: raw_pos_data_p3_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p3_tags_idx ON core.raw_pos_data_p3 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4582 (class 1259 OID 25423)
-- Name: raw_pos_data_p4_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p4_case_id_idx ON core.raw_pos_data_p4 USING btree (case_id);

--
-- TOC entry 4583 (class 1259 OID 25424)
-- Name: raw_pos_data_p4_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p4_case_id_metadata_id_idx ON core.raw_pos_data_p4 USING btree (case_id, metadata_id);

--
-- TOC entry 4584 (class 1259 OID 55499)
-- Name: raw_pos_data_p4_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p4_case_id_metadata_id_row_num_idx ON core.raw_pos_data_p4 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4585 (class 1259 OID 25425)
-- Name: raw_pos_data_p4_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p4_data_idx ON core.raw_pos_data_p4 USING gin (data jsonb_path_ops);

--
-- TOC entry 4586 (class 1259 OID 25426)
-- Name: raw_pos_data_p4_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p4_metadata_id_idx ON core.raw_pos_data_p4 USING btree (metadata_id);

--
-- TOC entry 4589 (class 1259 OID 25427)
-- Name: raw_pos_data_p4_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p4_tags_idx ON core.raw_pos_data_p4 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4590 (class 1259 OID 25428)
-- Name: raw_pos_data_p5_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p5_case_id_idx ON core.raw_pos_data_p5 USING btree (case_id);

--
-- TOC entry 4591 (class 1259 OID 25429)
-- Name: raw_pos_data_p5_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p5_case_id_metadata_id_idx ON core.raw_pos_data_p5 USING btree (case_id, metadata_id);

--
-- TOC entry 4592 (class 1259 OID 55500)
-- Name: raw_pos_data_p5_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p5_case_id_metadata_id_row_num_idx ON core.raw_pos_data_p5 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4593 (class 1259 OID 25430)
-- Name: raw_pos_data_p5_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p5_data_idx ON core.raw_pos_data_p5 USING gin (data jsonb_path_ops);

--
-- TOC entry 4594 (class 1259 OID 25431)
-- Name: raw_pos_data_p5_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p5_metadata_id_idx ON core.raw_pos_data_p5 USING btree (metadata_id);

--
-- TOC entry 4597 (class 1259 OID 25432)
-- Name: raw_pos_data_p5_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p5_tags_idx ON core.raw_pos_data_p5 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4598 (class 1259 OID 25433)
-- Name: raw_pos_data_p6_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p6_case_id_idx ON core.raw_pos_data_p6 USING btree (case_id);

--
-- TOC entry 4599 (class 1259 OID 25434)
-- Name: raw_pos_data_p6_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p6_case_id_metadata_id_idx ON core.raw_pos_data_p6 USING btree (case_id, metadata_id);

--
-- TOC entry 4600 (class 1259 OID 55501)
-- Name: raw_pos_data_p6_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p6_case_id_metadata_id_row_num_idx ON core.raw_pos_data_p6 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4601 (class 1259 OID 25435)
-- Name: raw_pos_data_p6_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p6_data_idx ON core.raw_pos_data_p6 USING gin (data jsonb_path_ops);

--
-- TOC entry 4602 (class 1259 OID 25436)
-- Name: raw_pos_data_p6_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p6_metadata_id_idx ON core.raw_pos_data_p6 USING btree (metadata_id);

--
-- TOC entry 4605 (class 1259 OID 25437)
-- Name: raw_pos_data_p6_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p6_tags_idx ON core.raw_pos_data_p6 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4606 (class 1259 OID 25438)
-- Name: raw_pos_data_p7_case_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p7_case_id_idx ON core.raw_pos_data_p7 USING btree (case_id);

--
-- TOC entry 4607 (class 1259 OID 25439)
-- Name: raw_pos_data_p7_case_id_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p7_case_id_metadata_id_idx ON core.raw_pos_data_p7 USING btree (case_id, metadata_id);

--
-- TOC entry 4608 (class 1259 OID 55502)
-- Name: raw_pos_data_p7_case_id_metadata_id_row_num_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p7_case_id_metadata_id_row_num_idx ON core.raw_pos_data_p7 USING btree (case_id, metadata_id, row_num);

--
-- TOC entry 4609 (class 1259 OID 25440)
-- Name: raw_pos_data_p7_data_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p7_data_idx ON core.raw_pos_data_p7 USING gin (data jsonb_path_ops);

--
-- TOC entry 4610 (class 1259 OID 25441)
-- Name: raw_pos_data_p7_metadata_id_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p7_metadata_id_idx ON core.raw_pos_data_p7 USING btree (metadata_id);

--
-- TOC entry 4613 (class 1259 OID 25442)
-- Name: raw_pos_data_p7_tags_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX raw_pos_data_p7_tags_idx ON core.raw_pos_data_p7 USING gin (tags jsonb_path_ops);

--
-- TOC entry 4707 (class 1259 OID 131213)
-- Name: uq_partition_dataset_metadata_active; Type: INDEX; Schema: core; Owner: -
--

CREATE UNIQUE INDEX uq_partition_dataset_metadata_active ON core.partition_dataset_metadata USING btree (case_id, partition_id, data_type) WHERE (is_deleted = false);

--
-- TOC entry 4616 (class 1259 OID 25443)
-- Name: workflows_partition_id_step_number_idx; Type: INDEX; Schema: core; Owner: -
--

CREATE INDEX workflows_partition_id_step_number_idx ON core.workflows USING btree (partition_id, step_number);

--
-- TOC entry 4719 (class 0 OID 0)
-- Name: raw_attributes_data_p0_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_id ATTACH PARTITION core.raw_attributes_data_p0_case_id_idx;

--
-- TOC entry 4720 (class 0 OID 0)
-- Name: raw_attributes_data_p0_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_metadata ATTACH PARTITION core.raw_attributes_data_p0_case_id_metadata_id_idx;

--
-- TOC entry 4721 (class 0 OID 0)
-- Name: raw_attributes_data_p0_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_metadata_rownum ATTACH PARTITION core.raw_attributes_data_p0_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4722 (class 0 OID 0)
-- Name: raw_attributes_data_p0_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_data_gin ATTACH PARTITION core.raw_attributes_data_p0_data_idx;

--
-- TOC entry 4723 (class 0 OID 0)
-- Name: raw_attributes_data_p0_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_metadata_id ATTACH PARTITION core.raw_attributes_data_p0_metadata_id_idx;

--
-- TOC entry 4724 (class 0 OID 0)
-- Name: raw_attributes_data_p0_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_attributes_pk ATTACH PARTITION core.raw_attributes_data_p0_pkey;

--
-- TOC entry 4725 (class 0 OID 0)
-- Name: raw_attributes_data_p0_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_tags_gin ATTACH PARTITION core.raw_attributes_data_p0_tags_idx;

--
-- TOC entry 4726 (class 0 OID 0)
-- Name: raw_attributes_data_p1_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_id ATTACH PARTITION core.raw_attributes_data_p1_case_id_idx;

--
-- TOC entry 4727 (class 0 OID 0)
-- Name: raw_attributes_data_p1_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_metadata ATTACH PARTITION core.raw_attributes_data_p1_case_id_metadata_id_idx;

--
-- TOC entry 4728 (class 0 OID 0)
-- Name: raw_attributes_data_p1_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_metadata_rownum ATTACH PARTITION core.raw_attributes_data_p1_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4729 (class 0 OID 0)
-- Name: raw_attributes_data_p1_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_data_gin ATTACH PARTITION core.raw_attributes_data_p1_data_idx;

--
-- TOC entry 4730 (class 0 OID 0)
-- Name: raw_attributes_data_p1_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_metadata_id ATTACH PARTITION core.raw_attributes_data_p1_metadata_id_idx;

--
-- TOC entry 4731 (class 0 OID 0)
-- Name: raw_attributes_data_p1_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_attributes_pk ATTACH PARTITION core.raw_attributes_data_p1_pkey;

--
-- TOC entry 4732 (class 0 OID 0)
-- Name: raw_attributes_data_p1_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_tags_gin ATTACH PARTITION core.raw_attributes_data_p1_tags_idx;

--
-- TOC entry 4733 (class 0 OID 0)
-- Name: raw_attributes_data_p2_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_id ATTACH PARTITION core.raw_attributes_data_p2_case_id_idx;

--
-- TOC entry 4734 (class 0 OID 0)
-- Name: raw_attributes_data_p2_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_metadata ATTACH PARTITION core.raw_attributes_data_p2_case_id_metadata_id_idx;

--
-- TOC entry 4735 (class 0 OID 0)
-- Name: raw_attributes_data_p2_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_metadata_rownum ATTACH PARTITION core.raw_attributes_data_p2_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4736 (class 0 OID 0)
-- Name: raw_attributes_data_p2_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_data_gin ATTACH PARTITION core.raw_attributes_data_p2_data_idx;

--
-- TOC entry 4737 (class 0 OID 0)
-- Name: raw_attributes_data_p2_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_metadata_id ATTACH PARTITION core.raw_attributes_data_p2_metadata_id_idx;

--
-- TOC entry 4738 (class 0 OID 0)
-- Name: raw_attributes_data_p2_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_attributes_pk ATTACH PARTITION core.raw_attributes_data_p2_pkey;

--
-- TOC entry 4739 (class 0 OID 0)
-- Name: raw_attributes_data_p2_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_tags_gin ATTACH PARTITION core.raw_attributes_data_p2_tags_idx;

--
-- TOC entry 4740 (class 0 OID 0)
-- Name: raw_attributes_data_p3_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_id ATTACH PARTITION core.raw_attributes_data_p3_case_id_idx;

--
-- TOC entry 4741 (class 0 OID 0)
-- Name: raw_attributes_data_p3_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_metadata ATTACH PARTITION core.raw_attributes_data_p3_case_id_metadata_id_idx;

--
-- TOC entry 4742 (class 0 OID 0)
-- Name: raw_attributes_data_p3_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_metadata_rownum ATTACH PARTITION core.raw_attributes_data_p3_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4743 (class 0 OID 0)
-- Name: raw_attributes_data_p3_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_data_gin ATTACH PARTITION core.raw_attributes_data_p3_data_idx;

--
-- TOC entry 4744 (class 0 OID 0)
-- Name: raw_attributes_data_p3_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_metadata_id ATTACH PARTITION core.raw_attributes_data_p3_metadata_id_idx;

--
-- TOC entry 4745 (class 0 OID 0)
-- Name: raw_attributes_data_p3_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_attributes_pk ATTACH PARTITION core.raw_attributes_data_p3_pkey;

--
-- TOC entry 4746 (class 0 OID 0)
-- Name: raw_attributes_data_p3_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_tags_gin ATTACH PARTITION core.raw_attributes_data_p3_tags_idx;

--
-- TOC entry 4747 (class 0 OID 0)
-- Name: raw_attributes_data_p4_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_id ATTACH PARTITION core.raw_attributes_data_p4_case_id_idx;

--
-- TOC entry 4748 (class 0 OID 0)
-- Name: raw_attributes_data_p4_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_metadata ATTACH PARTITION core.raw_attributes_data_p4_case_id_metadata_id_idx;

--
-- TOC entry 4749 (class 0 OID 0)
-- Name: raw_attributes_data_p4_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_metadata_rownum ATTACH PARTITION core.raw_attributes_data_p4_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4750 (class 0 OID 0)
-- Name: raw_attributes_data_p4_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_data_gin ATTACH PARTITION core.raw_attributes_data_p4_data_idx;

--
-- TOC entry 4751 (class 0 OID 0)
-- Name: raw_attributes_data_p4_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_metadata_id ATTACH PARTITION core.raw_attributes_data_p4_metadata_id_idx;

--
-- TOC entry 4752 (class 0 OID 0)
-- Name: raw_attributes_data_p4_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_attributes_pk ATTACH PARTITION core.raw_attributes_data_p4_pkey;

--
-- TOC entry 4753 (class 0 OID 0)
-- Name: raw_attributes_data_p4_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_tags_gin ATTACH PARTITION core.raw_attributes_data_p4_tags_idx;

--
-- TOC entry 4754 (class 0 OID 0)
-- Name: raw_attributes_data_p5_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_id ATTACH PARTITION core.raw_attributes_data_p5_case_id_idx;

--
-- TOC entry 4755 (class 0 OID 0)
-- Name: raw_attributes_data_p5_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_metadata ATTACH PARTITION core.raw_attributes_data_p5_case_id_metadata_id_idx;

--
-- TOC entry 4756 (class 0 OID 0)
-- Name: raw_attributes_data_p5_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_metadata_rownum ATTACH PARTITION core.raw_attributes_data_p5_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4757 (class 0 OID 0)
-- Name: raw_attributes_data_p5_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_data_gin ATTACH PARTITION core.raw_attributes_data_p5_data_idx;

--
-- TOC entry 4758 (class 0 OID 0)
-- Name: raw_attributes_data_p5_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_metadata_id ATTACH PARTITION core.raw_attributes_data_p5_metadata_id_idx;

--
-- TOC entry 4759 (class 0 OID 0)
-- Name: raw_attributes_data_p5_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_attributes_pk ATTACH PARTITION core.raw_attributes_data_p5_pkey;

--
-- TOC entry 4760 (class 0 OID 0)
-- Name: raw_attributes_data_p5_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_tags_gin ATTACH PARTITION core.raw_attributes_data_p5_tags_idx;

--
-- TOC entry 4761 (class 0 OID 0)
-- Name: raw_attributes_data_p6_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_id ATTACH PARTITION core.raw_attributes_data_p6_case_id_idx;

--
-- TOC entry 4762 (class 0 OID 0)
-- Name: raw_attributes_data_p6_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_metadata ATTACH PARTITION core.raw_attributes_data_p6_case_id_metadata_id_idx;

--
-- TOC entry 4763 (class 0 OID 0)
-- Name: raw_attributes_data_p6_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_metadata_rownum ATTACH PARTITION core.raw_attributes_data_p6_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4764 (class 0 OID 0)
-- Name: raw_attributes_data_p6_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_data_gin ATTACH PARTITION core.raw_attributes_data_p6_data_idx;

--
-- TOC entry 4765 (class 0 OID 0)
-- Name: raw_attributes_data_p6_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_metadata_id ATTACH PARTITION core.raw_attributes_data_p6_metadata_id_idx;

--
-- TOC entry 4766 (class 0 OID 0)
-- Name: raw_attributes_data_p6_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_attributes_pk ATTACH PARTITION core.raw_attributes_data_p6_pkey;

--
-- TOC entry 4767 (class 0 OID 0)
-- Name: raw_attributes_data_p6_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_tags_gin ATTACH PARTITION core.raw_attributes_data_p6_tags_idx;

--
-- TOC entry 4768 (class 0 OID 0)
-- Name: raw_attributes_data_p7_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_id ATTACH PARTITION core.raw_attributes_data_p7_case_id_idx;

--
-- TOC entry 4769 (class 0 OID 0)
-- Name: raw_attributes_data_p7_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_metadata ATTACH PARTITION core.raw_attributes_data_p7_case_id_metadata_id_idx;

--
-- TOC entry 4770 (class 0 OID 0)
-- Name: raw_attributes_data_p7_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_case_metadata_rownum ATTACH PARTITION core.raw_attributes_data_p7_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4771 (class 0 OID 0)
-- Name: raw_attributes_data_p7_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_data_gin ATTACH PARTITION core.raw_attributes_data_p7_data_idx;

--
-- TOC entry 4772 (class 0 OID 0)
-- Name: raw_attributes_data_p7_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_metadata_id ATTACH PARTITION core.raw_attributes_data_p7_metadata_id_idx;

--
-- TOC entry 4773 (class 0 OID 0)
-- Name: raw_attributes_data_p7_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_attributes_pk ATTACH PARTITION core.raw_attributes_data_p7_pkey;

--
-- TOC entry 4774 (class 0 OID 0)
-- Name: raw_attributes_data_p7_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_attributes_tags_gin ATTACH PARTITION core.raw_attributes_data_p7_tags_idx;

--
-- TOC entry 4775 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p0_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_id ATTACH PARTITION core.raw_cross_purchase_data_p0_case_id_idx;

--
-- TOC entry 4776 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p0_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_metadata ATTACH PARTITION core.raw_cross_purchase_data_p0_case_id_metadata_id_idx;

--
-- TOC entry 4777 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p0_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_metadata_rownum ATTACH PARTITION core.raw_cross_purchase_data_p0_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4778 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p0_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_data_gin ATTACH PARTITION core.raw_cross_purchase_data_p0_data_idx;

--
-- TOC entry 4779 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p0_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_metadata_id ATTACH PARTITION core.raw_cross_purchase_data_p0_metadata_id_idx;

--
-- TOC entry 4780 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p0_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_cross_purchase_pk ATTACH PARTITION core.raw_cross_purchase_data_p0_pkey;

--
-- TOC entry 4781 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p0_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_tags_gin ATTACH PARTITION core.raw_cross_purchase_data_p0_tags_idx;

--
-- TOC entry 4782 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p1_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_id ATTACH PARTITION core.raw_cross_purchase_data_p1_case_id_idx;

--
-- TOC entry 4783 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p1_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_metadata ATTACH PARTITION core.raw_cross_purchase_data_p1_case_id_metadata_id_idx;

--
-- TOC entry 4784 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p1_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_metadata_rownum ATTACH PARTITION core.raw_cross_purchase_data_p1_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4785 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p1_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_data_gin ATTACH PARTITION core.raw_cross_purchase_data_p1_data_idx;

--
-- TOC entry 4786 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p1_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_metadata_id ATTACH PARTITION core.raw_cross_purchase_data_p1_metadata_id_idx;

--
-- TOC entry 4787 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p1_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_cross_purchase_pk ATTACH PARTITION core.raw_cross_purchase_data_p1_pkey;

--
-- TOC entry 4788 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p1_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_tags_gin ATTACH PARTITION core.raw_cross_purchase_data_p1_tags_idx;

--
-- TOC entry 4789 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p2_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_id ATTACH PARTITION core.raw_cross_purchase_data_p2_case_id_idx;

--
-- TOC entry 4790 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p2_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_metadata ATTACH PARTITION core.raw_cross_purchase_data_p2_case_id_metadata_id_idx;

--
-- TOC entry 4791 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p2_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_metadata_rownum ATTACH PARTITION core.raw_cross_purchase_data_p2_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4792 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p2_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_data_gin ATTACH PARTITION core.raw_cross_purchase_data_p2_data_idx;

--
-- TOC entry 4793 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p2_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_metadata_id ATTACH PARTITION core.raw_cross_purchase_data_p2_metadata_id_idx;

--
-- TOC entry 4794 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p2_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_cross_purchase_pk ATTACH PARTITION core.raw_cross_purchase_data_p2_pkey;

--
-- TOC entry 4795 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p2_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_tags_gin ATTACH PARTITION core.raw_cross_purchase_data_p2_tags_idx;

--
-- TOC entry 4796 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p3_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_id ATTACH PARTITION core.raw_cross_purchase_data_p3_case_id_idx;

--
-- TOC entry 4797 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p3_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_metadata ATTACH PARTITION core.raw_cross_purchase_data_p3_case_id_metadata_id_idx;

--
-- TOC entry 4798 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p3_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_metadata_rownum ATTACH PARTITION core.raw_cross_purchase_data_p3_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4799 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p3_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_data_gin ATTACH PARTITION core.raw_cross_purchase_data_p3_data_idx;

--
-- TOC entry 4800 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p3_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_metadata_id ATTACH PARTITION core.raw_cross_purchase_data_p3_metadata_id_idx;

--
-- TOC entry 4801 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p3_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_cross_purchase_pk ATTACH PARTITION core.raw_cross_purchase_data_p3_pkey;

--
-- TOC entry 4802 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p3_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_tags_gin ATTACH PARTITION core.raw_cross_purchase_data_p3_tags_idx;

--
-- TOC entry 4803 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p4_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_id ATTACH PARTITION core.raw_cross_purchase_data_p4_case_id_idx;

--
-- TOC entry 4804 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p4_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_metadata ATTACH PARTITION core.raw_cross_purchase_data_p4_case_id_metadata_id_idx;

--
-- TOC entry 4805 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p4_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_metadata_rownum ATTACH PARTITION core.raw_cross_purchase_data_p4_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4806 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p4_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_data_gin ATTACH PARTITION core.raw_cross_purchase_data_p4_data_idx;

--
-- TOC entry 4807 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p4_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_metadata_id ATTACH PARTITION core.raw_cross_purchase_data_p4_metadata_id_idx;

--
-- TOC entry 4808 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p4_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_cross_purchase_pk ATTACH PARTITION core.raw_cross_purchase_data_p4_pkey;

--
-- TOC entry 4809 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p4_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_tags_gin ATTACH PARTITION core.raw_cross_purchase_data_p4_tags_idx;

--
-- TOC entry 4810 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p5_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_id ATTACH PARTITION core.raw_cross_purchase_data_p5_case_id_idx;

--
-- TOC entry 4811 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p5_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_metadata ATTACH PARTITION core.raw_cross_purchase_data_p5_case_id_metadata_id_idx;

--
-- TOC entry 4812 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p5_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_metadata_rownum ATTACH PARTITION core.raw_cross_purchase_data_p5_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4813 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p5_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_data_gin ATTACH PARTITION core.raw_cross_purchase_data_p5_data_idx;

--
-- TOC entry 4814 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p5_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_metadata_id ATTACH PARTITION core.raw_cross_purchase_data_p5_metadata_id_idx;

--
-- TOC entry 4815 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p5_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_cross_purchase_pk ATTACH PARTITION core.raw_cross_purchase_data_p5_pkey;

--
-- TOC entry 4816 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p5_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_tags_gin ATTACH PARTITION core.raw_cross_purchase_data_p5_tags_idx;

--
-- TOC entry 4817 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p6_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_id ATTACH PARTITION core.raw_cross_purchase_data_p6_case_id_idx;

--
-- TOC entry 4818 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p6_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_metadata ATTACH PARTITION core.raw_cross_purchase_data_p6_case_id_metadata_id_idx;

--
-- TOC entry 4819 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p6_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_metadata_rownum ATTACH PARTITION core.raw_cross_purchase_data_p6_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4820 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p6_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_data_gin ATTACH PARTITION core.raw_cross_purchase_data_p6_data_idx;

--
-- TOC entry 4821 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p6_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_metadata_id ATTACH PARTITION core.raw_cross_purchase_data_p6_metadata_id_idx;

--
-- TOC entry 4822 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p6_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_cross_purchase_pk ATTACH PARTITION core.raw_cross_purchase_data_p6_pkey;

--
-- TOC entry 4823 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p6_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_tags_gin ATTACH PARTITION core.raw_cross_purchase_data_p6_tags_idx;

--
-- TOC entry 4824 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p7_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_id ATTACH PARTITION core.raw_cross_purchase_data_p7_case_id_idx;

--
-- TOC entry 4825 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p7_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_metadata ATTACH PARTITION core.raw_cross_purchase_data_p7_case_id_metadata_id_idx;

--
-- TOC entry 4826 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p7_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_case_metadata_rownum ATTACH PARTITION core.raw_cross_purchase_data_p7_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4827 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p7_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_data_gin ATTACH PARTITION core.raw_cross_purchase_data_p7_data_idx;

--
-- TOC entry 4828 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p7_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_metadata_id ATTACH PARTITION core.raw_cross_purchase_data_p7_metadata_id_idx;

--
-- TOC entry 4829 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p7_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_cross_purchase_pk ATTACH PARTITION core.raw_cross_purchase_data_p7_pkey;

--
-- TOC entry 4830 (class 0 OID 0)
-- Name: raw_cross_purchase_data_p7_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_cross_purchase_tags_gin ATTACH PARTITION core.raw_cross_purchase_data_p7_tags_idx;

--
-- TOC entry 4831 (class 0 OID 0)
-- Name: raw_pos_data_p0_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_id ATTACH PARTITION core.raw_pos_data_p0_case_id_idx;

--
-- TOC entry 4832 (class 0 OID 0)
-- Name: raw_pos_data_p0_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_metadata ATTACH PARTITION core.raw_pos_data_p0_case_id_metadata_id_idx;

--
-- TOC entry 4833 (class 0 OID 0)
-- Name: raw_pos_data_p0_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_metadata_rownum ATTACH PARTITION core.raw_pos_data_p0_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4834 (class 0 OID 0)
-- Name: raw_pos_data_p0_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_data_gin ATTACH PARTITION core.raw_pos_data_p0_data_idx;

--
-- TOC entry 4835 (class 0 OID 0)
-- Name: raw_pos_data_p0_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_metadata_id ATTACH PARTITION core.raw_pos_data_p0_metadata_id_idx;

--
-- TOC entry 4836 (class 0 OID 0)
-- Name: raw_pos_data_p0_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_pos_pk ATTACH PARTITION core.raw_pos_data_p0_pkey;

--
-- TOC entry 4837 (class 0 OID 0)
-- Name: raw_pos_data_p0_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_tags_gin ATTACH PARTITION core.raw_pos_data_p0_tags_idx;

--
-- TOC entry 4838 (class 0 OID 0)
-- Name: raw_pos_data_p1_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_id ATTACH PARTITION core.raw_pos_data_p1_case_id_idx;

--
-- TOC entry 4839 (class 0 OID 0)
-- Name: raw_pos_data_p1_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_metadata ATTACH PARTITION core.raw_pos_data_p1_case_id_metadata_id_idx;

--
-- TOC entry 4840 (class 0 OID 0)
-- Name: raw_pos_data_p1_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_metadata_rownum ATTACH PARTITION core.raw_pos_data_p1_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4841 (class 0 OID 0)
-- Name: raw_pos_data_p1_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_data_gin ATTACH PARTITION core.raw_pos_data_p1_data_idx;

--
-- TOC entry 4842 (class 0 OID 0)
-- Name: raw_pos_data_p1_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_metadata_id ATTACH PARTITION core.raw_pos_data_p1_metadata_id_idx;

--
-- TOC entry 4843 (class 0 OID 0)
-- Name: raw_pos_data_p1_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_pos_pk ATTACH PARTITION core.raw_pos_data_p1_pkey;

--
-- TOC entry 4844 (class 0 OID 0)
-- Name: raw_pos_data_p1_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_tags_gin ATTACH PARTITION core.raw_pos_data_p1_tags_idx;

--
-- TOC entry 4845 (class 0 OID 0)
-- Name: raw_pos_data_p2_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_id ATTACH PARTITION core.raw_pos_data_p2_case_id_idx;

--
-- TOC entry 4846 (class 0 OID 0)
-- Name: raw_pos_data_p2_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_metadata ATTACH PARTITION core.raw_pos_data_p2_case_id_metadata_id_idx;

--
-- TOC entry 4847 (class 0 OID 0)
-- Name: raw_pos_data_p2_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_metadata_rownum ATTACH PARTITION core.raw_pos_data_p2_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4848 (class 0 OID 0)
-- Name: raw_pos_data_p2_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_data_gin ATTACH PARTITION core.raw_pos_data_p2_data_idx;

--
-- TOC entry 4849 (class 0 OID 0)
-- Name: raw_pos_data_p2_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_metadata_id ATTACH PARTITION core.raw_pos_data_p2_metadata_id_idx;

--
-- TOC entry 4850 (class 0 OID 0)
-- Name: raw_pos_data_p2_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_pos_pk ATTACH PARTITION core.raw_pos_data_p2_pkey;

--
-- TOC entry 4851 (class 0 OID 0)
-- Name: raw_pos_data_p2_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_tags_gin ATTACH PARTITION core.raw_pos_data_p2_tags_idx;

--
-- TOC entry 4852 (class 0 OID 0)
-- Name: raw_pos_data_p3_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_id ATTACH PARTITION core.raw_pos_data_p3_case_id_idx;

--
-- TOC entry 4853 (class 0 OID 0)
-- Name: raw_pos_data_p3_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_metadata ATTACH PARTITION core.raw_pos_data_p3_case_id_metadata_id_idx;

--
-- TOC entry 4854 (class 0 OID 0)
-- Name: raw_pos_data_p3_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_metadata_rownum ATTACH PARTITION core.raw_pos_data_p3_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4855 (class 0 OID 0)
-- Name: raw_pos_data_p3_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_data_gin ATTACH PARTITION core.raw_pos_data_p3_data_idx;

--
-- TOC entry 4856 (class 0 OID 0)
-- Name: raw_pos_data_p3_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_metadata_id ATTACH PARTITION core.raw_pos_data_p3_metadata_id_idx;

--
-- TOC entry 4857 (class 0 OID 0)
-- Name: raw_pos_data_p3_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_pos_pk ATTACH PARTITION core.raw_pos_data_p3_pkey;

--
-- TOC entry 4858 (class 0 OID 0)
-- Name: raw_pos_data_p3_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_tags_gin ATTACH PARTITION core.raw_pos_data_p3_tags_idx;

--
-- TOC entry 4859 (class 0 OID 0)
-- Name: raw_pos_data_p4_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_id ATTACH PARTITION core.raw_pos_data_p4_case_id_idx;

--
-- TOC entry 4860 (class 0 OID 0)
-- Name: raw_pos_data_p4_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_metadata ATTACH PARTITION core.raw_pos_data_p4_case_id_metadata_id_idx;

--
-- TOC entry 4861 (class 0 OID 0)
-- Name: raw_pos_data_p4_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_metadata_rownum ATTACH PARTITION core.raw_pos_data_p4_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4862 (class 0 OID 0)
-- Name: raw_pos_data_p4_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_data_gin ATTACH PARTITION core.raw_pos_data_p4_data_idx;

--
-- TOC entry 4863 (class 0 OID 0)
-- Name: raw_pos_data_p4_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_metadata_id ATTACH PARTITION core.raw_pos_data_p4_metadata_id_idx;

--
-- TOC entry 4864 (class 0 OID 0)
-- Name: raw_pos_data_p4_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_pos_pk ATTACH PARTITION core.raw_pos_data_p4_pkey;

--
-- TOC entry 4865 (class 0 OID 0)
-- Name: raw_pos_data_p4_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_tags_gin ATTACH PARTITION core.raw_pos_data_p4_tags_idx;

--
-- TOC entry 4866 (class 0 OID 0)
-- Name: raw_pos_data_p5_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_id ATTACH PARTITION core.raw_pos_data_p5_case_id_idx;

--
-- TOC entry 4867 (class 0 OID 0)
-- Name: raw_pos_data_p5_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_metadata ATTACH PARTITION core.raw_pos_data_p5_case_id_metadata_id_idx;

--
-- TOC entry 4868 (class 0 OID 0)
-- Name: raw_pos_data_p5_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_metadata_rownum ATTACH PARTITION core.raw_pos_data_p5_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4869 (class 0 OID 0)
-- Name: raw_pos_data_p5_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_data_gin ATTACH PARTITION core.raw_pos_data_p5_data_idx;

--
-- TOC entry 4870 (class 0 OID 0)
-- Name: raw_pos_data_p5_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_metadata_id ATTACH PARTITION core.raw_pos_data_p5_metadata_id_idx;

--
-- TOC entry 4871 (class 0 OID 0)
-- Name: raw_pos_data_p5_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_pos_pk ATTACH PARTITION core.raw_pos_data_p5_pkey;

--
-- TOC entry 4872 (class 0 OID 0)
-- Name: raw_pos_data_p5_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_tags_gin ATTACH PARTITION core.raw_pos_data_p5_tags_idx;

--
-- TOC entry 4873 (class 0 OID 0)
-- Name: raw_pos_data_p6_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_id ATTACH PARTITION core.raw_pos_data_p6_case_id_idx;

--
-- TOC entry 4874 (class 0 OID 0)
-- Name: raw_pos_data_p6_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_metadata ATTACH PARTITION core.raw_pos_data_p6_case_id_metadata_id_idx;

--
-- TOC entry 4875 (class 0 OID 0)
-- Name: raw_pos_data_p6_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_metadata_rownum ATTACH PARTITION core.raw_pos_data_p6_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4876 (class 0 OID 0)
-- Name: raw_pos_data_p6_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_data_gin ATTACH PARTITION core.raw_pos_data_p6_data_idx;

--
-- TOC entry 4877 (class 0 OID 0)
-- Name: raw_pos_data_p6_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_metadata_id ATTACH PARTITION core.raw_pos_data_p6_metadata_id_idx;

--
-- TOC entry 4878 (class 0 OID 0)
-- Name: raw_pos_data_p6_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_pos_pk ATTACH PARTITION core.raw_pos_data_p6_pkey;

--
-- TOC entry 4879 (class 0 OID 0)
-- Name: raw_pos_data_p6_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_tags_gin ATTACH PARTITION core.raw_pos_data_p6_tags_idx;

--
-- TOC entry 4880 (class 0 OID 0)
-- Name: raw_pos_data_p7_case_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_id ATTACH PARTITION core.raw_pos_data_p7_case_id_idx;

--
-- TOC entry 4881 (class 0 OID 0)
-- Name: raw_pos_data_p7_case_id_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_metadata ATTACH PARTITION core.raw_pos_data_p7_case_id_metadata_id_idx;

--
-- TOC entry 4882 (class 0 OID 0)
-- Name: raw_pos_data_p7_case_id_metadata_id_row_num_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_case_metadata_rownum ATTACH PARTITION core.raw_pos_data_p7_case_id_metadata_id_row_num_idx;

--
-- TOC entry 4883 (class 0 OID 0)
-- Name: raw_pos_data_p7_data_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_data_gin ATTACH PARTITION core.raw_pos_data_p7_data_idx;

--
-- TOC entry 4884 (class 0 OID 0)
-- Name: raw_pos_data_p7_metadata_id_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_metadata_id ATTACH PARTITION core.raw_pos_data_p7_metadata_id_idx;

--
-- TOC entry 4885 (class 0 OID 0)
-- Name: raw_pos_data_p7_pkey; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.raw_pos_pk ATTACH PARTITION core.raw_pos_data_p7_pkey;

--
-- TOC entry 4886 (class 0 OID 0)
-- Name: raw_pos_data_p7_tags_idx; Type: INDEX ATTACH; Schema: core; Owner: -
--

ALTER INDEX core.idx_raw_pos_tags_gin ATTACH PARTITION core.raw_pos_data_p7_tags_idx;

--
-- TOC entry 4887 (class 2606 OID 25461)
-- Name: cases fk_cases_tenant_id_to_id; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.cases
    ADD CONSTRAINT fk_cases_tenant_id_to_id FOREIGN KEY (tenant_id) REFERENCES security.tenants(id) NOT VALID;

--
-- TOC entry 4903 (class 2606 OID 131203)
-- Name: partition_dataset_metadata fk_partition_dataset_metadata_case; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.partition_dataset_metadata
    ADD CONSTRAINT fk_partition_dataset_metadata_case FOREIGN KEY (case_id) REFERENCES core.cases(id) ON DELETE CASCADE;

--
-- TOC entry 4904 (class 2606 OID 131208)
-- Name: partition_dataset_metadata fk_partition_dataset_metadata_partition; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.partition_dataset_metadata
    ADD CONSTRAINT fk_partition_dataset_metadata_partition FOREIGN KEY (partition_id) REFERENCES core.partitions(id) ON DELETE CASCADE;

--
-- TOC entry 4889 (class 2606 OID 25466)
-- Name: workflows fk_partitions_case_id_to_cases_id; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.workflows
    ADD CONSTRAINT fk_partitions_case_id_to_cases_id FOREIGN KEY (case_id) REFERENCES core.cases(id) NOT VALID;

--
-- TOC entry 4888 (class 2606 OID 25471)
-- Name: partitions fk_partitions_case_id_to_id; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.partitions
    ADD CONSTRAINT fk_partitions_case_id_to_id FOREIGN KEY (case_id) REFERENCES core.cases(id) NOT VALID;

--
-- TOC entry 4905 (class 2606 OID 131232)
-- Name: raw_grouping_data fk_raw_grouping_data_case; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_grouping_data
    ADD CONSTRAINT fk_raw_grouping_data_case FOREIGN KEY (case_id) REFERENCES core.cases(id) ON DELETE CASCADE;

--
-- TOC entry 4906 (class 2606 OID 131227)
-- Name: raw_grouping_data fk_raw_grouping_data_metadata; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_grouping_data
    ADD CONSTRAINT fk_raw_grouping_data_metadata FOREIGN KEY (metadata_id) REFERENCES core.partition_dataset_metadata(id) ON DELETE CASCADE;

--
-- TOC entry 4907 (class 2606 OID 131237)
-- Name: raw_grouping_data fk_raw_grouping_data_partition; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.raw_grouping_data
    ADD CONSTRAINT fk_raw_grouping_data_partition FOREIGN KEY (partition_id) REFERENCES core.partitions(id) ON DELETE CASCADE;

--
-- TOC entry 4908 (class 2606 OID 131555)
-- Name: working_attributes_data fk_wad_grouping_metadata; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.working_attributes_data
    ADD CONSTRAINT fk_wad_grouping_metadata FOREIGN KEY (grouping_metadata_id) REFERENCES core.partition_dataset_metadata(id) ON DELETE CASCADE;

--
-- TOC entry 4890 (class 2606 OID 25476)
-- Name: workflows fk_workflows_partition_id_to_partitions_id; Type: FK CONSTRAINT; Schema: core; Owner: -
--

ALTER TABLE ONLY core.workflows
    ADD CONSTRAINT fk_workflows_partition_id_to_partitions_id FOREIGN KEY (partition_id) REFERENCES core.partitions(id) NOT VALID;


